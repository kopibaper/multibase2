/**
 * ZoraxyService — Manages Zoraxy reverse-proxy rules for Multibase tenants.
 *
 * When a new tenant is created, a proxy rule is added so that
 *   <tenantName>.<ROOT_DOMAIN>  →  multibase-nginx-gateway:<gatewayPort>
 *
 * When a tenant is deleted, the proxy rule is removed.
 *
 * Zoraxy API auth flow:
 *   1. GET /login.html  → extract CSRF token from <meta name="zoraxy.csrf.Token">
 *   2. POST /api/auth/login  → authenticate (cookie-based session)
 *   3. All subsequent requests carry the session cookie + X-CSRF-Token header
 */

import { logger } from '../utils/logger';

interface ZoraxyConfig {
  /** Base URL of the Zoraxy admin panel, e.g. "http://multibase-nginx-gateway:8899" or "http://127.0.0.1:8899" */
  adminUrl: string;
  /** Zoraxy admin username */
  username: string;
  /** Zoraxy admin password */
  password: string;
  /** Root domain for tenant subdomains, e.g. "spctrdev.com" */
  rootDomain: string;
  /** Upstream target hostname (Docker container name), default: "multibase-nginx-gateway" */
  upstreamHost?: string;
  /** Whether upstream uses TLS, default: false */
  upstreamTls?: boolean;
  /** Whether to skip TLS verification on upstream, default: true */
  skipTlsValidation?: boolean;
  /** Whether to require TLS on the proxy rule, default: false */
  requireTls?: boolean;
}

interface ZoraxySession {
  csrfToken: string;
  cookies: string;
  expiresAt: number;
}

export class ZoraxyService {
  private config: ZoraxyConfig;
  private session: ZoraxySession | null = null;
  /** Session lifetime in ms (re-auth after 25 minutes) */
  private static SESSION_TTL = 25 * 60 * 1000;

  constructor(config: ZoraxyConfig) {
    this.config = {
      upstreamHost: 'multibase-nginx-gateway',
      upstreamTls: false,
      skipTlsValidation: true,
      requireTls: false,
      ...config,
    };
  }

  /**
   * Create a ZoraxyService from environment variables.
   * Returns null if Zoraxy is not configured (ZORAXY_ADMIN_URL not set).
   */
  static fromEnv(): ZoraxyService | null {
    const adminUrl = process.env.ZORAXY_ADMIN_URL;
    if (!adminUrl) {
      logger.debug('ZoraxyService: ZORAXY_ADMIN_URL not set, Zoraxy integration disabled');
      return null;
    }

    const username = process.env.ZORAXY_USERNAME;
    const password = process.env.ZORAXY_PASSWORD;
    const rootDomain = process.env.ROOT_DOMAIN;

    if (!username || !password) {
      logger.warn('ZoraxyService: ZORAXY_USERNAME or ZORAXY_PASSWORD not set, skipping');
      return null;
    }

    if (!rootDomain) {
      logger.warn('ZoraxyService: ROOT_DOMAIN not set, cannot build tenant subdomains');
      return null;
    }

    return new ZoraxyService({
      adminUrl: adminUrl.replace(/\/+$/, ''),
      username,
      password,
      rootDomain,
      upstreamHost: process.env.ZORAXY_UPSTREAM_HOST || 'multibase-nginx-gateway',
      upstreamTls: process.env.ZORAXY_UPSTREAM_TLS === 'true',
      skipTlsValidation: process.env.ZORAXY_SKIP_TLS_VALIDATION !== 'false',
      requireTls: process.env.ZORAXY_REQUIRE_TLS === 'true',
    });
  }

  // ─── Authentication ──────────────────────────────────────────────────

  /**
   * Authenticate with Zoraxy and cache the session.
   */
  private async authenticate(): Promise<void> {
    // Reuse existing session if still valid
    if (this.session && Date.now() < this.session.expiresAt) {
      return;
    }

    logger.debug('ZoraxyService: Authenticating with Zoraxy admin panel');

    // Step 1: GET /login.html to obtain CSRF token and session cookie
    const loginPageRes = await fetch(`${this.config.adminUrl}/login.html`, {
      method: 'GET',
      redirect: 'manual',
    });

    const loginPageBody = await loginPageRes.text();
    const csrfMatch = loginPageBody.match(
      /<meta\s+name=["']zoraxy\.csrf\.Token["']\s+content=["']([^"']+)["']/i
    );

    if (!csrfMatch) {
      throw new Error('ZoraxyService: Could not extract CSRF token from login page');
    }

    const csrfToken = csrfMatch[1];
    const setCookieHeaders = loginPageRes.headers.getSetCookie?.() ?? [];
    const cookies = setCookieHeaders
      .map((c) => c.split(';')[0])
      .join('; ');

    // Step 2: POST /api/auth/login
    const loginBody = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
    });

    const loginRes = await fetch(`${this.config.adminUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRF-Token': csrfToken,
        Cookie: cookies,
      },
      body: loginBody.toString(),
      redirect: 'manual',
    });

    if (!loginRes.ok && loginRes.status !== 302) {
      const body = await loginRes.text().catch(() => '');
      throw new Error(`ZoraxyService: Login failed (${loginRes.status}): ${body}`);
    }

    // Merge any new cookies from the login response
    const loginCookies = loginRes.headers.getSetCookie?.() ?? [];
    const allCookies = [
      cookies,
      ...loginCookies.map((c) => c.split(';')[0]),
    ]
      .filter(Boolean)
      .join('; ');

    this.session = {
      csrfToken,
      cookies: allCookies,
      expiresAt: Date.now() + ZoraxyService.SESSION_TTL,
    };

    logger.debug('ZoraxyService: Authenticated successfully');
  }

  /**
   * Make an authenticated request to the Zoraxy API.
   */
  private async apiRequest(
    path: string,
    options: {
      method?: string;
      params?: Record<string, string>;
      json?: unknown;
    } = {}
  ): Promise<Response> {
    await this.authenticate();

    const { method = 'GET', params, json } = options;
    const url = `${this.config.adminUrl}${path}`;

    const headers: Record<string, string> = {
      'X-CSRF-Token': this.session!.csrfToken,
      Cookie: this.session!.cookies,
    };

    let body: string | undefined;

    if (json) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (params) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(params).toString();
    }

    const res = await fetch(url, { method, headers, body, redirect: 'manual' });

    // If we get a 401, invalidate session and retry once
    if (res.status === 401) {
      this.session = null;
      await this.authenticate();
      headers['X-CSRF-Token'] = this.session!.csrfToken;
      headers['Cookie'] = this.session!.cookies;
      return fetch(url, { method, headers, body, redirect: 'manual' });
    }

    return res;
  }

  // ─── Proxy Rule Management ──────────────────────────────────────────

  /**
   * Build the matching domain for a tenant.
   * e.g. "my-tenant" → "my-tenant.spctrdev.com"
   */
  private buildDomain(tenantName: string): string {
    return `${tenantName}.${this.config.rootDomain}`;
  }

  /**
   * Build the upstream origin for a tenant.
   * e.g. "multibase-nginx-gateway:6510"
   */
  private buildOrigin(gatewayPort: number): string {
    return `${this.config.upstreamHost}:${gatewayPort}`;
  }

  /**
   * Add a Zoraxy proxy rule for a tenant.
   *
   * @param tenantName  Tenant name (e.g. "nobarkenzo")
   * @param gatewayPort The Nginx gateway port assigned to this tenant
   */
  async addProxyRule(tenantName: string, gatewayPort: number): Promise<void> {
    const domain = this.buildDomain(tenantName);
    const origin = this.buildOrigin(gatewayPort);

    logger.info(`ZoraxyService: Adding proxy rule ${domain} → ${origin}`);

    try {
      const res = await this.apiRequest('/api/proxy/add', {
        method: 'POST',
        params: {
          type: 'host',
          rootname: domain,
          ep: origin,
          tls: String(this.config.requireTls || false),
        },
      });

      const body = await res.text();

      if (!res.ok) {
        // Zoraxy returns 200 even on "already exists" — check body
        throw new Error(`Zoraxy API returned ${res.status}: ${body}`);
      }

      logger.info(`ZoraxyService: Proxy rule added: ${domain} → ${origin}`);
    } catch (error: any) {
      logger.error(`ZoraxyService: Failed to add proxy rule for ${tenantName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove a Zoraxy proxy rule for a tenant.
   *
   * @param tenantName  Tenant name (e.g. "nobarkenzo")
   */
  async removeProxyRule(tenantName: string): Promise<void> {
    const domain = this.buildDomain(tenantName);

    logger.info(`ZoraxyService: Removing proxy rule for ${domain}`);

    try {
      const res = await this.apiRequest('/api/proxy/del', {
        method: 'POST',
        params: {
          ep: domain,
        },
      });

      const body = await res.text();

      if (!res.ok) {
        // 404 or "not found" is acceptable — rule might already be gone
        if (res.status === 404 || body.includes('not found')) {
          logger.debug(`ZoraxyService: Proxy rule for ${domain} was already removed`);
          return;
        }
        throw new Error(`Zoraxy API returned ${res.status}: ${body}`);
      }

      logger.info(`ZoraxyService: Proxy rule removed for ${domain}`);
    } catch (error: any) {
      logger.error(
        `ZoraxyService: Failed to remove proxy rule for ${tenantName}: ${error.message}`
      );
      // Don't throw on delete — tenant deletion should not fail because of Zoraxy
    }
  }

  /**
   * Check if a proxy rule exists for a tenant.
   */
  async hasProxyRule(tenantName: string): Promise<boolean> {
    const domain = this.buildDomain(tenantName);

    try {
      const res = await this.apiRequest(`/api/proxy/list?type=host`);
      const body = await res.text();

      if (!res.ok) {
        logger.warn(`ZoraxyService: Failed to list proxy rules: ${res.status}`);
        return false;
      }

      // Zoraxy returns a JSON object keyed by domain
      const rules = JSON.parse(body);
      return domain in rules;
    } catch (error: any) {
      logger.warn(`ZoraxyService: Error checking proxy rule for ${tenantName}: ${error.message}`);
      return false;
    }
  }

  /**
   * List all proxy rules from Zoraxy.
   */
  async listProxyRules(): Promise<Record<string, unknown>> {
    try {
      const res = await this.apiRequest('/api/proxy/list?type=host');
      const body = await res.text();

      if (!res.ok) {
        throw new Error(`Zoraxy API returned ${res.status}: ${body}`);
      }

      return JSON.parse(body);
    } catch (error: any) {
      logger.error(`ZoraxyService: Failed to list proxy rules: ${error.message}`);
      throw error;
    }
  }

  /**
   * Health check — verify Zoraxy is reachable and we can authenticate.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.authenticate();
      const res = await this.apiRequest('/api/proxy/list?type=host');
      return res.ok;
    } catch {
      return false;
    }
  }
}

export default ZoraxyService;

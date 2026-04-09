import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { promisify } from 'util';
import { exec } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { parseEnvFile } from '../utils/envParser';
import { reloadNginxGateway } from './NginxGatewayGenerator';

const resolveCname = promisify(dns.resolveCname);
const execAsync = promisify(exec);

// Strict domain validation — no path traversal / injection
const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function assertValidDomain(domain: string): void {
  if (!DOMAIN_RE.test(domain)) {
    throw new Error(`Invalid domain name: "${domain}"`);
  }
}

export class CustomDomainService {
  private readonly sharedDir: string;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly projectsPath: string
  ) {
    this.sharedDir = path.resolve(projectsPath, '..', 'shared');
  }

  // ──────────────────────────────────────────────────────────────────────
  // CRUD
  // ──────────────────────────────────────────────────────────────────────

  async listDomains(instanceName: string) {
    return this.prisma.customDomain.findMany({
      where: { instanceName },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addDomain(instanceName: string, domain: string) {
    assertValidDomain(domain);

    const existing = await this.prisma.customDomain.findFirst({
      where: { instanceName, domain },
    });
    if (existing) {
      throw new Error(`Domain "${domain}" already registered for this instance.`);
    }

    return this.prisma.customDomain.create({
      data: { instanceName, domain, status: 'pending_dns' },
    });
  }

  async removeDomain(instanceName: string, domain: string) {
    assertValidDomain(domain);

    const record = await this.prisma.customDomain.findFirst({
      where: { instanceName, domain },
    });
    if (!record) throw new Error(`Domain "${domain}" not found.`);

    // Remove nginx snippet if it exists
    this.removeNginxSnippet(instanceName, domain);

    await this.prisma.customDomain.delete({ where: { id: record.id } });

    // Reload nginx so the removed server block takes effect
    try {
      await reloadNginxGateway();
    } catch (err: any) {
      logger.warn(`Nginx reload after domain removal failed: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // DNS check
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Verify that the custom domain has a CNAME / A record that resolves.
   * We do a simple CNAME lookup; if the domain resolves at all we consider
   * DNS propagated enough to proceed.
   */
  async checkDns(instanceName: string, domain: string) {
    assertValidDomain(domain);

    const record = await this.prisma.customDomain.findFirst({
      where: { instanceName, domain },
    });
    if (!record) throw new Error(`Domain "${domain}" not found.`);

    let resolved = false;
    try {
      const cnames = await resolveCname(domain);
      resolved = cnames.length > 0;
    } catch {
      // CNAME lookup failed — try A record as fallback
      try {
        const addresses = await promisify(dns.resolve4)(domain);
        resolved = addresses.length > 0;
      } catch {
        resolved = false;
      }
    }

    if (!resolved) {
      await this.prisma.customDomain.update({
        where: { id: record.id },
        data: { status: 'pending_dns', errorMsg: 'DNS not yet propagated.' },
      });
      return { verified: false, message: 'DNS not yet propagated. Please check your CNAME record.' };
    }

    await this.prisma.customDomain.update({
      where: { id: record.id },
      data: { status: 'dns_verified', errorMsg: null },
    });

    logger.info(`DNS verified for domain "${domain}" on instance "${instanceName}"`);
    return { verified: true, message: 'DNS verified successfully.' };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Nginx snippet management
  // ──────────────────────────────────────────────────────────────────────

  /** Safe filename key — strips all non-alphanum/dot/hyphen */
  private safeKey(domain: string): string {
    return domain.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  private snippetPath(instanceName: string, domain: string): string {
    const tenantsDir = path.join(this.sharedDir, 'volumes', 'nginx', 'tenants');
    return path.join(tenantsDir, `${instanceName}-domain-${this.safeKey(domain)}.conf`);
  }

  private removeNginxSnippet(instanceName: string, domain: string): void {
    const p = this.snippetPath(instanceName, domain);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      logger.info(`Removed nginx snippet: ${p}`);
    }
  }

  private getGatewayPort(instanceName: string): number {
    const envPath = path.join(this.projectsPath, instanceName, '.env');
    if (!fs.existsSync(envPath)) return 8000;
    const env = parseEnvFile(envPath);
    return parseInt(env['GATEWAY_PORT'] || env['KONG_HTTP_PORT'] || '8000', 10);
  }

  private writeNginxSnippet(instanceName: string, domain: string, certDir: string): void {
    const gatewayPort = this.getGatewayPort(instanceName);
    const tenantsDir = path.join(this.sharedDir, 'volumes', 'nginx', 'tenants');
    fs.mkdirSync(tenantsDir, { recursive: true });

    const snippet = `# Custom domain: ${domain} -> instance: ${instanceName}
server {
    listen 443 ssl;
    server_name ${domain};

    ssl_certificate     ${certDir}/fullchain.pem;
    ssl_certificate_key ${certDir}/privkey.pem;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:${gatewayPort};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name ${domain};
    return 301 https://$host$request_uri;
}
`;
    const p = this.snippetPath(instanceName, domain);
    fs.writeFileSync(p, snippet, 'utf-8');
    logger.info(`Wrote nginx snippet: ${p}`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // SSL issuance (certbot)
  // ──────────────────────────────────────────────────────────────────────

  async activateSsl(instanceName: string, domain: string, adminEmail: string) {
    assertValidDomain(domain);
    // Extra guard: adminEmail must look like an email address
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      throw new Error('Invalid admin email address.');
    }

    const record = await this.prisma.customDomain.findFirst({
      where: { instanceName, domain },
    });
    if (!record) throw new Error(`Domain "${domain}" not found.`);
    if (record.status === 'pending_dns') {
      throw new Error('DNS must be verified before issuing an SSL certificate.');
    }

    await this.prisma.customDomain.update({
      where: { id: record.id },
      data: { status: 'ssl_pending', errorMsg: null },
    });

    try {
      // Stop listening on 443 temporarily (standalone mode needs the port free)
      // We use webroot mode to avoid port conflicts if nginx is running.
      // The webroot path is assumed to exist in the nginx container — in production
      // operators may prefer to run certbot manually; the command is shown in the UI.
      const certbotCmd =
        `certbot certonly --standalone ` +
        `--non-interactive --agree-tos ` +
        `--email ${adminEmail} ` +
        `-d ${domain} ` +
        `--preferred-challenges http`;

      logger.info(`Running certbot: ${certbotCmd}`);
      const { stdout, stderr } = await execAsync(certbotCmd, { timeout: 120_000 });
      logger.info(`Certbot stdout: ${stdout}`);
      if (stderr) logger.warn(`Certbot stderr: ${stderr}`);

      const certDir = `/etc/letsencrypt/live/${domain}`;
      this.writeNginxSnippet(instanceName, domain, certDir);

      await this.prisma.customDomain.update({
        where: { id: record.id },
        data: { status: 'ssl_active', errorMsg: null },
      });

      await reloadNginxGateway();

      return { success: true, message: `SSL activated for ${domain}.` };
    } catch (err: any) {
      const msg = err.message || String(err);
      await this.prisma.customDomain.update({
        where: { id: record.id },
        data: { status: 'error', errorMsg: msg },
      });
      throw new Error(`SSL activation failed: ${msg}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Manual activation (operator ran certbot themselves)
  // ──────────────────────────────────────────────────────────────────────

  async manualActivate(instanceName: string, domain: string, certDir: string) {
    assertValidDomain(domain);

    const record = await this.prisma.customDomain.findFirst({
      where: { instanceName, domain },
    });
    if (!record) throw new Error(`Domain "${domain}" not found.`);

    this.writeNginxSnippet(instanceName, domain, certDir);

    await this.prisma.customDomain.update({
      where: { id: record.id },
      data: { status: 'ssl_active', errorMsg: null },
    });

    try {
      await reloadNginxGateway();
    } catch (err: any) {
      logger.warn(`Nginx reload after manual activation failed: ${err.message}`);
    }

    return { success: true };
  }

  // ──────────────────────────────────────────────────────────────────────
  // Certbot command for manual use (shown in UI)
  // ──────────────────────────────────────────────────────────────────────

  getCertbotCommand(domain: string, adminEmail: string): string {
    assertValidDomain(domain);
    return (
      `sudo certbot certonly --standalone ` +
      `--non-interactive --agree-tos ` +
      `--email ${adminEmail} ` +
      `-d ${domain}`
    );
  }
}

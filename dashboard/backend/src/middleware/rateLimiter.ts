import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { logger } from '../utils/logger';

/**
 * Build a Redis-backed store for a single rate limiter.
 * Each limiter must get its own RedisStore instance (express-rate-limit enforces this).
 * The prefix keeps keys isolated per-limiter in Redis.
 *
 * Falls back to undefined (in-memory) when REDIS_URL is not set or Redis is unreachable.
 */
function buildStore(prefix: string): RedisStore | undefined {
  if (!process.env.REDIS_URL) return undefined;
  try {
    // Lazy-require so missing ioredis doesn't break local dev without Redis.
    // Do NOT set enableOfflineQueue: false here — RedisStore loads Lua scripts in its
    // constructor before the TCP connection completes. The default (queue enabled) lets
    // ioredis defer those commands until the connection is ready.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Redis } = require('ioredis');
    const client = new Redis(process.env.REDIS_URL);
    return new RedisStore({
      prefix,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendCommand: (...args: string[]) => client.call(...args) as any,
    });
  } catch {
    logger.warn(
      `Redis unavailable for rate limiting (${prefix}) – falling back to in-memory store`
    );
    return undefined;
  }
}

/**
 * Login Rate Limiter - Strict limits for brute-force protection
 * 5 attempts per 15 minutes per IP
 */
export const loginLimiter = rateLimit({
  store: buildStore('rl:login'),
  windowMs: 15 * 60 * 1000, // 15 Minuten Fenster
  max: 5, // Max 5 Versuche
  message: {
    error: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.',
    retryAfter: 15,
  },
  standardHeaders: true, // RateLimit-* Headers in Response
  legacyHeaders: false, // Disable X-RateLimit-* Headers
  skipSuccessfulRequests: true, // Erfolgreiche Logins zählen nicht gegen das Limit
  handler: (_req, res) => {
    logger.warn('Login rate limit exceeded');
    res.status(429).json({
      error: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.',
      retryAfter: 15,
    });
  },
});

/**
 * Register Rate Limiter - Moderate limits for spam protection
 * 3 attempts per hour per IP
 */
export const registerLimiter = rateLimit({
  store: buildStore('rl:register'),
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 3, // Max 3 Registrierungen pro Stunde
  message: {
    error: 'Zu viele Registrierungsversuche. Bitte warte 1 Stunde.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn('Register rate limit exceeded');
    res.status(429).json({
      error: 'Zu viele Registrierungsversuche. Bitte warte 1 Stunde.',
      retryAfter: 60,
    });
  },
});

/**
 * Feedback Rate Limiter - Anti-spam for public submissions
 * 3 submissions per hour per IP
 */
export const feedbackLimiter = rateLimit({
  store: buildStore('rl:feedback'),
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 3,
  message: { error: 'Zu viele Feedback-Einreichungen. Bitte warte 1 Stunde.', retryAfter: 60 },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn('Feedback rate limit exceeded');
    res
      .status(429)
      .json({ error: 'Zu viele Feedback-Einreichungen. Bitte warte 1 Stunde.', retryAfter: 60 });
  },
});

/**
 * General API Rate Limiter - For other endpoints if needed
 * 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  store: buildStore('rl:api'),
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Zu viele Anfragen. Bitte warte einen Moment.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Dashboard Authentication Middleware
 * Session-based auth with httpOnly cookies for CCS dashboard.
 */

import type { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { getDashboardAuthConfig } from '../../config/unified-config-loader';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getCcsDir } from '../../utils/config-manager';

// Extend Express Request with session
declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
    username: string;
  }
}

/** Public API paths that bypass auth (lowercase for case-insensitive matching) */
export const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/check',
  '/api/auth/setup',
  '/api/health',
];

/** Public document routes required for the login flow */
export const PUBLIC_DOCUMENT_PATHS = ['/login'];

/** Dev/prod asset prefixes that must stay reachable before login */
const PUBLIC_ASSET_PREFIXES = ['/assets/', '/@', '/__vite', '/src/', '/node_modules/'];

/** Match common static asset requests but not HTML documents like /index.html */
const STATIC_ASSET_PATTERN = /\/[^/]+\.[a-z0-9]+$/i;

export function isPublicApiPath(requestPath: string): boolean {
  const pathLower = requestPath.toLowerCase();
  return PUBLIC_API_PATHS.some((publicPath) => pathLower.startsWith(publicPath));
}

export function isPublicDocumentPath(requestPath: string): boolean {
  const pathLower = requestPath.toLowerCase();
  return PUBLIC_DOCUMENT_PATHS.some(
    (publicPath) => pathLower === publicPath || pathLower.startsWith(`${publicPath}/`)
  );
}

export function isStaticAssetPath(requestPath: string): boolean {
  const pathLower = requestPath.toLowerCase();

  if (pathLower.endsWith('.html')) {
    return false;
  }

  return (
    STATIC_ASSET_PATTERN.test(pathLower) ||
    PUBLIC_ASSET_PREFIXES.some((prefix) => pathLower.startsWith(prefix))
  );
}

/** Path to persistent session secret file */
function getSessionSecretPath() {
  return path.join(getCcsDir(), '.session-secret');
}

/**
 * Generate or retrieve persistent session secret.
 * Priority: ENV var > persisted file > generate new
 */
function getSessionSecret(): string {
  // 1. Check ENV var first
  if (process.env.CCS_SESSION_SECRET) {
    return process.env.CCS_SESSION_SECRET;
  }

  const secretPath = getSessionSecretPath();

  // 2. Try to read persisted secret
  try {
    if (fs.existsSync(secretPath)) {
      const secret = fs.readFileSync(secretPath, 'utf-8').trim();
      if (secret.length >= 32) {
        return secret;
      }
    }
  } catch {
    // Ignore read errors, generate new secret
  }

  // 3. Generate and persist new random secret
  const newSecret = crypto.randomBytes(32).toString('hex');
  try {
    const dir = path.dirname(secretPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(secretPath, newSecret, { mode: 0o600 });
  } catch (err) {
    // Log warning - sessions won't persist across restarts
    console.warn('[!] Failed to persist session secret:', (err as Error).message);
  }

  return newSecret;
}

/**
 * Rate limiter for login attempts.
 * 5 attempts per 15 minutes per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !getDashboardAuthConfig().enabled,
});

/**
 * Create session middleware configured for CCS dashboard.
 */
export function createSessionMiddleware() {
  const authConfig = getDashboardAuthConfig();
  const maxAge = (authConfig.session_timeout_hours ?? 24) * 60 * 60 * 1000;

  return session({
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Local CLI uses HTTP
      httpOnly: true,
      maxAge,
      sameSite: 'strict',
    },
  });
}

/**
 * Auth middleware that protects all routes except public paths.
 * Only active when dashboard_auth.enabled = true.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authConfig = getDashboardAuthConfig();

  // Skip auth if disabled
  if (!authConfig.enabled) {
    return next();
  }

  // Allow public auth/setup API routes
  if (isPublicApiPath(req.path)) {
    return next();
  }

  // Allow authenticated sessions through before route-specific handling
  if (req.session?.authenticated) {
    return next();
  }

  // Unauthenticated API access gets a JSON 401
  if (req.path.startsWith('/api/')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Allow login shell and static assets required to render it
  if (isPublicDocumentPath(req.path) || isStaticAssetPath(req.path)) {
    return next();
  }

  // Browser document requests should go to the login page instead of a raw 401
  if (req.method === 'GET' || req.method === 'HEAD') {
    res.redirect('/login');
    return;
  }

  res.status(401).send('Authentication required');
}

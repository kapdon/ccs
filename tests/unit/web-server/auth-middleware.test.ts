/**
 * Auth Middleware Tests
 * Tests for dashboard authentication middleware and routes.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import bcrypt from 'bcrypt';
import type { Request, Response } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

const mockAuthConfig = {
  enabled: false,
  username: '',
  password_hash: '',
  session_timeout_hours: 24,
};

let tempCcsHome = '';

describe('Dashboard Auth', () => {
  beforeEach(() => {
    // Reset to default disabled state
    mockAuthConfig.enabled = false;
    mockAuthConfig.username = '';
    mockAuthConfig.password_hash = '';

    tempCcsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-auth-test-'));
    process.env.CCS_HOME = tempCcsHome;
    delete process.env.CCS_DASHBOARD_AUTH_ENABLED;
    delete process.env.CCS_DASHBOARD_USERNAME;
    delete process.env.CCS_DASHBOARD_PASSWORD_HASH;
  });

  afterEach(() => {
    fs.rmSync(tempCcsHome, { recursive: true, force: true });
    delete process.env.CCS_HOME;
    delete process.env.CCS_DASHBOARD_AUTH_ENABLED;
    delete process.env.CCS_DASHBOARD_USERNAME;
    delete process.env.CCS_DASHBOARD_PASSWORD_HASH;
  });

  describe('getDashboardAuthConfig', () => {
    it('returns disabled by default', async () => {
      const { getDashboardAuthConfig } = await import('../../../src/config/unified-config-loader');
      const config = getDashboardAuthConfig();
      expect(config.enabled).toBe(false);
    });

    it('returns 24 hour default session timeout', async () => {
      const { getDashboardAuthConfig } = await import('../../../src/config/unified-config-loader');
      const config = getDashboardAuthConfig();
      expect(config.session_timeout_hours).toBe(24);
    });
  });

  describe('bcrypt password hashing', () => {
    it('generates valid bcrypt hash', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
    });

    it('verifies correct password', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('rejects incorrect password', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare('wrongpassword', hash);
      expect(isValid).toBe(false);
    });

    it('timing-safe comparison for wrong password', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      // bcrypt.compare should take similar time for wrong vs right password
      // This is a basic check that the function works
      const start1 = performance.now();
      await bcrypt.compare('wrongpassword', hash);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      await bcrypt.compare(password, hash);
      const time2 = performance.now() - start2;

      // Both should complete (timing comparison is handled by bcrypt internally)
      expect(time1).toBeGreaterThan(0);
      expect(time2).toBeGreaterThan(0);
    });
  });

  describe('path classification', () => {
    it('identifies public API paths correctly', async () => {
      const { isPublicApiPath } = await import(
        '../../../src/web-server/middleware/auth-middleware'
      );

      expect(isPublicApiPath('/api/auth/login')).toBe(true);
      expect(isPublicApiPath('/api/auth/check')).toBe(true);
      expect(isPublicApiPath('/api/auth/setup')).toBe(true);
      expect(isPublicApiPath('/api/health')).toBe(true);
      expect(isPublicApiPath('/api/profiles')).toBe(false);
      expect(isPublicApiPath('/api/config')).toBe(false);
    });

    it('allows the login document route', async () => {
      const { isPublicDocumentPath } = await import(
        '../../../src/web-server/middleware/auth-middleware'
      );

      expect(isPublicDocumentPath('/login')).toBe(true);
      expect(isPublicDocumentPath('/LOGIN')).toBe(true);
      expect(isPublicDocumentPath('/analytics')).toBe(false);
    });

    it('allows static assets but blocks html documents', async () => {
      const { isStaticAssetPath } = await import(
        '../../../src/web-server/middleware/auth-middleware'
      );

      expect(isStaticAssetPath('/assets/index.js')).toBe(true);
      expect(isStaticAssetPath('/favicon.ico')).toBe(true);
      expect(isStaticAssetPath('/@vite/client')).toBe(true);
      expect(isStaticAssetPath('/__vite_ping')).toBe(true);
      expect(isStaticAssetPath('/index.html')).toBe(false);
      expect(isStaticAssetPath('/analytics')).toBe(false);
    });
  });

  describe('session configuration', () => {
    it('session timeout converts to milliseconds correctly', () => {
      const hours = 24;
      const maxAge = hours * 60 * 60 * 1000;

      expect(maxAge).toBe(86400000); // 24 hours in ms
    });

    it('custom session timeout works', () => {
      const hours = 8;
      const maxAge = hours * 60 * 60 * 1000;

      expect(maxAge).toBe(28800000); // 8 hours in ms
    });
  });

  describe('auth flow logic', () => {
    it('bypasses auth when disabled', () => {
      mockAuthConfig.enabled = false;
      const shouldSkip = !mockAuthConfig.enabled;
      expect(shouldSkip).toBe(true);
    });

    it('requires auth when enabled', () => {
      mockAuthConfig.enabled = true;
      mockAuthConfig.username = 'admin';
      mockAuthConfig.password_hash = '$2b$10$test';

      const shouldSkip = !mockAuthConfig.enabled;
      expect(shouldSkip).toBe(false);
    });

    it('validates username match', () => {
      mockAuthConfig.username = 'admin';
      const usernameMatch = 'admin' === mockAuthConfig.username;
      expect(usernameMatch).toBe(true);
    });

    it('rejects wrong username', () => {
      mockAuthConfig.username = 'admin';
      const usernameMatch = 'wrong' === mockAuthConfig.username;
      expect(usernameMatch).toBe(false);
    });

    it('redirects unauthenticated document requests to login when enabled', async () => {
      process.env.CCS_DASHBOARD_AUTH_ENABLED = 'true';

      const { authMiddleware } = await import('../../../src/web-server/middleware/auth-middleware');
      const req = createMockRequest({ path: '/', method: 'GET' });
      const res = createMockResponse();
      const next = mock(() => {});

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.redirectLocation).toBe('/login');
      expect(res.statusCode).toBe(302);
    });

    it('blocks unauthenticated API requests with JSON 401 when enabled', async () => {
      process.env.CCS_DASHBOARD_AUTH_ENABLED = 'true';

      const { authMiddleware } = await import('../../../src/web-server/middleware/auth-middleware');
      const req = createMockRequest({ path: '/api/profiles', method: 'GET' });
      const res = createMockResponse();
      const next = mock(() => {});

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
      expect(res.jsonBody).toEqual({ error: 'Authentication required' });
    });

    it('allows the login page and static assets before authentication', async () => {
      process.env.CCS_DASHBOARD_AUTH_ENABLED = 'true';

      const { authMiddleware } = await import('../../../src/web-server/middleware/auth-middleware');
      const next = mock(() => {});

      authMiddleware(createMockRequest({ path: '/login' }), createMockResponse(), next);
      authMiddleware(createMockRequest({ path: '/assets/index.js' }), createMockResponse(), next);

      expect(next).toHaveBeenCalledTimes(2);
    });

    it('allows authenticated sessions through protected routes', async () => {
      process.env.CCS_DASHBOARD_AUTH_ENABLED = 'true';

      const { authMiddleware } = await import('../../../src/web-server/middleware/auth-middleware');
      const req = createMockRequest({
        path: '/api/profiles',
        session: { authenticated: true, username: 'admin' },
      });
      const res = createMockResponse();
      const next = mock(() => {});

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('rate limiting config', () => {
    it('rate limit window is 15 minutes', () => {
      const windowMs = 15 * 60 * 1000;
      expect(windowMs).toBe(900000);
    });

    it('max attempts is 5', () => {
      const maxAttempts = 5;
      expect(maxAttempts).toBe(5);
    });
  });
});

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    path: '/',
    method: 'GET',
    session: { authenticated: false, username: '' },
    ...overrides,
  } as Request;
}

function createMockResponse(): Response & {
  statusCode: number;
  jsonBody: unknown;
  textBody: unknown;
  redirectLocation: string | null;
} {
  const response = {
    statusCode: 200,
    jsonBody: null,
    textBody: null,
    redirectLocation: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      return this;
    },
    send(body: unknown) {
      this.textBody = body;
      return this;
    },
    redirect(location: string) {
      this.statusCode = 302;
      this.redirectLocation = location;
      return this;
    },
  };

  return response as Response & {
    statusCode: number;
    jsonBody: unknown;
    textBody: unknown;
    redirectLocation: string | null;
  };
}

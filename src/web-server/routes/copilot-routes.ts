/**
 * Copilot Routes - GitHub Copilot integration via copilot-api proxy
 */

import { Router, Request, Response } from 'express';
import {
  checkAuthStatus as checkCopilotAuth,
  startAuthFlow as startCopilotAuth,
  getCopilotStatus,
  getCopilotUsage,
  isDaemonRunning,
  startDaemon as startCopilotDaemon,
  stopDaemon as stopCopilotDaemon,
  getAvailableModels as getCopilotModels,
  isCopilotApiInstalled,
  ensureCopilotApi,
  installCopilotApiVersion,
  getCopilotApiInfo,
  getInstalledVersion as getCopilotInstalledVersion,
} from '../../copilot';
import { DEFAULT_COPILOT_CONFIG } from '../../config/unified-config-types';
import { loadOrCreateUnifiedConfig, saveUnifiedConfig } from '../../config/unified-config-loader';
import copilotSettingsRoutes from './copilot-settings-routes';

const router = Router();

// Mount settings sub-routes
router.use('/settings', copilotSettingsRoutes);

function parseRequiredModel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseOptionalModel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * GET /api/copilot/status - Get Copilot status (auth + daemon + install info)
 */
router.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    const status = await getCopilotStatus(copilotConfig);
    const installed = isCopilotApiInstalled();
    const version = getCopilotInstalledVersion();

    res.json({
      enabled: copilotConfig.enabled,
      installed,
      version,
      authenticated: status.auth.authenticated,
      daemon_running: status.daemon.running,
      port: copilotConfig.port,
      model: copilotConfig.model,
      account_type: copilotConfig.account_type,
      auto_start: copilotConfig.auto_start,
      rate_limit: copilotConfig.rate_limit,
      wait_on_limit: copilotConfig.wait_on_limit,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/config - Get Copilot configuration
 */
router.get('/config', (_req: Request, res: Response): void => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    res.json(copilotConfig);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * PUT /api/copilot/config - Update Copilot configuration
 */
router.put('/config', (req: Request, res: Response): void => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      res.status(400).json({ error: 'Request body must be a JSON object' });
      return;
    }
    const payload = updates as Record<string, unknown>;

    if ('port' in payload) {
      if (typeof payload.port !== 'number' || !Number.isInteger(payload.port)) {
        res.status(400).json({ error: 'port must be an integer' });
        return;
      }
      if (payload.port < 1 || payload.port > 65535) {
        res.status(400).json({ error: 'port must be between 1 and 65535' });
        return;
      }
    }

    if ('enabled' in payload && typeof payload.enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled must be a boolean' });
      return;
    }

    if ('auto_start' in payload && typeof payload.auto_start !== 'boolean') {
      res.status(400).json({ error: 'auto_start must be a boolean' });
      return;
    }

    if ('wait_on_limit' in payload && typeof payload.wait_on_limit !== 'boolean') {
      res.status(400).json({ error: 'wait_on_limit must be a boolean' });
      return;
    }

    if (
      'account_type' in payload &&
      payload.account_type !== 'individual' &&
      payload.account_type !== 'business' &&
      payload.account_type !== 'enterprise'
    ) {
      res.status(400).json({ error: 'account_type must be individual, business, or enterprise' });
      return;
    }

    if ('rate_limit' in payload) {
      if (payload.rate_limit !== null) {
        if (typeof payload.rate_limit !== 'number' || !Number.isInteger(payload.rate_limit)) {
          res.status(400).json({ error: 'rate_limit must be an integer or null' });
          return;
        }
        if (payload.rate_limit < 0) {
          res.status(400).json({ error: 'rate_limit must be >= 0 or null' });
          return;
        }
      }
    }

    const normalizedModel = parseRequiredModel(payload.model);
    if ('model' in payload && !normalizedModel) {
      res.status(400).json({ error: 'model must be a non-empty string' });
      return;
    }

    if (
      'opus_model' in payload &&
      payload.opus_model !== undefined &&
      payload.opus_model !== null &&
      typeof payload.opus_model !== 'string'
    ) {
      res.status(400).json({ error: 'opus_model must be a string' });
      return;
    }

    if (
      'sonnet_model' in payload &&
      payload.sonnet_model !== undefined &&
      payload.sonnet_model !== null &&
      typeof payload.sonnet_model !== 'string'
    ) {
      res.status(400).json({ error: 'sonnet_model must be a string' });
      return;
    }

    if (
      'haiku_model' in payload &&
      payload.haiku_model !== undefined &&
      payload.haiku_model !== null &&
      typeof payload.haiku_model !== 'string'
    ) {
      res.status(400).json({ error: 'haiku_model must be a string' });
      return;
    }

    const config = loadOrCreateUnifiedConfig();

    // Merge updates with existing config
    config.copilot = {
      enabled:
        (payload.enabled as boolean) ?? config.copilot?.enabled ?? DEFAULT_COPILOT_CONFIG.enabled,
      auto_start:
        (payload.auto_start as boolean) ??
        config.copilot?.auto_start ??
        DEFAULT_COPILOT_CONFIG.auto_start,
      port: (payload.port as number) ?? config.copilot?.port ?? DEFAULT_COPILOT_CONFIG.port,
      account_type:
        (payload.account_type as 'individual' | 'business' | 'enterprise') ??
        config.copilot?.account_type ??
        DEFAULT_COPILOT_CONFIG.account_type,
      rate_limit:
        payload.rate_limit !== undefined
          ? (payload.rate_limit as number | null)
          : (config.copilot?.rate_limit ?? DEFAULT_COPILOT_CONFIG.rate_limit),
      wait_on_limit:
        (payload.wait_on_limit as boolean) ??
        config.copilot?.wait_on_limit ??
        DEFAULT_COPILOT_CONFIG.wait_on_limit,
      model: normalizedModel ?? config.copilot?.model ?? DEFAULT_COPILOT_CONFIG.model,
      opus_model:
        'opus_model' in payload
          ? parseOptionalModel(payload.opus_model)
          : config.copilot?.opus_model,
      sonnet_model:
        'sonnet_model' in payload
          ? parseOptionalModel(payload.sonnet_model)
          : config.copilot?.sonnet_model,
      haiku_model:
        'haiku_model' in payload
          ? parseOptionalModel(payload.haiku_model)
          : config.copilot?.haiku_model,
    };

    saveUnifiedConfig(config);
    res.json({ success: true, copilot: config.copilot });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/auth/start - Start GitHub OAuth flow
 */
router.post('/auth/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await startCopilotAuth();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/auth/status - Get auth status only
 */
router.get('/auth/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await checkCopilotAuth();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/models - Get available models
 */
router.get('/models', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const port = config.copilot?.port ?? DEFAULT_COPILOT_CONFIG.port;
    const currentModel = config.copilot?.model ?? DEFAULT_COPILOT_CONFIG.model;
    const models = await getCopilotModels(port);

    const modelsWithCurrent = models.map((m) => ({
      ...m,
      isCurrent: m.id === currentModel,
    }));

    res.json({ models: modelsWithCurrent, current: currentModel });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/usage - Get Copilot quota usage from copilot-api /usage endpoint
 */
router.get('/usage', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const port = config.copilot?.port ?? DEFAULT_COPILOT_CONFIG.port;
    const daemonRunning = await isDaemonRunning(port);

    if (!daemonRunning) {
      res.status(503).json({
        error: 'copilot-api daemon is not running',
        message: 'Start daemon first: ccs copilot start',
      });
      return;
    }

    const usage = await getCopilotUsage(port);
    if (!usage) {
      res.status(503).json({
        error: 'Failed to fetch Copilot usage',
        message: 'copilot-api /usage endpoint is unavailable',
      });
      return;
    }

    res.json(usage);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/daemon/start - Start copilot-api daemon
 */
router.post('/daemon/start', async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = loadOrCreateUnifiedConfig();
    const copilotConfig = config.copilot ?? DEFAULT_COPILOT_CONFIG;
    const result = await startCopilotDaemon(copilotConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/daemon/stop - Stop copilot-api daemon
 */
router.post('/daemon/stop', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await stopCopilotDaemon();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/copilot/install - Install copilot-api
 */
router.post('/install', async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.body || {};

    if (version) {
      await installCopilotApiVersion(version);
    } else {
      await ensureCopilotApi();
    }

    const info = getCopilotApiInfo();
    res.json({
      success: true,
      installed: info.installed,
      version: info.version,
      path: info.path,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/copilot/info - Get copilot-api installation info
 */
router.get('/info', (_req: Request, res: Response): void => {
  try {
    const info = getCopilotApiInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

import { Router, type Request, type Response } from 'express';
import { getOfficialChannelsConfig, mutateUnifiedConfig } from '../../config/unified-config-loader';
import {
  clearConfiguredOfficialChannelTokensEverywhere,
  getOfficialChannelEnvPath,
  getOfficialChannelReadiness,
  hasConfiguredOfficialChannelToken,
  setConfiguredOfficialChannelToken,
} from '../../channels/official-channels-store';
import {
  expandOfficialChannelSelection,
  getOfficialChannelDisplayName,
  getOfficialChannelEnvKey,
  getOfficialChannelPluginSpec,
  getOfficialChannelSummary,
  getOfficialChannelUnavailableReason,
  getOfficialChannelsSupportedProfiles,
  getOfficialChannelManualSetupCommands,
  getOfficialChannelTokenIds,
  isBunAvailable,
  isOfficialChannelId,
} from '../../channels/official-channels-runtime';
import { requireLocalAccessWhenAuthDisabled } from '../middleware/auth-middleware';

const router = Router();

function buildChannelsStatus() {
  return {
    bunInstalled: isBunAvailable(),
    supportedProfiles: getOfficialChannelsSupportedProfiles(),
    channels: expandOfficialChannelSelection('all').map((channelId) => ({
      id: channelId,
      displayName: getOfficialChannelDisplayName(channelId),
      pluginSpec: getOfficialChannelPluginSpec(channelId),
      summary: getOfficialChannelSummary(channelId),
      requiresToken: getOfficialChannelTokenIds().includes(channelId),
      envKey: getOfficialChannelEnvKey(channelId),
      tokenConfigured: getOfficialChannelTokenIds().includes(channelId)
        ? hasConfiguredOfficialChannelToken(channelId)
        : getOfficialChannelReadiness(channelId),
      tokenPath: getOfficialChannelTokenIds().includes(channelId)
        ? getOfficialChannelEnvPath(channelId)
        : undefined,
      unavailableReason: getOfficialChannelUnavailableReason(channelId),
      manualSetupCommands: getOfficialChannelManualSetupCommands(channelId),
    })),
  };
}

router.use((req: Request, res: Response, next) => {
  if (
    requireLocalAccessWhenAuthDisabled(
      req,
      res,
      'Official Channels settings require localhost access when dashboard auth is disabled.'
    )
  ) {
    next();
  }
});

router.get('/', (_req: Request, res: Response): void => {
  res.json({
    config: getOfficialChannelsConfig(),
    status: buildChannelsStatus(),
  });
});

router.put('/', (req: Request, res: Response): void => {
  const { selected, unattended } = req.body as { selected?: unknown; unattended?: unknown };

  if (
    selected !== undefined &&
    (!Array.isArray(selected) ||
      selected.some((value) => typeof value !== 'string' || !isOfficialChannelId(value)))
  ) {
    res.status(400).json({ error: 'selected must be an array of official channel IDs' });
    return;
  }
  if (unattended !== undefined && typeof unattended !== 'boolean') {
    res.status(400).json({ error: 'unattended must be a boolean' });
    return;
  }

  try {
    const updated = mutateUnifiedConfig((config) => {
      config.channels = {
        selected: selected ? [...new Set(selected)] : (config.channels?.selected ?? []),
        unattended: unattended ?? config.channels?.unattended ?? false,
      };
    });

    res.json({ success: true, config: updated.channels });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.put('/:channelId/token', (req: Request, res: Response): void => {
  const { channelId } = req.params;
  const { token } = req.body as { token?: unknown };

  if (!isOfficialChannelId(channelId) || !getOfficialChannelTokenIds().includes(channelId)) {
    res.status(400).json({ error: 'channelId must be a token-based official channel' });
    return;
  }
  if (typeof token !== 'string') {
    res.status(400).json({ error: 'token must be a string' });
    return;
  }

  try {
    const tokenPath = setConfiguredOfficialChannelToken(channelId, token);
    res.json({ success: true, tokenConfigured: true, tokenPath });
  } catch (error) {
    const message = (error as Error).message;
    const statusCode = message.includes('cannot be empty') ? 400 : 500;
    res.status(statusCode).json({ error: message });
  }
});

router.delete('/:channelId/token', (req: Request, res: Response): void => {
  const { channelId } = req.params;

  if (!isOfficialChannelId(channelId) || !getOfficialChannelTokenIds().includes(channelId)) {
    res.status(400).json({ error: 'channelId must be a token-based official channel' });
    return;
  }

  try {
    const clearedPaths = clearConfiguredOfficialChannelTokensEverywhere(channelId);
    res.json({
      success: true,
      tokenConfigured: false,
      tokenPath: getOfficialChannelEnvPath(channelId),
      clearedPaths,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

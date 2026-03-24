import { describe, expect, it } from 'bun:test';
import {
  OFFICIAL_CHANNELS,
  buildOfficialChannelsArgs,
  expandOfficialChannelSelection,
  hasExplicitChannelsFlag,
  hasExplicitPermissionOverride,
  isDiscordChannelsSessionSupported,
  resolveOfficialChannelsLaunchPlan,
  resolveOfficialChannelsSyncConfigDir,
} from '../../../src/channels/official-channels-runtime';

describe('official channels runtime planning', () => {
  it('supports only native Claude default/account sessions', () => {
    expect(isDiscordChannelsSessionSupported('claude', 'default')).toBe(true);
    expect(isDiscordChannelsSessionSupported('claude', 'account')).toBe(true);
    expect(isDiscordChannelsSessionSupported('claude', 'settings')).toBe(false);
    expect(isDiscordChannelsSessionSupported('droid', 'default')).toBe(false);
  });

  it('detects explicit channel and permission overrides', () => {
    expect(hasExplicitChannelsFlag(['--channels', 'plugin:other'])).toBe(true);
    expect(
      hasExplicitChannelsFlag([`--channels=${OFFICIAL_CHANNELS.discord.pluginSpec}`])
    ).toBe(true);
    expect(hasExplicitChannelsFlag(['--permission-mode', 'acceptEdits'])).toBe(false);

    expect(hasExplicitPermissionOverride(['--dangerously-skip-permissions'])).toBe(true);
    expect(hasExplicitPermissionOverride(['--permission-mode', 'acceptEdits'])).toBe(true);
    expect(hasExplicitPermissionOverride(['--permission-mode=acceptEdits'])).toBe(true);
  });

  it('expands channel selection and builds runtime argv in stable order', () => {
    expect(expandOfficialChannelSelection('all')).toEqual(['telegram', 'discord', 'imessage']);
    expect(expandOfficialChannelSelection('discord,telegram')).toEqual(['telegram', 'discord']);
    expect(buildOfficialChannelsArgs(['--verbose'], ['telegram', 'discord'], true)).toEqual([
      '--verbose',
      '--channels',
      OFFICIAL_CHANNELS.telegram.pluginSpec,
      OFFICIAL_CHANNELS.discord.pluginSpec,
      '--dangerously-skip-permissions',
    ]);
  });

  it('adds all ready selected channels and optional permission bypass when eligible', () => {
    const plan = resolveOfficialChannelsLaunchPlan({
      args: ['--verbose'],
      config: { selected: ['telegram', 'discord'], unattended: true },
      target: 'claude',
      profileType: 'default',
      bunAvailable: true,
      channelReadiness: {
        telegram: true,
        discord: true,
        imessage: true,
      },
    });

    expect(plan.applied).toBe(true);
    expect(plan.appliedChannels).toEqual(['telegram', 'discord']);
    expect(plan.wantsPermissionBypass).toBe(true);
  });

  it('keeps explicit permission choice and still returns ready channels', () => {
    const plan = resolveOfficialChannelsLaunchPlan({
      args: ['--permission-mode', 'acceptEdits'],
      config: { selected: ['discord'], unattended: true },
      target: 'claude',
      profileType: 'account',
      bunAvailable: true,
      channelReadiness: {
        telegram: false,
        discord: true,
        imessage: true,
      },
    });

    expect(plan.applied).toBe(true);
    expect(plan.appliedChannels).toEqual(['discord']);
    expect(plan.wantsPermissionBypass).toBe(false);
  });

  it('skips incompatible sessions and reports per-channel readiness problems', () => {
    const incompatible = resolveOfficialChannelsLaunchPlan({
      args: [],
      config: { selected: ['discord'], unattended: false },
      target: 'claude',
      profileType: 'settings',
      bunAvailable: true,
      channelReadiness: {
        telegram: true,
        discord: true,
        imessage: true,
      },
    });
    const missingBun = resolveOfficialChannelsLaunchPlan({
      args: [],
      config: { selected: ['discord'], unattended: false },
      target: 'claude',
      profileType: 'default',
      bunAvailable: false,
      channelReadiness: {
        telegram: true,
        discord: true,
        imessage: true,
      },
    });
    const missingToken = resolveOfficialChannelsLaunchPlan({
      args: [],
      config: { selected: ['telegram', 'discord'], unattended: false },
      target: 'claude',
      profileType: 'default',
      bunAvailable: true,
      channelReadiness: {
        telegram: false,
        discord: true,
        imessage: true,
      },
    });

    expect(incompatible.applied).toBe(false);
    expect(incompatible.skippedMessages.join(' ')).toContain('native Claude default/account sessions');
    expect(missingBun.applied).toBe(false);
    expect(missingBun.skippedMessages.join(' ')).toContain('Bun is not installed');
    expect(missingToken.applied).toBe(true);
    expect(missingToken.appliedChannels).toEqual(['discord']);
    expect(missingToken.skippedMessages.join(' ')).toContain('TELEGRAM_BOT_TOKEN is not configured');
  });

  it('leaves explicit channel arguments untouched', () => {
    const plan = resolveOfficialChannelsLaunchPlan({
      args: ['--channels', 'plugin:custom'],
      config: { selected: ['discord'], unattended: true },
      target: 'claude',
      profileType: 'default',
      bunAvailable: true,
      channelReadiness: {
        telegram: true,
        discord: true,
        imessage: true,
      },
    });

    expect(plan.applied).toBe(false);
    expect(plan.appliedChannels).toEqual([]);
    expect(plan.skippedMessages).toEqual([]);
  });

  it('falls back to process.env.CLAUDE_CONFIG_DIR for sync when no explicit dir is passed', () => {
    const originalConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = '/tmp/external-claude-config';

    try {
      expect(resolveOfficialChannelsSyncConfigDir()).toBe('/tmp/external-claude-config');
      expect(resolveOfficialChannelsSyncConfigDir('/tmp/explicit')).toBe('/tmp/explicit');
    } finally {
      if (originalConfigDir !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = originalConfigDir;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    }
  });
});

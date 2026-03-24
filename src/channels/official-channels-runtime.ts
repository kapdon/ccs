import { spawnSync } from 'child_process';
import type { TargetType } from '../targets/target-adapter';
import type { ProfileType } from '../types/profile';
import type { OfficialChannelId, OfficialChannelsConfig } from '../config/unified-config-types';

export interface OfficialChannelDefinition {
  id: OfficialChannelId;
  displayName: string;
  pluginSpec: string;
  envKey?: string;
  envDir: string;
  requiresMacOS?: boolean;
  manualSetupCommands: string[];
}

export const OFFICIAL_CHANNELS: Record<OfficialChannelId, OfficialChannelDefinition> = {
  telegram: {
    id: 'telegram',
    displayName: 'Telegram',
    pluginSpec: 'plugin:telegram@claude-plugins-official',
    envKey: 'TELEGRAM_BOT_TOKEN',
    envDir: 'telegram',
    manualSetupCommands: [
      '/plugin install telegram@claude-plugins-official',
      '/telegram:configure <token>',
      '/telegram:access pair <code>',
      '/telegram:access policy allowlist',
    ],
  },
  discord: {
    id: 'discord',
    displayName: 'Discord',
    pluginSpec: 'plugin:discord@claude-plugins-official',
    envKey: 'DISCORD_BOT_TOKEN',
    envDir: 'discord',
    manualSetupCommands: [
      '/plugin install discord@claude-plugins-official',
      '/discord:configure <token>',
      '/discord:access pair <code>',
      '/discord:access policy allowlist',
    ],
  },
  imessage: {
    id: 'imessage',
    displayName: 'iMessage',
    pluginSpec: 'plugin:imessage@claude-plugins-official',
    envDir: 'imessage',
    requiresMacOS: true,
    manualSetupCommands: [
      '/plugin install imessage@claude-plugins-official',
      '/imessage:access allow +15551234567',
    ],
  },
};

export const OFFICIAL_CHANNEL_IDS = Object.keys(OFFICIAL_CHANNELS) as OfficialChannelId[];

export interface DiscordChannelsLaunchPlan {
  applied: boolean;
  wantsPermissionBypass: boolean;
  appliedChannels: OfficialChannelId[];
  skippedMessages: string[];
}

interface DiscordChannelsLaunchInput {
  args: string[];
  config: OfficialChannelsConfig;
  target: TargetType;
  profileType: ProfileType;
  bunAvailable: boolean;
  channelReadiness: Record<OfficialChannelId, boolean>;
}

export function isBunAvailable(): boolean {
  const result = spawnSync('bun', ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

export function isDiscordChannelsSessionSupported(
  target: TargetType,
  profileType: ProfileType
): boolean {
  return target === 'claude' && (profileType === 'default' || profileType === 'account');
}

export function isOfficialChannelId(value: string): value is OfficialChannelId {
  return value in OFFICIAL_CHANNELS;
}

export function normalizeOfficialChannelIds(values: readonly string[]): OfficialChannelId[] {
  const seen = new Set<OfficialChannelId>();
  const normalized: OfficialChannelId[] = [];

  for (const channelId of OFFICIAL_CHANNEL_IDS) {
    if (!values.includes(channelId) || seen.has(channelId)) {
      continue;
    }

    seen.add(channelId);
    normalized.push(channelId);
  }

  return normalized;
}

export function hasExplicitChannelsFlag(args: string[]): boolean {
  return args.some((arg) => arg === '--channels' || arg.startsWith('--channels='));
}

export function hasExplicitPermissionOverride(args: string[]): boolean {
  return args.some(
    (arg) =>
      arg === '--dangerously-skip-permissions' ||
      arg === '--permission-mode' ||
      arg.startsWith('--permission-mode=')
  );
}

export function resolveOfficialChannelsSyncConfigDir(targetConfigDir?: string): string | undefined {
  return targetConfigDir ?? process.env.CLAUDE_CONFIG_DIR;
}

export function buildOfficialChannelsArgs(
  args: string[],
  channels: OfficialChannelId[],
  includePermissionBypass: boolean
): string[] {
  const nextArgs = [
    ...args,
    '--channels',
    ...channels.map((channel) => OFFICIAL_CHANNELS[channel].pluginSpec),
  ];

  if (includePermissionBypass) {
    nextArgs.push('--dangerously-skip-permissions');
  }

  return nextArgs;
}

export function resolveOfficialChannelsLaunchPlan(
  input: DiscordChannelsLaunchInput
): DiscordChannelsLaunchPlan {
  const { args, config, target, profileType, bunAvailable, channelReadiness } = input;
  const skippedMessages: string[] = [];

  if (config.selected.length === 0) {
    return {
      applied: false,
      wantsPermissionBypass: false,
      appliedChannels: [],
      skippedMessages,
    };
  }

  if (!isDiscordChannelsSessionSupported(target, profileType)) {
    return {
      applied: false,
      wantsPermissionBypass: false,
      appliedChannels: [],
      skippedMessages: [
        'Official Channels auto-enable only applies to native Claude default/account sessions.',
      ],
    };
  }

  if (hasExplicitChannelsFlag(args)) {
    return {
      applied: false,
      wantsPermissionBypass: false,
      appliedChannels: [],
      skippedMessages,
    };
  }

  if (!bunAvailable) {
    return {
      applied: false,
      wantsPermissionBypass: false,
      appliedChannels: [],
      skippedMessages: ['Official Channels auto-enable skipped because Bun is not installed.'],
    };
  }

  const appliedChannels: OfficialChannelId[] = [];

  for (const channelId of normalizeOfficialChannelIds(config.selected)) {
    const channel = OFFICIAL_CHANNELS[channelId];

    if (channel.requiresMacOS && !isMacOS()) {
      skippedMessages.push(`${channel.displayName} auto-enable skipped because it requires macOS.`);
      continue;
    }

    if (!channelReadiness[channelId]) {
      skippedMessages.push(
        channel.envKey
          ? `${channel.displayName} auto-enable skipped because ${channel.envKey} is not configured.`
          : `${channel.displayName} auto-enable skipped because it is not ready on this machine.`
      );
      continue;
    }

    appliedChannels.push(channelId);
  }

  return {
    applied: appliedChannels.length > 0,
    wantsPermissionBypass: config.unattended && !hasExplicitPermissionOverride(args),
    appliedChannels,
    skippedMessages,
  };
}

export function getOfficialChannelTokenIds(): OfficialChannelId[] {
  return OFFICIAL_CHANNEL_IDS.filter((channelId) => Boolean(OFFICIAL_CHANNELS[channelId].envKey));
}

export function getOfficialChannelManualSetupCommands(channelId: OfficialChannelId): string[] {
  return OFFICIAL_CHANNELS[channelId].manualSetupCommands;
}

export function getOfficialChannelDisplayName(channelId: OfficialChannelId): string {
  return OFFICIAL_CHANNELS[channelId].displayName;
}

export function getOfficialChannelPluginSpec(channelId: OfficialChannelId): string {
  return OFFICIAL_CHANNELS[channelId].pluginSpec;
}

export function getOfficialChannelEnvKey(channelId: OfficialChannelId): string | undefined {
  return OFFICIAL_CHANNELS[channelId].envKey;
}

export function officialChannelRequiresMacOS(channelId: OfficialChannelId): boolean {
  return Boolean(OFFICIAL_CHANNELS[channelId].requiresMacOS);
}

export function getOfficialChannelEnvDir(channelId: OfficialChannelId): string {
  return OFFICIAL_CHANNELS[channelId].envDir;
}

export function getOfficialChannelSummary(channelId: OfficialChannelId): string {
  if (channelId === 'telegram') {
    return 'Bot token required. Polls your Telegram bot while Claude is running.';
  }
  if (channelId === 'discord') {
    return 'Bot token required. Receives DMs and allowed server messages while Claude is running.';
  }

  return 'macOS-only. No bot token required, but Messages permissions are required.';
}

export function getOfficialChannelUnavailableReason(
  channelId: OfficialChannelId
): string | undefined {
  if (channelId === 'imessage' && !isMacOS()) {
    return 'Requires macOS.';
  }

  return undefined;
}

export function getOfficialChannelReadyMessage(channelId: OfficialChannelId): string {
  if (channelId === 'imessage') {
    return isMacOS()
      ? 'Ready after Claude-side install and macOS permissions.'
      : 'Unavailable on this platform.';
  }

  const envKey = getOfficialChannelEnvKey(channelId);
  return envKey
    ? `${envKey} must be configured before CCS can auto-enable this channel.`
    : 'Ready.';
}

export function expandOfficialChannelSelection(selection: string): OfficialChannelId[] {
  if (selection.trim().toLowerCase() === 'all') {
    return [...OFFICIAL_CHANNEL_IDS];
  }

  return normalizeOfficialChannelIds(
    selection
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function getOfficialChannelChoices(): string {
  return OFFICIAL_CHANNEL_IDS.join(', ');
}

export function isOfficialChannelSelectionValid(selection: string): boolean {
  const parsed = selection
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return (
    parsed.length > 0 && parsed.every((value) => value === 'all' || isOfficialChannelId(value))
  );
}

export function resolveLegacyDiscordSelection(enabled: boolean | undefined): OfficialChannelId[] {
  return enabled ? ['discord'] : [];
}

export function getOfficialChannelsSupportedProfiles(): string[] {
  return ['default', 'account'];
}

export function getChannelConfigSelectionLabel(selected: OfficialChannelId[]): string {
  if (selected.length === 0) {
    return 'None';
  }

  return selected.map((channelId) => getOfficialChannelDisplayName(channelId)).join(', ');
}

export function getTokenValueLabel(channelId: OfficialChannelId): string {
  return getOfficialChannelEnvKey(channelId) ?? '';
}

export function isOfficialChannelTokenRequired(channelId: OfficialChannelId): boolean {
  return Boolean(getOfficialChannelEnvKey(channelId));
}

export function getOfficialChannelDefaultTokenPlaceholder(channelId: OfficialChannelId): string {
  const envKey = getOfficialChannelEnvKey(channelId);
  return envKey ? `Paste ${envKey}` : '';
}

export function getOfficialChannelConfiguredPlaceholder(channelId: OfficialChannelId): string {
  const envKey = getOfficialChannelEnvKey(channelId);
  return envKey ? `Configured. Enter a new ${envKey} to replace it.` : '';
}

export function getOfficialChannelsSectionDescription(): string {
  return 'Auto-enable Anthropic official channels for compatible Claude sessions. Tokens stay in Claude channel env files rather than config.yaml.';
}

export function getOfficialChannelsRuntimeNote(): string {
  return 'CCS does not persist a global Claude channels default. It only injects runtime flags when the selected channels are supported and ready.';
}

export function getOfficialChannelsSetHelp(): string {
  return `Set selected channels with --set <csv>. Supported values: ${getOfficialChannelChoices()}, or all.`;
}

export function getOfficialChannelsLegacyEnableHelp(): string {
  return 'Legacy aliases: --enable adds Discord, --disable removes Discord.';
}

export function getOfficialChannelTokenHelp(): string {
  return 'Use --set-token <channel>=<token>. If no channel is provided, Discord is assumed for backward compatibility.';
}

export function getOfficialChannelClearTokenHelp(): string {
  return 'Use --clear-token to clear all saved bot tokens, or --clear-token <channel> to clear one token.';
}

export function getOfficialChannelMacOSHelp(): string {
  return 'iMessage needs macOS Full Disk Access plus the Messages automation prompt on first reply.';
}

export function getOfficialChannelsDocsSummary(): string {
  return 'Supported official channels are Telegram, Discord, and iMessage.';
}

export function getOfficialChannelSyncFailureMessage(
  channelId: OfficialChannelId,
  targetPath: string
): string {
  return `${getOfficialChannelDisplayName(channelId)} auto-enable skipped: failed to sync channel env to ${targetPath}`;
}

export function getOfficialChannelSyncSkipReason(channelId: OfficialChannelId): string {
  return `${getOfficialChannelDisplayName(channelId)} auto-enable skipped.`;
}

export function getOfficialChannelsExplicitOverrideMessage(): string | undefined {
  return undefined;
}

export function getOfficialChannelTokenMissingMessage(channelId: OfficialChannelId): string {
  const envKey = getOfficialChannelEnvKey(channelId);
  return envKey
    ? `${getOfficialChannelDisplayName(channelId)} auto-enable skipped because ${envKey} is not configured.`
    : `${getOfficialChannelDisplayName(channelId)} auto-enable skipped because it is not ready.`;
}

export function getOfficialChannelsBunMissingMessage(): string {
  return 'Official Channels auto-enable skipped because Bun is not installed.';
}

export function getOfficialChannelsCompatibilityMessage(): string {
  return 'Official Channels auto-enable only applies to native Claude default/account sessions.';
}

export function getOfficialChannelsNoSelectionMessage(): string {
  return 'No official channels selected.';
}

export function getOfficialChannelsPermissionBypassMessage(): string {
  return '--dangerously-skip-permissions';
}

export function getOfficialChannelsSelectionSummary(selected: OfficialChannelId[]): string[] {
  return selected.map((channelId) => getOfficialChannelDisplayName(channelId));
}

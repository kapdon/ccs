import { initUI, header, ok, info, warn, fail, subheader, color, dim } from '../utils/ui';
import {
  getOfficialChannelsConfig,
  loadOrCreateUnifiedConfig,
  updateUnifiedConfig,
} from '../config/unified-config-loader';
import type { OfficialChannelId } from '../config/unified-config-types';
import { DEFAULT_OFFICIAL_CHANNELS_CONFIG } from '../config/unified-config-types';
import {
  clearConfiguredOfficialChannelTokensEverywhere,
  getOfficialChannelEnvPath,
  hasConfiguredOfficialChannelToken,
  setConfiguredOfficialChannelToken,
} from '../channels/official-channels-store';
import {
  expandOfficialChannelSelection,
  getChannelConfigSelectionLabel,
  getOfficialChannelChoices,
  getOfficialChannelDisplayName,
  getOfficialChannelEnvKey,
  getOfficialChannelManualSetupCommands,
  getOfficialChannelReadyMessage,
  getOfficialChannelsCompatibilityMessage,
  getOfficialChannelsDocsSummary,
  getOfficialChannelsLegacyEnableHelp,
  getOfficialChannelsSetHelp,
  getOfficialChannelTokenHelp,
  getOfficialChannelClearTokenHelp,
  getOfficialChannelMacOSHelp,
  getOfficialChannelSummary,
  getOfficialChannelsRuntimeNote,
  getOfficialChannelsSectionDescription,
  getOfficialChannelsSupportedProfiles,
  getOfficialChannelUnavailableReason,
  getOfficialChannelTokenIds,
  isBunAvailable,
  isOfficialChannelId,
  isOfficialChannelSelectionValid,
} from '../channels/official-channels-runtime';
import { extractOption, hasAnyFlag } from './arg-extractor';

interface ChannelsCommandOptions {
  enable: boolean;
  disable: boolean;
  clear: boolean;
  unattended: boolean;
  noUnattended: boolean;
  setSelection?: string;
  setSelectionMissing: boolean;
  clearTokenAll: boolean;
  clearTokenChannel?: OfficialChannelId;
  setToken?: { channelId: OfficialChannelId; token: string };
  setTokenMissing: boolean;
  clearTokenInvalid?: string;
  setTokenInvalid?: string;
  help: boolean;
}

function parseTokenAssignment(value: string): {
  channelId: OfficialChannelId;
  token: string;
} | null {
  const separatorIndex = value.indexOf('=');
  if (separatorIndex === -1) {
    return value.trim()
      ? { channelId: 'discord', token: value.trim() }
      : null;
  }

  const channelId = value.slice(0, separatorIndex).trim().toLowerCase();
  const token = value.slice(separatorIndex + 1).trim();
  if (!isOfficialChannelId(channelId) || !token) {
    return null;
  }

  return { channelId, token };
}

export function parseChannelsCommandArgs(args: string[]): ChannelsCommandOptions {
  const setSelection = extractOption(args, ['--set']);
  const setToken = extractOption(args, ['--set-token']);
  const clearToken = extractOption(args, ['--clear-token']);

  let clearTokenAll = false;
  let clearTokenChannel: OfficialChannelId | undefined;
  let clearTokenInvalid: string | undefined;
  if (clearToken.found) {
    if (clearToken.missingValue) {
      clearTokenAll = true;
    } else if (clearToken.value) {
      const channelId = clearToken.value.trim().toLowerCase();
      if (isOfficialChannelId(channelId)) {
        clearTokenChannel = channelId;
      } else {
        clearTokenInvalid = clearToken.value;
      }
    }
  }

  let parsedSetToken: { channelId: OfficialChannelId; token: string } | undefined;
  let setTokenInvalid: string | undefined;
  if (setToken.found && !setToken.missingValue && setToken.value) {
    parsedSetToken = parseTokenAssignment(setToken.value) ?? undefined;
    if (!parsedSetToken) {
      setTokenInvalid = setToken.value;
    }
  }

  return {
    enable: hasAnyFlag(args, ['--enable']),
    disable: hasAnyFlag(args, ['--disable']),
    clear: hasAnyFlag(args, ['--clear']),
    unattended: hasAnyFlag(args, ['--unattended']),
    noUnattended: hasAnyFlag(args, ['--no-unattended']),
    setSelection: setSelection.found ? setSelection.value : undefined,
    setSelectionMissing: setSelection.found && setSelection.missingValue,
    clearTokenAll,
    clearTokenChannel,
    clearTokenInvalid,
    setToken: parsedSetToken,
    setTokenMissing: setToken.found && setToken.missingValue,
    setTokenInvalid,
    help: hasAnyFlag(args, ['--help', '-h']),
  };
}

function showHelp(): void {
  console.log('');
  console.log(header('ccs config channels'));
  console.log('');
  console.log(`  ${getOfficialChannelsSectionDescription()}`);
  console.log(`  ${dim(getOfficialChannelsDocsSummary())}`);
  console.log('');
  console.log(subheader('Usage:'));
  console.log(`  ${color('ccs config channels', 'command')} [options]`);
  console.log('');
  console.log(subheader('Options:'));
  console.log(`  ${color('--set <csv|all>', 'command')}      ${getOfficialChannelsSetHelp()}`);
  console.log(`  ${color('--clear', 'command')}              Clear all selected channels`);
  console.log(`  ${color('--enable', 'command')}             Legacy alias: add Discord`);
  console.log(`  ${color('--disable', 'command')}            Legacy alias: remove Discord`);
  console.log(`  ${color('--unattended', 'command')}         Also add --dangerously-skip-permissions`);
  console.log(`  ${color('--no-unattended', 'command')}      Disable unattended runtime flag`);
  console.log(`  ${color('--set-token <spec>', 'command')}   ${getOfficialChannelTokenHelp()}`);
  console.log(`  ${color('--clear-token [channel]', 'command')} ${getOfficialChannelClearTokenHelp()}`);
  console.log(`  ${color('--help, -h', 'command')}           Show this help`);
  console.log('');
  console.log(subheader('Examples:'));
  console.log(`  $ ${color('ccs config channels', 'command')}                           ${dim('# Show status')}`);
  console.log(
    `  $ ${color('ccs config channels --set telegram,discord', 'command')}  ${dim('# Enable Telegram + Discord')}`
  );
  console.log(
    `  $ ${color('ccs config channels --set all', 'command')}               ${dim('# Enable all official channels')}`
  );
  console.log(
    `  $ ${color('ccs config channels --set-token telegram=123:abc', 'command')} ${dim('# Save TELEGRAM_BOT_TOKEN')}`
  );
  console.log(
    `  $ ${color('ccs config channels --clear-token discord', 'command')}   ${dim('# Clear one token')}`
  );
  console.log('');
}

function showStatus(): void {
  const config = getOfficialChannelsConfig();
  const selected = config.selected;
  const bunReady = isBunAvailable();

  console.log('');
  console.log(header('Official Channels Configuration'));
  console.log('');
  console.log(`  Channels:     ${selected.length > 0 ? ok(getChannelConfigSelectionLabel(selected)) : warn('Disabled')}`);
  console.log(`  Unattended:   ${config.unattended ? warn('Enabled') : info('Disabled')}`);
  console.log(`  Bun:          ${bunReady ? ok('Installed') : warn('Missing')}`);
  console.log('');
  console.log(subheader('Applies To:'));
  console.log(`  ${dim(getOfficialChannelsCompatibilityMessage())}`);
  console.log(`  ${dim(`Supported profiles: ${getOfficialChannelsSupportedProfiles().join(', ')}`)}`);
  console.log('');
  console.log(subheader('Channels:'));
  for (const channelId of expandOfficialChannelSelection('all')) {
    const displayName = getOfficialChannelDisplayName(channelId);
    const enabled = selected.includes(channelId);
    const envKey = getOfficialChannelEnvKey(channelId);
    const tokenConfigured = envKey ? hasConfiguredOfficialChannelToken(channelId) : true;
    const unavailableReason = getOfficialChannelUnavailableReason(channelId);
    const status = unavailableReason
      ? warn(unavailableReason)
      : envKey
        ? tokenConfigured
          ? ok('Ready')
          : warn(`${envKey} missing`)
        : ok('Ready');
    console.log(`  ${enabled ? '[x]' : '[ ]'} ${displayName}: ${status}`);
    console.log(`      ${dim(getOfficialChannelSummary(channelId))}`);
    if (envKey) {
      console.log(`      ${dim(`${envKey}: ${tokenConfigured ? 'configured' : 'not configured'}`)}`);
      console.log(`      ${dim(getOfficialChannelEnvPath(channelId))}`);
    }
    console.log(`      ${dim(getOfficialChannelReadyMessage(channelId))}`);
  }
  console.log('');
  console.log(subheader('Notes:'));
  console.log(`  ${dim(getOfficialChannelsLegacyEnableHelp())}`);
  console.log(`  ${dim(getOfficialChannelMacOSHelp())}`);
  console.log(`  ${dim(getOfficialChannelsRuntimeNote())}`);
  console.log('');
  console.log(subheader('Manual Claude Setup:'));
  for (const channelId of expandOfficialChannelSelection('all')) {
    console.log(`  ${dim(`${getOfficialChannelDisplayName(channelId)}:`)}`);
    for (const command of getOfficialChannelManualSetupCommands(channelId)) {
      console.log(`    ${color(command, 'command')}`);
    }
  }
  console.log('');
}

function resolveNextSelection(args: ChannelsCommandOptions): OfficialChannelId[] | null {
  if (args.setSelection !== undefined) {
    return expandOfficialChannelSelection(args.setSelection);
  }

  if (args.clear) {
    return [];
  }

  return null;
}

export async function handleConfigChannelsCommand(args: string[]): Promise<void> {
  await initUI();

  const options = parseChannelsCommandArgs(args);
  if (options.help) {
    showHelp();
    return;
  }

  if (options.setSelectionMissing) {
    console.error(fail(`--set requires a value (${getOfficialChannelChoices()} or all)`));
    process.exitCode = 1;
    return;
  }
  if (options.setSelection !== undefined && !isOfficialChannelSelectionValid(options.setSelection)) {
    console.error(fail(`Invalid --set value: ${options.setSelection} (${getOfficialChannelChoices()} or all)`));
    process.exitCode = 1;
    return;
  }
  if (options.setTokenMissing) {
    console.error(fail('--set-token requires a value'));
    process.exitCode = 1;
    return;
  }
  if (options.setTokenInvalid) {
    console.error(
      fail(`Invalid --set-token value: ${options.setTokenInvalid} (use <channel>=<token>)`)
    );
    process.exitCode = 1;
    return;
  }
  if (options.clearTokenInvalid) {
    console.error(
      fail(`Invalid --clear-token value: ${options.clearTokenInvalid} (use ${getOfficialChannelChoices()})`)
    );
    process.exitCode = 1;
    return;
  }

  const config = loadOrCreateUnifiedConfig();
  const nextConfig = {
    ...(config.channels ?? DEFAULT_OFFICIAL_CHANNELS_CONFIG),
    selected: [...(config.channels?.selected ?? DEFAULT_OFFICIAL_CHANNELS_CONFIG.selected)],
  };

  const explicitSelection = resolveNextSelection(options);
  const hasConfigMutation =
    explicitSelection !== null ||
    options.enable ||
    options.disable ||
    options.unattended ||
    options.noUnattended;
  if (explicitSelection) {
    nextConfig.selected = explicitSelection;
  }
  if (options.enable && !nextConfig.selected.includes('discord')) {
    nextConfig.selected.push('discord');
  }
  if (options.disable) {
    nextConfig.selected = nextConfig.selected.filter((channelId) => channelId !== 'discord');
  }
  if (options.unattended) {
    nextConfig.unattended = true;
  }
  if (options.noUnattended) {
    nextConfig.unattended = false;
  }

  try {
    if (hasConfigMutation) {
      updateUnifiedConfig({ channels: nextConfig });
    }

    if (options.setToken) {
      if (!getOfficialChannelTokenIds().includes(options.setToken.channelId)) {
        throw new Error(`${options.setToken.channelId} does not use a bot token.`);
      }
      setConfiguredOfficialChannelToken(options.setToken.channelId, options.setToken.token);
      console.log(ok(`${getOfficialChannelDisplayName(options.setToken.channelId)} token saved`));
      console.log('');
    }

    if (options.clearTokenChannel) {
      if (!getOfficialChannelTokenIds().includes(options.clearTokenChannel)) {
        throw new Error(`${options.clearTokenChannel} does not use a bot token.`);
      }
      clearConfiguredOfficialChannelTokensEverywhere(options.clearTokenChannel);
      console.log(ok(`${getOfficialChannelDisplayName(options.clearTokenChannel)} token cleared`));
      console.log('');
    } else if (options.clearTokenAll) {
      clearConfiguredOfficialChannelTokensEverywhere();
      console.log(ok('All saved channel tokens cleared'));
      console.log('');
    }

    if (hasConfigMutation) {
      console.log(ok('Configuration updated'));
      console.log('');
    }
  } catch (error) {
    console.error(fail((error as Error).message));
    process.exitCode = 1;
    return;
  }

  showStatus();
}

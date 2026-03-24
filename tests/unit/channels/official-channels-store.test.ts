import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  clearConfiguredOfficialChannelToken,
  clearConfiguredOfficialChannelTokensEverywhere,
  getOfficialChannelEnvPath,
  hasConfiguredOfficialChannelToken,
  readConfiguredOfficialChannelToken,
  readOfficialChannelTokenFromEnvContent,
  setConfiguredOfficialChannelToken,
  syncOfficialChannelEnvToConfigDir,
} from '../../../src/channels/official-channels-store';

describe('official channels token store', () => {
  let tempHome = '';
  let originalHome: string | undefined;
  let originalCcsHome: string | undefined;

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-discord-channels-'));
    originalHome = process.env.HOME;
    originalCcsHome = process.env.CCS_HOME;
    process.env.HOME = tempHome;
    process.env.CCS_HOME = tempHome;
  });

  afterEach(() => {
    if (originalHome !== undefined) process.env.HOME = originalHome;
    else delete process.env.HOME;

    if (originalCcsHome !== undefined) process.env.CCS_HOME = originalCcsHome;
    else delete process.env.CCS_HOME;

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it('writes and reads DISCORD_BOT_TOKEN from the canonical Discord env file', () => {
    const envPath = setConfiguredOfficialChannelToken('discord', 'discord-secret');

    expect(envPath).toBe(path.join(tempHome, '.claude', 'channels', 'discord', '.env'));
    expect(hasConfiguredOfficialChannelToken('discord')).toBe(true);
    expect(readConfiguredOfficialChannelToken('discord')).toBe('discord-secret');
    expect(readOfficialChannelTokenFromEnvContent('discord', fs.readFileSync(envPath, 'utf8'))).toBe(
      'discord-secret'
    );
  });

  it('writes and reads TELEGRAM_BOT_TOKEN from the canonical Telegram env file', () => {
    const envPath = setConfiguredOfficialChannelToken('telegram', 'telegram-secret');

    expect(envPath).toBe(path.join(tempHome, '.claude', 'channels', 'telegram', '.env'));
    expect(hasConfiguredOfficialChannelToken('telegram')).toBe(true);
    expect(readConfiguredOfficialChannelToken('telegram')).toBe('telegram-secret');
  });

  it('removes only the channel token entry and deletes the file when nothing remains', () => {
    const envPath = getOfficialChannelEnvPath('discord');
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    fs.writeFileSync(envPath, '# comment\nDISCORD_BOT_TOKEN=secret\nOTHER_KEY=value\n', 'utf8');

    clearConfiguredOfficialChannelToken('discord');
    expect(fs.readFileSync(envPath, 'utf8')).toBe('# comment\nOTHER_KEY=value\n');

    clearConfiguredOfficialChannelToken('discord');
    fs.writeFileSync(envPath, 'DISCORD_BOT_TOKEN=secret\n', 'utf8');
    clearConfiguredOfficialChannelToken('discord');
    expect(fs.existsSync(envPath)).toBe(false);
  });

  it('syncs the canonical env file into an alternate CLAUDE_CONFIG_DIR for account sessions', () => {
    setConfiguredOfficialChannelToken('discord', 'discord-secret');

    const targetConfigDir = path.join(tempHome, '.ccs', 'instances', 'work');
    const targetPath = path.join(targetConfigDir, 'channels', 'discord', '.env');
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, '# keep\nOTHER_KEY=value\n', 'utf8');

    const result = syncOfficialChannelEnvToConfigDir('discord', targetConfigDir);

    expect(result.synced).toBe(true);
    expect(result.targetPath).toBe(targetPath);
    expect(fs.readFileSync(targetPath, 'utf8')).toBe(
      '# keep\nOTHER_KEY=value\n\nDISCORD_BOT_TOKEN=discord-secret\n'
    );
    expect(fs.statSync(targetPath).mode & 0o777).toBe(0o600);
  });

  it('clears previously synced copies across managed Claude config dirs', () => {
    setConfiguredOfficialChannelToken('discord', 'discord-secret');
    setConfiguredOfficialChannelToken('telegram', 'telegram-secret');

    const instanceConfigDir = path.join(tempHome, '.ccs', 'instances', 'work');
    const instanceEnvPath = path.join(instanceConfigDir, 'channels', 'discord', '.env');
    const telegramEnvPath = path.join(instanceConfigDir, 'channels', 'telegram', '.env');

    syncOfficialChannelEnvToConfigDir('discord', instanceConfigDir);
    syncOfficialChannelEnvToConfigDir('telegram', instanceConfigDir);
    expect(fs.existsSync(instanceEnvPath)).toBe(true);
    expect(fs.existsSync(telegramEnvPath)).toBe(true);

    const clearedPaths = clearConfiguredOfficialChannelTokensEverywhere();

    expect(clearedPaths).toContain(getOfficialChannelEnvPath('discord'));
    expect(clearedPaths).toContain(getOfficialChannelEnvPath('telegram'));
    expect(clearedPaths).toContain(instanceEnvPath);
    expect(clearedPaths).toContain(telegramEnvPath);
    expect(fs.existsSync(getOfficialChannelEnvPath('discord'))).toBe(false);
    expect(fs.existsSync(getOfficialChannelEnvPath('telegram'))).toBe(false);
    expect(fs.existsSync(instanceEnvPath)).toBe(false);
    expect(fs.existsSync(telegramEnvPath)).toBe(false);
  });
});

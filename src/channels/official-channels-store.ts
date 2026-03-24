import * as fs from 'fs';
import * as path from 'path';
import { getCcsDir } from '../utils/config-manager';
import { getDefaultClaudeConfigDir } from '../utils/claude-config-path';
import type { OfficialChannelId } from '../config/unified-config-types';
import {
  getOfficialChannelEnvDir,
  getOfficialChannelEnvKey,
  getOfficialChannelTokenIds,
  isOfficialChannelTokenRequired,
} from './official-channels-runtime';

export interface DiscordChannelsSyncResult {
  synced: boolean;
  targetPath: string;
  reason?: 'missing_env' | 'missing_token' | 'already_current' | 'write_failed';
  error?: string;
}

export function getOfficialChannelEnvPath(
  channelId: OfficialChannelId,
  configDir = getDefaultClaudeConfigDir()
): string {
  return path.join(configDir, 'channels', getOfficialChannelEnvDir(channelId), '.env');
}

function readFileIfExists(filePath: string): string | null {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function formatEnvValue(value: string): string {
  return /^[A-Za-z0-9._:-]+$/.test(value) ? value : JSON.stringify(value);
}

function upsertEnvValue(content: string, key: string, value: string): string {
  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const nextLines: string[] = [];
  let replaced = false;

  for (const line of lines) {
    if (/^\s*$/.test(line) && nextLines.length === 0) {
      continue;
    }
    if (new RegExp(`^\\s*${key}\\s*=`).test(line)) {
      nextLines.push(`${key}=${formatEnvValue(value)}`);
      replaced = true;
      continue;
    }
    nextLines.push(line);
  }

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== '') {
      nextLines.push('');
    }
    nextLines.push(`${key}=${formatEnvValue(value)}`);
  }

  return `${nextLines.join('\n').replace(/\n+$/u, '')}\n`;
}

function removeEnvValue(content: string, key: string): string {
  const nextLines = content
    .split(/\r?\n/)
    .filter((line) => !new RegExp(`^\\s*${key}\\s*=`).test(line));

  while (nextLines.length > 0 && /^\s*$/.test(nextLines[0] ?? '')) {
    nextLines.shift();
  }
  while (nextLines.length > 0 && /^\s*$/.test(nextLines[nextLines.length - 1] ?? '')) {
    nextLines.pop();
  }

  return nextLines.length > 0 ? `${nextLines.join('\n')}\n` : '';
}

function writeSecureFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, content, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function clearOfficialChannelTokenAtPath(channelId: OfficialChannelId, filePath: string): boolean {
  const envKey = getOfficialChannelEnvKey(channelId);
  if (!envKey) {
    return false;
  }

  const currentContent = readFileIfExists(filePath);

  if (currentContent === null) {
    return false;
  }

  const nextContent = removeEnvValue(currentContent, envKey);
  if (nextContent.length === 0) {
    fs.rmSync(filePath, { force: true });
    return true;
  }

  writeSecureFile(filePath, nextContent);
  return true;
}

function listManagedClaudeConfigDirs(): string[] {
  const dirs = new Set<string>([getDefaultClaudeConfigDir()]);
  const processConfigDir = process.env.CLAUDE_CONFIG_DIR?.trim();

  if (processConfigDir) {
    dirs.add(path.resolve(processConfigDir));
  }

  const instancesDir = path.join(getCcsDir(), 'instances');
  if (!fs.existsSync(instancesDir)) {
    return [...dirs];
  }

  for (const entry of fs.readdirSync(instancesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      dirs.add(path.join(instancesDir, entry.name));
    }
  }

  return [...dirs];
}

export function normalizeDiscordBotToken(value: string): string | null {
  const normalized = value.trim();
  if (!normalized || /[\r\n]/.test(normalized)) {
    return null;
  }
  return normalized;
}

export function readOfficialChannelTokenFromEnvContent(
  channelId: OfficialChannelId,
  content: string
): string | null {
  const envKey = getOfficialChannelEnvKey(channelId);
  if (!envKey) {
    return null;
  }

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(new RegExp(`^\\s*${envKey}\\s*=\\s*(.*)\\s*$`));
    if (!match) {
      continue;
    }
    const parsed = parseEnvValue(match[1] ?? '');
    return parsed.length > 0 ? parsed : null;
  }

  return null;
}

export function readConfiguredOfficialChannelToken(channelId: OfficialChannelId): string | null {
  const content = readFileIfExists(getOfficialChannelEnvPath(channelId));
  return content ? readOfficialChannelTokenFromEnvContent(channelId, content) : null;
}

export function hasConfiguredOfficialChannelToken(channelId: OfficialChannelId): boolean {
  return readConfiguredOfficialChannelToken(channelId) !== null;
}

export function setConfiguredOfficialChannelToken(
  channelId: OfficialChannelId,
  token: string
): string {
  const envKey = getOfficialChannelEnvKey(channelId);
  if (!envKey) {
    throw new Error(`${channelId} does not use a bot token.`);
  }

  const normalized = normalizeDiscordBotToken(token);
  if (!normalized) {
    throw new Error(`${envKey} cannot be empty or multiline.`);
  }

  const envPath = getOfficialChannelEnvPath(channelId);
  const currentContent = readFileIfExists(envPath) ?? '';
  writeSecureFile(envPath, upsertEnvValue(currentContent, envKey, normalized));
  return envPath;
}

export function clearConfiguredOfficialChannelToken(channelId: OfficialChannelId): string {
  const envPath = getOfficialChannelEnvPath(channelId);
  clearOfficialChannelTokenAtPath(channelId, envPath);
  return envPath;
}

export function clearConfiguredOfficialChannelTokensEverywhere(
  channelId?: OfficialChannelId
): string[] {
  const clearedPaths: string[] = [];
  const channels = channelId ? [channelId] : getOfficialChannelTokenIds();

  for (const configDir of listManagedClaudeConfigDirs()) {
    for (const tokenChannelId of channels) {
      const envPath = getOfficialChannelEnvPath(tokenChannelId, configDir);
      if (clearOfficialChannelTokenAtPath(tokenChannelId, envPath)) {
        clearedPaths.push(envPath);
      }
    }
  }

  return clearedPaths;
}

export function syncOfficialChannelEnvToConfigDir(
  channelId: OfficialChannelId,
  targetConfigDir: string
): DiscordChannelsSyncResult {
  const envKey = getOfficialChannelEnvKey(channelId);
  if (!envKey) {
    return {
      synced: false,
      targetPath: getOfficialChannelEnvPath(channelId, targetConfigDir),
      reason: 'missing_token',
    };
  }

  const sourcePath = getOfficialChannelEnvPath(channelId);
  const targetPath = getOfficialChannelEnvPath(channelId, targetConfigDir);
  const token = readConfiguredOfficialChannelToken(channelId);

  if (!fs.existsSync(sourcePath)) {
    return { synced: false, targetPath, reason: 'missing_env' };
  }

  if (!token) {
    return { synced: false, targetPath, reason: 'missing_token' };
  }

  if (path.resolve(sourcePath) === path.resolve(targetPath)) {
    return { synced: false, targetPath, reason: 'already_current' };
  }

  try {
    const targetContent = readFileIfExists(targetPath) ?? '';
    writeSecureFile(targetPath, upsertEnvValue(targetContent, envKey, token));
    return { synced: true, targetPath };
  } catch (error) {
    return {
      synced: false,
      targetPath,
      reason: 'write_failed',
      error: (error as Error).message,
    };
  }
}

export function getOfficialChannelReadiness(channelId: OfficialChannelId): boolean {
  return isOfficialChannelTokenRequired(channelId)
    ? hasConfiguredOfficialChannelToken(channelId)
    : true;
}

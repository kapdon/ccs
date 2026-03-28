import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  copyApiProfile,
  discoverApiProfileOrphans,
  exportApiProfile,
  importApiProfileBundle,
  registerApiProfileOrphans,
} from '../../../src/api/services/profile-lifecycle-service';
import {
  loadConfigSafe,
  runWithScopedConfigDir,
  setGlobalConfigDir,
} from '../../../src/utils/config-manager';

describe('profile lifecycle service', () => {
  let tempHome = '';
  let originalCcsHome: string | undefined;
  let originalCcsDir: string | undefined;
  let originalUnifiedMode: string | undefined;

  function getScopedCcsDir(): string {
    return path.join(tempHome, '.ccs');
  }

  async function runInScopedCcsDir<T>(fn: () => T): Promise<T> {
    return await runWithScopedConfigDir(getScopedCcsDir(), fn);
  }

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-profile-lifecycle-'));
    originalCcsHome = process.env.CCS_HOME;
    originalCcsDir = process.env.CCS_DIR;
    originalUnifiedMode = process.env.CCS_UNIFIED_CONFIG;
    process.env.CCS_HOME = tempHome;
    delete process.env.CCS_DIR;
    delete process.env.CCS_UNIFIED_CONFIG;
    setGlobalConfigDir(undefined);
  });

  afterEach(() => {
    mock.restore();

    if (originalCcsHome === undefined) {
      delete process.env.CCS_HOME;
    } else {
      process.env.CCS_HOME = originalCcsHome;
    }

    if (originalCcsDir === undefined) {
      delete process.env.CCS_DIR;
    } else {
      process.env.CCS_DIR = originalCcsDir;
    }

    if (originalUnifiedMode === undefined) {
      delete process.env.CCS_UNIFIED_CONFIG;
    } else {
      process.env.CCS_UNIFIED_CONFIG = originalUnifiedMode;
    }

    setGlobalConfigDir(undefined);

    if (tempHome && fs.existsSync(tempHome)) {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });

  it('discovers only API profile orphans (skips registered and reserved names)', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });

    fs.writeFileSync(
      path.join(ccsDir, 'config.json'),
      JSON.stringify({ profiles: { glm: '~/.ccs/glm.settings.json' } }, null, 2) + '\n'
    );

    fs.writeFileSync(
      path.join(ccsDir, 'glm.settings.json'),
      JSON.stringify(
        { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'token' } },
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(
      path.join(ccsDir, 'extra.settings.json'),
      JSON.stringify(
        { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'token' } },
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(
      path.join(ccsDir, 'gemini.settings.json'),
      JSON.stringify(
        { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'token' } },
        null,
        2
      ) + '\n'
    );

    const result = await runInScopedCcsDir(() => discoverApiProfileOrphans());
    expect(result.orphans.map((orphan) => orphan.name)).toEqual(['extra']);
  });

  it('treats explicit empty names list as no-op during orphan registration', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });

    fs.writeFileSync(
      path.join(ccsDir, 'lonely.settings.json'),
      JSON.stringify(
        { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'token' } },
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(
      path.join(ccsDir, 'config.json'),
      JSON.stringify({ profiles: {} }, null, 2) + '\n'
    );

    const result = await runInScopedCcsDir(() => registerApiProfileOrphans({ names: [] }));
    expect(result.registered).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it('does not register orphan profiles when WebSearch hook setup fails', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });

    fs.writeFileSync(
      path.join(ccsDir, 'extra.settings.json'),
      JSON.stringify(
        { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'token' } },
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(path.join(ccsDir, 'config.json'), JSON.stringify({ profiles: {} }, null, 2) + '\n');

    const copyFileSpy = spyOn(fs, 'copyFileSync').mockImplementation(() => {
      throw new Error('copy failed');
    });

    const result = await runInScopedCcsDir(() => registerApiProfileOrphans({ names: ['extra'] }));
    const config = await runInScopedCcsDir(() => loadConfigSafe());

    expect(copyFileSpy).toHaveBeenCalled();
    expect(result.registered).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toContain('could not prepare the profile hook');
    expect(config.profiles.extra).toBeUndefined();
  });

  it('keeps orphan registration non-fatal when WebSearch is disabled', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });

    fs.writeFileSync(
      path.join(ccsDir, 'extra.settings.json'),
      JSON.stringify(
        { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'token' } },
        null,
        2
      ) + '\n'
    );
    fs.writeFileSync(path.join(ccsDir, 'config.json'), JSON.stringify({ profiles: {} }, null, 2) + '\n');
    fs.writeFileSync(path.join(ccsDir, 'config.yaml'), 'version: 12\nwebsearch:\n  enabled: false\n', 'utf8');

    const copyFileSpy = spyOn(fs, 'copyFileSync').mockImplementation(() => {
      throw new Error('copy should not run when WebSearch is disabled');
    });

    const result = await runInScopedCcsDir(() => registerApiProfileOrphans({ names: ['extra'] }));

    expect(copyFileSpy).not.toHaveBeenCalled();
    expect(result.registered).toEqual(['extra']);
    expect(result.skipped).toEqual([]);
  });

  it('redacts all sensitive env values during export when includeSecrets=false', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });

    fs.writeFileSync(
      path.join(ccsDir, 'config.json'),
      JSON.stringify({ profiles: { glm: '~/.ccs/glm.settings.json' } }, null, 2) + '\n'
    );
    fs.writeFileSync(
      path.join(ccsDir, 'glm.settings.json'),
      JSON.stringify(
        {
          env: {
            ANTHROPIC_BASE_URL: 'https://api.example.com',
            ANTHROPIC_AUTH_TOKEN: 'token-1',
            OPENROUTER_API_KEY: 'token-2',
          },
        },
        null,
        2
      ) + '\n'
    );

    const result = await runInScopedCcsDir(() => exportApiProfile('glm', false));
    expect(result.success).toBe(true);
    expect(result.bundle?.settings).toBeDefined();

    const env = (result.bundle?.settings.env as Record<string, unknown>) || {};
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('__CCS_REDACTED__');
    expect(env.OPENROUTER_API_KEY).toBe('__CCS_REDACTED__');
  });

  it('rejects invalid source profile names in copy flow', async () => {
    const result = await runInScopedCcsDir(() => copyApiProfile('../escape', 'safe-name'));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid source profile name');
  });

  it('rolls back copied settings when WebSearch hook setup fails', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });
    fs.writeFileSync(
      path.join(ccsDir, 'config.json'),
      JSON.stringify({ profiles: { source: '~/.ccs/source.settings.json' } }, null, 2) + '\n'
    );
    fs.writeFileSync(
      path.join(ccsDir, 'source.settings.json'),
      JSON.stringify(
        { env: { ANTHROPIC_BASE_URL: 'https://api.example.com', ANTHROPIC_AUTH_TOKEN: 'token' } },
        null,
        2
      ) + '\n'
    );

    const copyFileSpy = spyOn(fs, 'copyFileSync').mockImplementation(() => {
      throw new Error('copy failed');
    });

    const result = await runInScopedCcsDir(() => copyApiProfile('source', 'copy-dest'));

    expect(result.success).toBe(false);
    expect(result.error).toContain('could not prepare the profile hook');
    expect(copyFileSpy).toHaveBeenCalled();
    expect(fs.existsSync(path.join(ccsDir, 'copy-dest.settings.json'))).toBe(false);
  });

  it('rejects import bundle with invalid profile target', async () => {
    const result = await runInScopedCcsDir(() =>
      importApiProfileBundle({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        profile: { name: 'glm', target: 'invalid-target' },
        settings: {
          env: {
            ANTHROPIC_BASE_URL: 'https://api.example.com',
            ANTHROPIC_AUTH_TOKEN: 'token',
          },
        },
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid bundle profile target');
  });

  it('rolls back imported settings when WebSearch hook setup fails', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });
    fs.writeFileSync(
      path.join(ccsDir, 'config.json'),
      JSON.stringify({ profiles: {} }, null, 2) + '\n'
    );

    const copyFileSpy = spyOn(fs, 'copyFileSync').mockImplementation(() => {
      throw new Error('copy failed');
    });

    const result = await runInScopedCcsDir(() =>
      importApiProfileBundle({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        profile: { name: 'import-failure', target: 'claude' },
        settings: {
          env: {
            ANTHROPIC_BASE_URL: 'https://api.example.com',
            ANTHROPIC_AUTH_TOKEN: 'token',
          },
        },
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('could not prepare the profile hook');
    expect(copyFileSpy).toHaveBeenCalled();
    expect(fs.existsSync(path.join(ccsDir, 'import-failure.settings.json'))).toBe(false);
  });

  it('clears and warns for all redacted sensitive env keys on import', async () => {
    const ccsDir = path.join(tempHome, '.ccs');
    fs.mkdirSync(ccsDir, { recursive: true });
    fs.writeFileSync(
      path.join(ccsDir, 'config.json'),
      JSON.stringify({ profiles: {} }, null, 2) + '\n'
    );

    const result = await runInScopedCcsDir(() =>
      importApiProfileBundle({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        profile: { name: 'redacted-import', target: 'claude' },
        settings: {
          env: {
            ANTHROPIC_BASE_URL: 'https://api.example.com',
            ANTHROPIC_AUTH_TOKEN: '__CCS_REDACTED__',
            OPENROUTER_API_KEY: '__CCS_REDACTED__',
          },
        },
      })
    );

    expect(result.success).toBe(true);
    expect(result.warnings?.length).toBeGreaterThan(0);

    const settingsPath = path.join(ccsDir, 'redacted-import.settings.json');
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      env: Record<string, string>;
    };
    expect(parsed.env.ANTHROPIC_AUTH_TOKEN).toBe('');
    expect(parsed.env.OPENROUTER_API_KEY).toBe('');
  });
});

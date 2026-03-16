import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { getProviderCatalog, getModelMaxLevel } from '../../../src/cliproxy/model-catalog';
import {
  getDefaultCodexModel,
  getFreePlanFallbackCodexModel,
} from '../../../src/cliproxy/codex-plan-compatibility';

afterEach(() => {
  mock.restore();
});

describe('codex plan compatibility', () => {
  it('uses a cross-plan safe Codex default', () => {
    expect(getDefaultCodexModel()).toBe('gpt-5-codex');
    expect(getProviderCatalog('codex')?.defaultModel).toBe('gpt-5-codex');
  });

  it('maps paid-only free-plan models to safe fallbacks', () => {
    expect(getFreePlanFallbackCodexModel('gpt-5.3-codex')).toBe('gpt-5-codex');
    expect(getFreePlanFallbackCodexModel('gpt-5.3-codex-xhigh')).toBe('gpt-5-codex');
    expect(getFreePlanFallbackCodexModel('gpt-5.3-codex(high)')).toBe('gpt-5-codex');
    expect(getFreePlanFallbackCodexModel('gpt-5.4')).toBe('gpt-5-codex');
    expect(getFreePlanFallbackCodexModel('gpt-5.3-codex-spark')).toBe('gpt-5-codex-mini');
  });

  it('does not rewrite cross-plan or already-safe Codex models', () => {
    expect(getFreePlanFallbackCodexModel('gpt-5-codex')).toBeNull();
    expect(getFreePlanFallbackCodexModel('gpt-5.2-codex')).toBeNull();
    expect(getFreePlanFallbackCodexModel('gpt-5.1-codex-mini')).toBeNull();
  });

  it('tracks Codex thinking caps for current safe defaults and paid models', () => {
    expect(getModelMaxLevel('codex', 'gpt-5-codex')).toBe('high');
    expect(getModelMaxLevel('codex', 'gpt-5-codex-mini')).toBe('high');
    expect(getModelMaxLevel('codex', 'gpt-5.2-codex')).toBe('xhigh');
    expect(getModelMaxLevel('codex', 'gpt-5.3-codex')).toBe('xhigh');
  });

  it('repairs stale paid-only Codex settings for free-plan accounts before launch', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-codex-plan-compat-'));
    const settingsPath = path.join(tmpDir, 'codex.settings.json');

    fs.writeFileSync(
      settingsPath,
      JSON.stringify(
        {
          env: {
            ANTHROPIC_BASE_URL: 'http://127.0.0.1:8317/api/provider/codex',
            ANTHROPIC_AUTH_TOKEN: 'ccs-internal-managed',
            ANTHROPIC_MODEL: 'gpt-5.3-codex',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'gpt-5.3-codex',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'gpt-5.3-codex',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'gpt-5-codex-mini',
          },
        },
        null,
        2
      ),
      'utf-8'
    );

    mock.module('../../../src/cliproxy/account-manager', () => ({
      getDefaultAccount: () => ({ id: 'free@example.com' }),
    }));
    mock.module('../../../src/cliproxy/quota-fetcher-codex', () => ({
      fetchCodexQuota: async () => ({
        success: true,
        windows: [],
        coreUsage: { fiveHour: null, weekly: null },
        planType: 'free',
        lastUpdated: Date.now(),
        accountId: 'free@example.com',
      }),
    }));
    mock.module('../../../src/cliproxy/quota-response-cache', () => ({
      getCachedQuota: () => null,
      setCachedQuota: () => {},
    }));
    mock.module('../../../src/utils/ui', () => ({
      info: (message: string) => message,
      warn: (message: string) => message,
    }));

    const errorSpy = spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { reconcileCodexModelForActivePlan } = await import(
        `../../../src/cliproxy/codex-plan-compatibility?free-plan=${Date.now()}`
      );

      await reconcileCodexModelForActivePlan({
        settingsPath,
        currentModel: 'gpt-5.3-codex',
        verbose: false,
      });

      const repaired = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as {
        env: Record<string, string>;
      };
      expect(repaired.env.ANTHROPIC_MODEL).toBe('gpt-5-codex');
      expect(repaired.env.ANTHROPIC_DEFAULT_OPUS_MODEL).toBe('gpt-5-codex');
      expect(repaired.env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBe('gpt-5-codex');
      expect(repaired.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('gpt-5-codex-mini');
      expect(errorSpy).toHaveBeenCalledWith(
        'Codex free plan detected. Switched unsupported model "gpt-5.3-codex" to "gpt-5-codex".'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

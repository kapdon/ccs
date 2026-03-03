import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CliproxyUsageApiResponse } from '../../../src/cliproxy/stats-fetcher';

let ccsDir = '';
let rawResponse: CliproxyUsageApiResponse | null = null;
let fetchCalls = 0;

mock.module('../../../src/utils/config-manager', () => ({
  getCcsDir: () => ccsDir,
}));

mock.module('../../../src/cliproxy/stats-fetcher', () => ({
  fetchCliproxyUsageRaw: async () => {
    fetchCalls++;
    return rawResponse;
  },
}));

let syncer: typeof import('../../../src/web-server/usage/cliproxy-usage-syncer');

beforeAll(async () => {
  syncer = await import('../../../src/web-server/usage/cliproxy-usage-syncer');
});

beforeEach(() => {
  ccsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-cliproxy-syncer-'));
  fetchCalls = 0;
  rawResponse = {
    usage: {
      apis: {
        gemini: {
          models: {
            'gemini-2.5-pro': {
              details: [
                {
                  timestamp: '2026-03-02T12:00:00.000Z',
                  source: 'account-a',
                  auth_index: 0,
                  tokens: {
                    input_tokens: 100,
                    output_tokens: 20,
                    reasoning_tokens: 0,
                    cached_tokens: 10,
                    total_tokens: 130,
                  },
                  failed: false,
                },
              ],
            },
          },
        },
      },
    },
  };
  syncer.stopCliproxySync();
});

afterEach(() => {
  syncer.stopCliproxySync();
  fs.rmSync(ccsDir, { recursive: true, force: true });
});

afterAll(() => {
  mock.restore();
});

describe('cliproxy usage syncer', () => {
  it('writes and loads snapshot data', async () => {
    await syncer.syncCliproxyUsage();

    const snapshotPath = path.join(ccsDir, 'cache', 'cliproxy-usage', 'latest.json');
    expect(fs.existsSync(snapshotPath)).toBe(true);

    const cached = await syncer.loadCachedCliproxyData();
    expect(cached.daily).toHaveLength(1);
    expect(cached.daily[0].source).toBe('cliproxy');
    expect(cached.daily[0].inputTokens).toBe(100);
    expect(cached.hourly).toHaveLength(1);
    expect(cached.monthly).toHaveLength(1);
  });

  it('startCliproxySync is idempotent and starts only one interval', () => {
    const intervalSpy = spyOn(globalThis, 'setInterval');

    syncer.startCliproxySync();
    syncer.startCliproxySync();

    expect(intervalSpy).toHaveBeenCalledTimes(1);
    expect(fetchCalls).toBeGreaterThan(0);

    syncer.stopCliproxySync();
    intervalSpy.mockRestore();
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let tempRoot = '';
let ccsDir = '';
let claudeDir = '';
let aggregator: typeof import('../../../src/web-server/usage/aggregator');
let originalCcsDir: string | undefined;
let originalClaudeConfigDir: string | undefined;

function writeClaudeJsonlFixture(): void {
  const projectDir = path.join(claudeDir, 'projects', 'project-one');
  fs.mkdirSync(projectDir, { recursive: true });

  const line = JSON.stringify({
    type: 'assistant',
    sessionId: 'session-a',
    timestamp: '2026-03-02T10:00:00.000Z',
    version: '1.0.0',
    cwd: '/tmp/project',
    message: {
      model: 'claude-sonnet-4-5',
      usage: {
        input_tokens: 100,
        output_tokens: 40,
      },
    },
  });

  fs.writeFileSync(path.join(projectDir, 'usage.jsonl'), `${line}\n`, 'utf-8');
}

function writeCliproxySnapshotFixture(): void {
  const snapshotDir = path.join(ccsDir, 'cache', 'cliproxy-usage');
  fs.mkdirSync(snapshotDir, { recursive: true });

  const snapshot = {
    version: 1,
    timestamp: Date.now(),
    daily: [
      {
        date: '2026-03-02',
        source: 'cliproxy',
        inputTokens: 50,
        outputTokens: 10,
        cacheCreationTokens: 0,
        cacheReadTokens: 5,
        cost: 0.2,
        totalCost: 0.2,
        modelsUsed: ['gemini-2.5-pro'],
        modelBreakdowns: [
          {
            modelName: 'gemini-2.5-pro',
            inputTokens: 50,
            outputTokens: 10,
            cacheCreationTokens: 0,
            cacheReadTokens: 5,
            cost: 0.2,
          },
        ],
      },
    ],
    hourly: [
      {
        hour: '2026-03-02 10:00',
        source: 'cliproxy',
        inputTokens: 50,
        outputTokens: 10,
        cacheCreationTokens: 0,
        cacheReadTokens: 5,
        cost: 0.2,
        totalCost: 0.2,
        modelsUsed: ['gemini-2.5-pro'],
        modelBreakdowns: [
          {
            modelName: 'gemini-2.5-pro',
            inputTokens: 50,
            outputTokens: 10,
            cacheCreationTokens: 0,
            cacheReadTokens: 5,
            cost: 0.2,
          },
        ],
      },
    ],
    monthly: [
      {
        month: '2026-03',
        source: 'cliproxy',
        inputTokens: 50,
        outputTokens: 10,
        cacheCreationTokens: 0,
        cacheReadTokens: 5,
        totalCost: 0.2,
        modelsUsed: ['gemini-2.5-pro'],
        modelBreakdowns: [
          {
            modelName: 'gemini-2.5-pro',
            inputTokens: 50,
            outputTokens: 10,
            cacheCreationTokens: 0,
            cacheReadTokens: 5,
            cost: 0.2,
          },
        ],
      },
    ],
  };

  fs.writeFileSync(path.join(snapshotDir, 'latest.json'), JSON.stringify(snapshot), 'utf-8');
}

function writeUnifiedConfigFixture(): void {
  const yaml = `version: 2
accounts: {}
profiles: {}
preferences:
  theme: system
  telemetry: false
  auto_update: true
cliproxy:
  oauth_accounts: {}
  providers:
    - gemini
    - codex
    - agy
  variants: {}
cliproxy_server:
  local:
    port: 65534
`;

  fs.mkdirSync(ccsDir, { recursive: true });
  fs.writeFileSync(path.join(ccsDir, 'config.yaml'), yaml, 'utf-8');
}

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-usage-agg-'));
  ccsDir = path.join(tempRoot, '.ccs');
  claudeDir = path.join(tempRoot, '.claude');

  originalCcsDir = process.env.CCS_DIR;
  originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
  process.env.CCS_DIR = ccsDir;
  process.env.CLAUDE_CONFIG_DIR = claudeDir;

  writeUnifiedConfigFixture();
  writeClaudeJsonlFixture();
  writeCliproxySnapshotFixture();

  aggregator = await import('../../../src/web-server/usage/aggregator');
  aggregator.clearUsageCache();
});

afterEach(() => {
  aggregator.shutdownUsageAggregator();
  aggregator.clearUsageCache();

  if (originalCcsDir !== undefined) {
    process.env.CCS_DIR = originalCcsDir;
  } else {
    delete process.env.CCS_DIR;
  }

  if (originalClaudeConfigDir !== undefined) {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
  } else {
    delete process.env.CLAUDE_CONFIG_DIR;
  }

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('usage aggregator cliproxy integration', () => {
  it('merges cliproxy snapshot data into getCachedDailyData', async () => {
    const daily = await aggregator.getCachedDailyData();

    expect(daily).toHaveLength(1);
    expect(daily[0].date).toBe('2026-03-02');
    expect(daily[0].inputTokens).toBe(150);
    expect(daily[0].outputTokens).toBe(50);
    expect(daily[0].cacheReadTokens).toBe(5);
    expect(daily[0].modelsUsed).toContain('claude-sonnet-4-5');
    expect(daily[0].modelsUsed).toContain('gemini-2.5-pro');
  });

  it('clearUsageCache resets last fetch timestamp', async () => {
    await aggregator.getCachedDailyData();
    expect(aggregator.getLastFetchTimestamp()).not.toBeNull();

    aggregator.clearUsageCache();
    expect(aggregator.getLastFetchTimestamp()).toBeNull();
  });
});

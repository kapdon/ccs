import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getWebSearchReadiness } from '../../../../src/utils/websearch/status';

function writeWebSearchConfig(tempRoot: string, lines: string[]): void {
  fs.writeFileSync(path.join(tempRoot, '.ccs', 'config.yaml'), lines.join('\n'), 'utf8');
}

describe('websearch readiness', () => {
  const originalCcsHome = process.env.CCS_HOME;
  const originalBraveKey = process.env.BRAVE_API_KEY;
  const originalExaKey = process.env.EXA_API_KEY;
  const originalTavilyKey = process.env.TAVILY_API_KEY;
  let tempRoot = '';

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-websearch-status-'));
    process.env.CCS_HOME = tempRoot;
    delete process.env.BRAVE_API_KEY;
    delete process.env.EXA_API_KEY;
    delete process.env.TAVILY_API_KEY;
    fs.mkdirSync(path.join(tempRoot, '.ccs'), { recursive: true });
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) process.env.CCS_HOME = originalCcsHome;
    else delete process.env.CCS_HOME;

    if (originalBraveKey !== undefined) process.env.BRAVE_API_KEY = originalBraveKey;
    else delete process.env.BRAVE_API_KEY;

    if (originalExaKey !== undefined) process.env.EXA_API_KEY = originalExaKey;
    else delete process.env.EXA_API_KEY;

    if (originalTavilyKey !== undefined) process.env.TAVILY_API_KEY = originalTavilyKey;
    else delete process.env.TAVILY_API_KEY;

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('is ready by default because DuckDuckGo is enabled', () => {
    const readiness = getWebSearchReadiness();

    expect(readiness.readiness).toBe('ready');
    expect(readiness.message).toContain('DuckDuckGo');
  });

  it('reports setup required when only Tavily is enabled without an API key', () => {
    writeWebSearchConfig(tempRoot, [
      'version: 10',
      'websearch:',
      '  enabled: true',
      '  providers:',
      '    exa:',
      '      enabled: false',
      '      max_results: 5',
      '    tavily:',
      '      enabled: true',
      '      max_results: 5',
      '    duckduckgo:',
      '      enabled: false',
      '      max_results: 5',
      '    brave:',
      '      enabled: false',
      '      max_results: 5',
      '    gemini:',
      '      enabled: false',
      '      model: "gemini-2.5-flash"',
      '      timeout: 55',
      '    opencode:',
      '      enabled: false',
      '      model: "opencode/grok-code"',
      '      timeout: 90',
      '    grok:',
      '      enabled: false',
      '      timeout: 55',
      '',
    ]);

    const readiness = getWebSearchReadiness();

    expect(readiness.readiness).toBe('needs_setup');
    expect(readiness.message).toContain('Tavily');
    expect(readiness.message).toContain('TAVILY_API_KEY');
  });

  it('prefers API-backed readiness when Exa is enabled and configured', () => {
    process.env.EXA_API_KEY = 'exa-test-key';
    writeWebSearchConfig(tempRoot, [
      'version: 10',
      'websearch:',
      '  enabled: true',
      '  providers:',
      '    exa:',
      '      enabled: true',
      '      max_results: 5',
      '    tavily:',
      '      enabled: false',
      '      max_results: 5',
      '    duckduckgo:',
      '      enabled: false',
      '      max_results: 5',
      '    brave:',
      '      enabled: false',
      '      max_results: 5',
      '    gemini:',
      '      enabled: false',
      '      model: "gemini-2.5-flash"',
      '      timeout: 55',
      '    opencode:',
      '      enabled: false',
      '      model: "opencode/grok-code"',
      '      timeout: 90',
      '    grok:',
      '      enabled: false',
      '      timeout: 55',
      '',
    ]);

    const readiness = getWebSearchReadiness();

    expect(readiness.readiness).toBe('ready');
    expect(readiness.message).toContain('Exa');
  });
});

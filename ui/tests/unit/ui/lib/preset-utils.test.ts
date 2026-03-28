import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MODEL_CATALOGS,
  findCatalogModel,
  getResolvedCatalogModels,
  resolveCatalogModelId,
} from '@/lib/model-catalogs';
import { applyDefaultPreset } from '@/lib/preset-utils';

describe('claude preset utils', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps the claude catalog default on Sonnet 4.6', () => {
    const claudeCatalog = MODEL_CATALOGS.claude;

    expect(claudeCatalog.defaultModel).toBe('claude-sonnet-4-6');
    expect(claudeCatalog.models.map((model) => model.id)).toContain('claude-sonnet-4-6');
  });

  it('applies the default claude preset from the catalog default model mapping', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ apiKey: { value: 'managed-key' } }),
      })
      .mockResolvedValueOnce({ ok: true });

    vi.stubGlobal('fetch', fetchMock);

    const result = await applyDefaultPreset('claude');

    expect(result).toEqual({ success: true, presetName: 'Claude Sonnet 4.6' });

    const [, requestInit] = fetchMock.mock.calls[1] ?? [];
    const body = JSON.parse(String(requestInit?.body));

    expect(body.settings.env).toMatchObject({
      ANTHROPIC_MODEL: 'claude-sonnet-4-6',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-6',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-6',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5-20251001',
    });
  });

  it('keeps Gemini presets on 3.1 Pro while resolving 3/3.1 alias variants', () => {
    const geminiCatalog = MODEL_CATALOGS.gemini;
    const latestPro = geminiCatalog.models.find((model) => model.id === 'gemini-3.1-pro-preview');

    expect(latestPro?.name).toBe('Gemini Pro');
    expect(latestPro?.presetMapping?.default).toBe('gemini-3.1-pro-preview');
    expect(findCatalogModel('gemini', 'gemini-3-pro-preview')?.id).toBe('gemini-3.1-pro-preview');
    expect(findCatalogModel('gemini', 'gemini-3.1-flash-preview')?.id).toBe(
      'gemini-3-flash-preview'
    );
  });

  it('resolves Gemini preview presets to the best live family match', () => {
    const availableModels = [
      { id: 'gemini-3.9-pro-preview-customtools', owned_by: 'antigravity' },
      { id: 'gemini-3.9-pro-preview', owned_by: 'antigravity' },
      { id: 'gemini-3-9-flash-preview-customtools', owned_by: 'antigravity' },
      { id: 'gemini-3-9-flash-preview', owned_by: 'antigravity' },
      { id: 'gemini-3.1-pro-preview', owned_by: 'antigravity' },
    ];

    expect(resolveCatalogModelId('gemini-3.1-pro-preview', availableModels)).toBe(
      'gemini-3.9-pro-preview'
    );
    expect(resolveCatalogModelId('gemini-3-flash-preview', availableModels)).toBe(
      'gemini-3-9-flash-preview'
    );
    expect(findCatalogModel('agy', 'gemini-3.9-pro-preview')?.id).toBe('gemini-3.1-pro-preview');

    const resolvedAgyModels = getResolvedCatalogModels(MODEL_CATALOGS.agy, availableModels);
    expect(resolvedAgyModels.find((model) => model.name === 'Gemini Pro')?.id).toBe(
      'gemini-3.9-pro-preview'
    );
    expect(resolvedAgyModels.find((model) => model.name === 'Gemini Flash')?.id).toBe(
      'gemini-3-9-flash-preview'
    );
  });

  it('does not silently swap Gemini Flash presets to flash-lite', () => {
    const availableModels = [{ id: 'gemini-3.1-flash-lite-preview', owned_by: 'google' }];

    expect(resolveCatalogModelId('gemini-3-flash-preview', availableModels)).toBe(
      'gemini-3-flash-preview'
    );
  });

  it('passes through non-Gemini model ids unchanged', () => {
    expect(resolveCatalogModelId('claude-sonnet-4-6')).toBe('claude-sonnet-4-6');
  });

  it('falls back to the catalog id when no live model matches', () => {
    expect(resolveCatalogModelId('gemini-3.1-pro-preview', [])).toBe('gemini-3.1-pro-preview');
    expect(
      resolveCatalogModelId('gemini-3.1-pro-preview', [
        { id: 'gemini-2.5-pro', owned_by: 'google' },
      ])
    ).toBe('gemini-3.1-pro-preview');
  });
});

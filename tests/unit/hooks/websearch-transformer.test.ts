import { describe, expect, it } from 'bun:test';

const hook = require('../../../lib/hooks/websearch-transformer.cjs') as {
  extractDuckDuckGoResults: (html: string, count: number) => Array<{
    title: string;
    url: string;
    description: string;
  }>;
  formatStructuredSearchResults: (
    query: string,
    providerName: string,
    results: Array<{ title: string; url: string; description: string }>
  ) => string;
};

describe('websearch-transformer hook helpers', () => {
  it('extracts DuckDuckGo results and unwraps uddg redirect URLs', () => {
    const html = `
      <a class="result__a" href="/l/?uddg=https%3A%2F%2Fexample.com%2Farticle">Example title</a>
      <a class="result__snippet">Example snippet</a>
      <a class="result__a" href="https://second.example.com/post">Second title</a>
      <a class="result__snippet">Second snippet</a>
    `;

    const results = hook.extractDuckDuckGoResults(html, 2);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: 'Example title',
      url: 'https://example.com/article',
      description: 'Example snippet',
    });
    expect(results[1]).toEqual({
      title: 'Second title',
      url: 'https://second.example.com/post',
      description: 'Second snippet',
    });
  });

  it('formats structured search results for hook deny output', () => {
    const formatted = hook.formatStructuredSearchResults('ccs websearch', 'DuckDuckGo', [
      {
        title: 'Result title',
        url: 'https://example.com',
        description: 'Result snippet',
      },
    ]);

    expect(formatted).toContain('Search results for "ccs websearch" via DuckDuckGo');
    expect(formatted).toContain('1. Result title');
    expect(formatted).toContain('https://example.com');
    expect(formatted).toContain('Result snippet');
  });
});

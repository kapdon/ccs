#!/usr/bin/env node
/**
 * CCS WebSearch Hook - deterministic search backends with legacy CLI fallback
 *
 * Primary providers:
 *   - Exa Search API
 *   - Tavily Search API
 *   - Brave Search API
 *   - DuckDuckGo HTML search
 *
 * Legacy compatibility fallback:
 *   - Gemini CLI
 *   - OpenCode
 *   - Grok CLI
 */

const { spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';
const DEFAULT_TIMEOUT_SEC = 55;
const DEFAULT_RESULT_COUNT = 5;
const MIN_VALID_RESPONSE_LENGTH = 20;
const EXA_URL = 'https://api.exa.ai/search';
const TAVILY_URL = 'https://api.tavily.com/search';
const DDG_URL = 'https://html.duckduckgo.com/html/';
const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const SHARED_INSTRUCTIONS = `Instructions:
1. Search the web for current, up-to-date information
2. Provide a comprehensive summary of the search results
3. Include relevant URLs/sources when available
4. Be concise but thorough - prioritize key facts
5. Focus on factual information from reliable sources
6. If results conflict, note the discrepancy
7. Format output clearly with sections if the topic is complex`;

const PROVIDER_CONFIG = {
  gemini: {
    model: 'gemini-2.5-flash',
    toolInstruction: 'Use the google_web_search tool to find current information.',
    quirks: null,
  },
  opencode: {
    model: 'opencode/grok-code',
    toolInstruction: 'Search the web using your built-in capabilities.',
    quirks: null,
  },
  grok: {
    model: 'grok-3',
    toolInstruction: 'Use your web search capabilities to find information.',
    quirks: 'For breaking news or real-time events, also check X/Twitter if relevant.',
  },
};

const ddgLinkRe = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
const ddgSnippetRe = /<a class="result__snippet[^"]*".*?>([\s\S]*?)<\/a>/g;
const htmlTagRe = /<[^>]+>/g;

function debug(message) {
  if (process.env.CCS_DEBUG) {
    console.error(`[CCS Hook] ${message}`);
  }
}

function shouldSkipHook() {
  if (process.env.CCS_WEBSEARCH_SKIP === '1') return true;
  const profileType = process.env.CCS_PROFILE_TYPE;
  if (profileType === 'account' || profileType === 'default') return true;
  if (process.env.CCS_WEBSEARCH_ENABLED === '0') return true;
  return false;
}

function isCliAvailable(cmd) {
  try {
    const whichCmd = isWindows ? 'where.exe' : 'which';
    const result = spawnSync(whichCmd, [cmd], {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.status === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

function isProviderEnabled(provider) {
  return process.env[`CCS_WEBSEARCH_${provider.toUpperCase()}`] === '1';
}

function hasEnvValue(name) {
  return (process.env[name] || '').trim().length > 0;
}

function getFirstEnvValue(names) {
  for (const name of names) {
    if (hasEnvValue(name)) {
      return process.env[name].trim();
    }
  }
  return '';
}

function getProviderApiKey(providerId) {
  switch (providerId) {
    case 'brave':
      return getFirstEnvValue(['BRAVE_API_KEY', 'CCS_WEBSEARCH_BRAVE_API_KEY']);
    case 'exa':
      return getFirstEnvValue(['EXA_API_KEY', 'CCS_WEBSEARCH_EXA_API_KEY']);
    case 'tavily':
      return getFirstEnvValue(['TAVILY_API_KEY', 'CCS_WEBSEARCH_TAVILY_API_KEY']);
    default:
      return '';
  }
}

function getResultCount(provider) {
  const raw = process.env[`CCS_WEBSEARCH_${provider.toUpperCase()}_MAX_RESULTS`];
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10) : DEFAULT_RESULT_COUNT;
}

function buildPrompt(providerId, query) {
  const config = PROVIDER_CONFIG[providerId];
  const parts = [
    `Search the web for: ${query}`,
    '',
    config.toolInstruction,
    '',
    SHARED_INSTRUCTIONS,
  ];
  if (config.quirks) {
    parts.push('', `Note: ${config.quirks}`);
  }
  return parts.join('\n');
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function compactText(value, maxLength = 280) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function extractDuckDuckGoResults(html, count) {
  const links = [...html.matchAll(ddgLinkRe)].slice(0, count + 5);
  const snippets = [...html.matchAll(ddgSnippetRe)].slice(0, count + 5);

  return links.slice(0, count).map((match, index) => {
    let url = match[1];
    if (url.includes('uddg=')) {
      try {
        const decoded = decodeURIComponent(url);
        const uddgIndex = decoded.indexOf('uddg=');
        if (uddgIndex !== -1) {
          url = decoded.slice(uddgIndex + 5).split('&')[0];
        }
      } catch {
        // keep original url
      }
    }

    return {
      title: decodeHtml(match[2].replace(htmlTagRe, '').trim()),
      url,
      description: decodeHtml((snippets[index]?.[1] || '').replace(htmlTagRe, '').trim()),
    };
  });
}

function formatStructuredSearchResults(query, providerName, results) {
  if (!results.length) {
    return `No search results found for "${query}" via ${providerName}.`;
  }

  const lines = [`Search results for "${query}" via ${providerName}:`, ''];
  for (const [index, result] of results.entries()) {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(`   ${result.url}`);
    if (result.description) {
      lines.push(`   ${result.description}`);
    }
    lines.push('');
  }
  lines.push('Use these results to answer the user directly.');
  return lines.join('\n');
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryBraveSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  const apiKey = getProviderApiKey('brave');
  if (!apiKey) {
    return { success: false, error: 'BRAVE_API_KEY is not set' };
  }

  const params = new URLSearchParams({
    q: query,
    count: String(getResultCount('brave')),
  });

  try {
    const response = await fetchWithTimeout(
      `${BRAVE_URL}?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          'X-Subscription-Token': apiKey,
        },
      },
      timeoutSec * 1000
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Brave Search returned ${response.status}: ${body.slice(0, 160)}`,
      };
    }

    const body = await response.json();
    const results = (body.web?.results || []).map((result) => ({
      title: result.title || 'Untitled',
      url: result.url || '',
      description: result.description || '',
    }));

    return {
      success: true,
      content: formatStructuredSearchResults(query, 'Brave Search', results),
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === 'AbortError' ? 'Brave Search timed out' : error.message,
    };
  }
}

async function tryExaSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  const apiKey = getProviderApiKey('exa');
  if (!apiKey) {
    return { success: false, error: 'EXA_API_KEY is not set' };
  }

  try {
    const response = await fetchWithTimeout(
      EXA_URL,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          query,
          type: 'auto',
          numResults: getResultCount('exa'),
          text: true,
        }),
      },
      timeoutSec * 1000
    );

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `Exa returned ${response.status}: ${body.slice(0, 160)}` };
    }

    const body = await response.json();
    const results = (body.results || []).map((result) => ({
      title: compactText(result.title || result.url || 'Untitled', 120),
      url: result.url || '',
      description: compactText(result.text || result.summary || '', 240),
    }));

    return {
      success: true,
      content: formatStructuredSearchResults(query, 'Exa', results),
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === 'AbortError' ? 'Exa timed out' : error.message,
    };
  }
}

async function tryTavilySearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  const apiKey = getProviderApiKey('tavily');
  if (!apiKey) {
    return { success: false, error: 'TAVILY_API_KEY is not set' };
  }

  try {
    const response = await fetchWithTimeout(
      TAVILY_URL,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          max_results: getResultCount('tavily'),
          include_answer: false,
          include_raw_content: false,
        }),
      },
      timeoutSec * 1000
    );

    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: `Tavily returned ${response.status}: ${body.slice(0, 160)}` };
    }

    const body = await response.json();
    const results = (body.results || []).map((result) => ({
      title: compactText(result.title || result.url || 'Untitled', 120),
      url: result.url || '',
      description: compactText(result.content || '', 240),
    }));

    return {
      success: true,
      content: formatStructuredSearchResults(query, 'Tavily', results),
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === 'AbortError' ? 'Tavily timed out' : error.message,
    };
  }
}

async function tryDuckDuckGoSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  try {
    const params = new URLSearchParams({ q: query });
    const response = await fetchWithTimeout(
      `${DDG_URL}?${params.toString()}`,
      {
        headers: {
          Accept: 'text/html',
          'User-Agent': USER_AGENT,
        },
      },
      timeoutSec * 1000
    );

    if (!response.ok) {
      return { success: false, error: `DuckDuckGo returned ${response.status}` };
    }

    const html = await response.text();
    const results = extractDuckDuckGoResults(html, getResultCount('duckduckgo'));
    return {
      success: true,
      content: formatStructuredSearchResults(query, 'DuckDuckGo', results),
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === 'AbortError' ? 'DuckDuckGo timed out' : error.message,
    };
  }
}

function shouldRetryGeminiWithLegacyPrompt(errorMessage) {
  const lower = (errorMessage || '').toLowerCase();
  return (
    lower.includes('unknown option') ||
    lower.includes('unknown argument') ||
    lower.includes('unrecognized option') ||
    lower.includes('usage: gemini') ||
    lower.includes('use --prompt') ||
    lower.includes('using the --prompt option')
  );
}

function runGeminiCommand(args, timeoutMs) {
  const result = spawnSync('gemini', args, {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 2,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: isWindows,
  });

  if (result.error) {
    if (result.error.code === 'ENOENT')
      return { success: false, error: 'Gemini CLI not installed' };
    throw result.error;
  }
  if (result.status !== 0) {
    return {
      success: false,
      error: (result.stderr || '').trim() || `Gemini CLI exited with code ${result.status}`,
    };
  }

  const output = (result.stdout || '').trim();
  if (!output || output.length < MIN_VALID_RESPONSE_LENGTH) {
    return { success: false, error: 'Empty or too short response from Gemini' };
  }
  return { success: true, content: output };
}

function tryGeminiSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  try {
    const timeoutMs = timeoutSec * 1000;
    const model = process.env.CCS_WEBSEARCH_GEMINI_MODEL || PROVIDER_CONFIG.gemini.model;
    const prompt = buildPrompt('gemini', query);
    const baseArgs = ['--model', model, '--yolo'];

    debug(`Executing Gemini legacy fallback with model ${model}`);
    const positionalResult = runGeminiCommand([...baseArgs, prompt], timeoutMs);
    if (positionalResult.success || !shouldRetryGeminiWithLegacyPrompt(positionalResult.error)) {
      return positionalResult;
    }

    return runGeminiCommand([...baseArgs, '-p', prompt], timeoutMs);
  } catch (error) {
    return {
      success: false,
      error: error.killed ? 'Gemini CLI timed out' : error.message || 'Unknown Gemini error',
    };
  }
}

function tryOpenCodeSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  try {
    const model = process.env.CCS_WEBSEARCH_OPENCODE_MODEL || PROVIDER_CONFIG.opencode.model;
    const result = spawnSync(
      'opencode',
      ['run', buildPrompt('opencode', query), '--model', model],
      {
        encoding: 'utf8',
        timeout: timeoutSec * 1000,
        maxBuffer: 1024 * 1024 * 2,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: isWindows,
      }
    );

    if (result.error) {
      if (result.error.code === 'ENOENT')
        return { success: false, error: 'OpenCode not installed' };
      throw result.error;
    }
    if (result.status !== 0) {
      return {
        success: false,
        error: (result.stderr || '').trim() || `OpenCode exited with code ${result.status}`,
      };
    }

    const output = (result.stdout || '').trim();
    if (!output || output.length < MIN_VALID_RESPONSE_LENGTH) {
      return { success: false, error: 'Empty or too short response from OpenCode' };
    }
    return { success: true, content: output };
  } catch (error) {
    return {
      success: false,
      error: error.killed ? 'OpenCode timed out' : error.message || 'Unknown OpenCode error',
    };
  }
}

function tryGrokSearch(query, timeoutSec = DEFAULT_TIMEOUT_SEC) {
  try {
    const result = spawnSync('grok', [buildPrompt('grok', query)], {
      encoding: 'utf8',
      timeout: timeoutSec * 1000,
      maxBuffer: 1024 * 1024 * 2,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: isWindows,
    });

    if (result.error) {
      if (result.error.code === 'ENOENT')
        return { success: false, error: 'Grok CLI not installed' };
      throw result.error;
    }
    if (result.status !== 0) {
      return {
        success: false,
        error: (result.stderr || '').trim() || `Grok CLI exited with code ${result.status}`,
      };
    }

    const output = (result.stdout || '').trim();
    if (!output || output.length < MIN_VALID_RESPONSE_LENGTH) {
      return { success: false, error: 'Empty or too short response from Grok' };
    }
    return { success: true, content: output };
  } catch (error) {
    return {
      success: false,
      error: error.killed ? 'Grok CLI timed out' : error.message || 'Unknown Grok error',
    };
  }
}

function outputSuccess(query, content, providerName) {
  const output = {
    decision: 'block',
    reason: `WebSearch handled via ${providerName}`,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `[WebSearch Result via ${providerName}]\n\nQuery: "${query}"\n\n${content}`,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

function outputAllFailedMessage(query, errors) {
  const detail = errors.map((entry) => `${entry.provider}: ${entry.error}`).join(' | ');
  const output = {
    decision: 'block',
    reason: 'WebSearch fallback failed',
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `WebSearch could not be completed for "${query}". ${detail}`,
    },
  };

  console.log(JSON.stringify(output));
  process.exit(2);
}

async function processHook(input) {
  try {
    if (shouldSkipHook()) {
      process.exit(0);
    }

    const data = JSON.parse(input);
    if (data.tool_name !== 'WebSearch') {
      process.exit(0);
    }

    const query = data.tool_input?.query || '';
    if (!query) {
      process.exit(0);
    }

    const timeout = Number.parseInt(
      process.env.CCS_WEBSEARCH_TIMEOUT || `${DEFAULT_TIMEOUT_SEC}`,
      10
    );
    const providers = [
      {
        name: 'Exa',
        id: 'exa',
        available: () => isProviderEnabled('exa') && Boolean(getProviderApiKey('exa')),
        fn: tryExaSearch,
      },
      {
        name: 'Tavily',
        id: 'tavily',
        available: () => isProviderEnabled('tavily') && Boolean(getProviderApiKey('tavily')),
        fn: tryTavilySearch,
      },
      {
        name: 'Brave Search',
        id: 'brave',
        available: () => isProviderEnabled('brave') && Boolean(getProviderApiKey('brave')),
        fn: tryBraveSearch,
      },
      {
        name: 'DuckDuckGo',
        id: 'duckduckgo',
        available: () => isProviderEnabled('duckduckgo'),
        fn: tryDuckDuckGoSearch,
      },
      {
        name: 'Gemini CLI',
        id: 'gemini',
        available: () => isProviderEnabled('gemini') && isCliAvailable('gemini'),
        fn: tryGeminiSearch,
      },
      {
        name: 'OpenCode',
        id: 'opencode',
        available: () => isProviderEnabled('opencode') && isCliAvailable('opencode'),
        fn: tryOpenCodeSearch,
      },
      {
        name: 'Grok CLI',
        id: 'grok',
        available: () => isProviderEnabled('grok') && isCliAvailable('grok'),
        fn: tryGrokSearch,
      },
    ];

    const activeProviders = providers.filter((provider) => provider.available());
    debug(
      `Enabled providers: ${activeProviders.map((provider) => provider.name).join(', ') || 'none'}`
    );

    if (activeProviders.length === 0) {
      process.exit(0);
    }

    const errors = [];
    for (const provider of activeProviders) {
      debug(`Trying ${provider.name}`);
      const result = await provider.fn(query, timeout);
      if (result.success) {
        outputSuccess(query, result.content, provider.name);
        return;
      }
      errors.push({ provider: provider.name, error: result.error });
    }

    outputAllFailedMessage(query, errors);
  } catch (error) {
    debug(`Hook error: ${error.message}`);
    process.exit(0);
  }
}

function startFromStdin() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    processHook(input);
  });
  process.stdin.on('error', () => {
    process.exit(0);
  });
}

if (require.main === module) {
  startFromStdin();
}

module.exports = {
  extractDuckDuckGoResults,
  formatStructuredSearchResults,
  tryExaSearch,
  tryTavilySearch,
  tryDuckDuckGoSearch,
  tryBraveSearch,
};

/**
 * WebSearch Manager - Manages WebSearch hook for CCS
 *
 * WebSearch is a server-side tool executed by Anthropic's API.
 * Third-party providers (gemini, agy, codex, qwen) don't have access.
 * This manager installs a hook that uses deterministic local search backends,
 * with legacy AI CLI tools kept only as optional fallback.
 *
 * Simplified Architecture:
 *   - No MCP dependency for the default path
 *   - Uses real search providers first (DuckDuckGo, Brave)
 *   - Keeps Gemini/OpenCode/Grok as compatibility fallback only
 *
 * @module utils/websearch-manager
 */

// Re-export types
export type {
  GeminiCliStatus,
  GrokCliStatus,
  OpenCodeCliStatus,
  WebSearchReadiness,
  WebSearchStatus,
  WebSearchCliInfo,
} from './websearch/types';

// Re-export CLI detection functions
export {
  getGeminiCliStatus,
  hasGeminiCli,
  isGeminiAuthenticated,
  clearGeminiCliCache,
} from './websearch/gemini-cli';

export { getGrokCliStatus, hasGrokCli, clearGrokCliCache } from './websearch/grok-cli';

export {
  getOpenCodeCliStatus,
  hasOpenCodeCli,
  clearOpenCodeCliCache,
} from './websearch/opencode-cli';

// Re-export hook management functions
export {
  getHookPath,
  hasWebSearchHook,
  getWebSearchHookConfig,
  installWebSearchHook,
  removeMigrationMarker,
  uninstallWebSearchHook,
} from './websearch/hook-installer';

// Re-export hook environment
export { getWebSearchHookEnv } from './websearch/hook-env';

// Re-export status and readiness functions
export {
  getWebSearchCliProviders,
  hasAnyWebSearchCli,
  getCliInstallHints,
  getWebSearchReadiness,
  displayWebSearchStatus,
} from './websearch/status';

// Re-export profile hook injection
export { ensureProfileHooks, ensureProfileHooksOrThrow } from './websearch/profile-hook-injector';

// Import for local use
import { clearGeminiCliCache, clearGrokCliCache, clearOpenCodeCliCache } from './websearch';

/**
 * Clear all CLI caches
 */
export function clearAllCliCaches(): void {
  clearGeminiCliCache();
  clearGrokCliCache();
  clearOpenCodeCliCache();
}

// ========== Backward Compatibility Exports ==========

/**
 * @deprecated Use installWebSearchHook instead - MCP is no longer used
 */
export function ensureMcpWebSearch(): boolean {
  return false;
}

/**
 * WebSearch Type Definitions
 *
 * Contains all type definitions for WebSearch providers and status.
 *
 * @module utils/websearch/types
 */

import type { ComponentStatus } from '../../types/utils';

/**
 * Gemini CLI installation status
 * @deprecated Use ComponentStatus directly
 */
export type GeminiCliStatus = ComponentStatus;

/**
 * Grok CLI installation status
 * @deprecated Use ComponentStatus directly
 */
export type GrokCliStatus = ComponentStatus;

/**
 * OpenCode CLI installation status
 * @deprecated Use ComponentStatus directly
 */
export type OpenCodeCliStatus = ComponentStatus;

/**
 * WebSearch availability status for third-party profiles
 */
export type WebSearchReadiness = 'ready' | 'needs_setup' | 'unavailable';

/**
 * WebSearch provider identifier
 */
export type WebSearchProviderId =
  | 'exa'
  | 'tavily'
  | 'duckduckgo'
  | 'brave'
  | 'gemini'
  | 'grok'
  | 'opencode';

/**
 * Provider execution class.
 */
export type WebSearchProviderKind = 'backend' | 'legacy-cli';

/**
 * WebSearch provider information for health checks and UI
 */
export interface WebSearchCliInfo {
  /** Provider ID */
  id: WebSearchProviderId;
  /** Backend vs legacy CLI */
  kind: WebSearchProviderKind;
  /** Display name */
  name: string;
  /** Command name for legacy providers */
  command?: string;
  /** Whether the provider is enabled in config */
  enabled: boolean;
  /** Whether the provider is ready right now */
  available: boolean;
  /** CLI version if applicable */
  version: string | null;
  /** Install or setup command when applicable */
  installCommand?: string;
  /** Docs URL */
  docsUrl?: string;
  /** Whether this provider requires an API key */
  requiresApiKey: boolean;
  /** API key environment variable name */
  apiKeyEnvVar?: string;
  /** Brief description */
  description: string;
  /** Summary detail shown in status UIs */
  detail: string;
}

/**
 * WebSearch status for display
 */
export interface WebSearchStatus {
  readiness: WebSearchReadiness;
  message: string;
  providers: WebSearchCliInfo[];
}

/**
 * WebSearch provider configuration from config.yaml
 */
export interface WebSearchProviderConfig {
  enabled?: boolean;
  model?: string;
  timeout?: number;
  max_results?: number;
}

/**
 * WebSearch configuration from config.yaml
 */
export interface WebSearchConfig {
  enabled: boolean;
  providers?: {
    exa?: WebSearchProviderConfig;
    tavily?: WebSearchProviderConfig;
    duckduckgo?: WebSearchProviderConfig;
    brave?: WebSearchProviderConfig;
    gemini?: WebSearchProviderConfig;
    opencode?: WebSearchProviderConfig;
    grok?: WebSearchProviderConfig;
  };
}

/**
 * Settings Page Types
 * Type definitions for WebSearch, GlobalEnv, and Proxy configurations
 */

import type { CliproxyServerConfig, RemoteProxyStatus } from '@/lib/api-client';

// === WebSearch Types ===

export interface ProviderConfig {
  enabled?: boolean;
  model?: string;
  timeout?: number;
  max_results?: number;
}

export interface WebSearchProvidersConfig {
  exa?: ProviderConfig;
  tavily?: ProviderConfig;
  duckduckgo?: ProviderConfig;
  brave?: ProviderConfig;
  gemini?: ProviderConfig;
  grok?: ProviderConfig;
  opencode?: ProviderConfig;
}

export interface WebSearchConfig {
  enabled: boolean;
  providers?: WebSearchProvidersConfig;
}

export interface CliStatus {
  id: 'exa' | 'tavily' | 'duckduckgo' | 'brave' | 'gemini' | 'grok' | 'opencode';
  kind: 'backend' | 'legacy-cli';
  name?: string;
  enabled: boolean;
  available: boolean;
  command?: string;
  version: string | null;
  installCommand?: string;
  docsUrl?: string;
  requiresApiKey: boolean;
  apiKeyEnvVar?: string;
  description: string;
  detail: string;
}

export interface WebSearchStatus {
  providers: CliStatus[];
  readiness: {
    status: 'ready' | 'needs_setup' | 'unavailable';
    message: string;
  };
}

// === GlobalEnv Types ===

export interface GlobalEnvConfig {
  enabled: boolean;
  env: Record<string, string>;
}

// === Tab Types ===

export type SettingsTab = 'websearch' | 'globalenv' | 'proxy' | 'auth' | 'thinking' | 'backups';

// === Thinking Types ===

export type ThinkingMode = 'auto' | 'off' | 'manual';

export interface ThinkingTierDefaults {
  opus: string;
  sonnet: string;
  haiku: string;
}

export interface ThinkingConfig {
  mode: ThinkingMode;
  override?: string | number;
  tier_defaults: ThinkingTierDefaults;
  provider_overrides?: Record<string, Partial<ThinkingTierDefaults>>;
  show_warnings?: boolean;
}

// === Re-exports from api-client ===

export type { CliproxyServerConfig, RemoteProxyStatus };

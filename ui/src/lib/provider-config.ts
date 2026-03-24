/**
 * Provider Configuration
 * Backend provider capabilities are the source of truth.
 * UI keeps only presentation-specific overrides (assets/colors/instructions).
 */

import {
  CLIPROXY_PROVIDER_IDS,
  PROVIDER_CAPABILITIES,
  getProvidersByOAuthFlow,
} from '../../../src/cliproxy/provider-capabilities';
import type { AiProviderFamilyId } from '../../../src/cliproxy/ai-providers';

// Monorepo contract: UI consumes provider capability constants directly from backend
// to enforce one source of truth and prevent provider drift across surfaces.

/** Canonical list of CLIProxy provider IDs (shared with backend). */
export const CLIPROXY_PROVIDERS = CLIPROXY_PROVIDER_IDS;

/** Union type for CLIProxy provider IDs */
export type CLIProxyProvider = (typeof CLIPROXY_PROVIDERS)[number];
export type ProviderVisualId = CLIProxyProvider | 'openai' | 'vertex';

/** Check if a string is a valid CLIProxy provider */
export function isValidProvider(provider: string): provider is CLIProxyProvider {
  return CLIPROXY_PROVIDERS.includes(provider as CLIProxyProvider);
}

function normalizeProviderInput(provider: unknown): string {
  return typeof provider === 'string' ? provider.trim().toLowerCase() : '';
}

interface ProviderMetadata {
  displayName: string;
  description: string;
}

const SPECIAL_PROVIDER_VISUAL_IDS = ['openai', 'vertex'] as const;

function isProviderVisualId(provider: string): provider is ProviderVisualId {
  return (
    isValidProvider(provider) ||
    SPECIAL_PROVIDER_VISUAL_IDS.includes(provider as (typeof SPECIAL_PROVIDER_VISUAL_IDS)[number])
  );
}

export const PROVIDER_METADATA: Record<CLIProxyProvider, ProviderMetadata> = Object.freeze(
  Object.fromEntries(
    CLIPROXY_PROVIDERS.map((provider) => [
      provider,
      {
        displayName: PROVIDER_CAPABILITIES[provider].displayName,
        description: PROVIDER_CAPABILITIES[provider].description,
      },
    ])
  ) as Record<CLIProxyProvider, ProviderMetadata>
);

// Map provider names to asset filenames (only providers with actual logos)
export const PROVIDER_ASSETS: Partial<Record<ProviderVisualId, string>> = {
  gemini: '/assets/providers/gemini-color.svg',
  agy: '/assets/providers/agy.png',
  codex: '/assets/providers/codex-color.svg',
  qwen: '/assets/providers/qwen-color.svg',
  iflow: '/assets/providers/iflow.png',
  kiro: '/assets/providers/kiro.png',
  ghcp: '/assets/providers/copilot.svg',
  claude: '/assets/providers/claude.svg',
  kimi: '/assets/providers/kimi.svg',
  openai: '/assets/providers/openai.svg',
  vertex: '/assets/providers/vertex.svg',
};

interface ProviderFallbackVisual {
  textClass: string;
  letter: string;
}

const DEFAULT_PROVIDER_FALLBACK_VISUAL: ProviderFallbackVisual = {
  textClass: 'text-gray-600',
  letter: '?',
};

/** Fallback visual style when a provider logo asset is unavailable. */
export const PROVIDER_FALLBACK_VISUALS: Record<ProviderVisualId, ProviderFallbackVisual> = {
  gemini: { textClass: 'text-blue-600', letter: 'G' },
  claude: { textClass: 'text-orange-600', letter: 'C' },
  codex: { textClass: 'text-emerald-600', letter: 'X' },
  agy: { textClass: 'text-violet-600', letter: 'A' },
  qwen: { textClass: 'text-cyan-600', letter: 'Q' },
  iflow: { textClass: 'text-indigo-600', letter: 'i' },
  kiro: { textClass: 'text-teal-600', letter: 'K' },
  ghcp: { textClass: 'text-green-600', letter: 'C' },
  kimi: { textClass: 'text-orange-500', letter: 'K' },
  openai: { textClass: 'text-slate-900', letter: 'O' },
  vertex: { textClass: 'text-blue-600', letter: 'V' },
};

/** Providers whose logo looks better on dark background. */
export const PROVIDERS_WITH_DARK_LOGO_BG: ReadonlySet<ProviderVisualId> = new Set(['kimi']);
const PROVIDERS_WITH_SELF_CONTAINED_LOGO: ReadonlySet<ProviderVisualId> = new Set(['codex']);

export function getAiProviderFamilyVisual(familyId: AiProviderFamilyId): ProviderVisualId {
  switch (familyId) {
    case 'gemini-api-key':
      return 'gemini';
    case 'codex-api-key':
      return 'codex';
    case 'claude-api-key':
      return 'claude';
    case 'vertex-api-key':
      return 'vertex';
    case 'openai-compatibility':
      return 'openai';
  }
}

export function getProviderLogoAsset(provider: unknown): string | undefined {
  const normalized = normalizeProviderInput(provider);
  if (!isProviderVisualId(normalized)) {
    return undefined;
  }
  return PROVIDER_ASSETS[normalized];
}

export function getProviderFallbackVisual(provider: unknown): ProviderFallbackVisual {
  const normalized = normalizeProviderInput(provider);
  if (isProviderVisualId(normalized)) {
    return PROVIDER_FALLBACK_VISUALS[normalized];
  }
  return {
    ...DEFAULT_PROVIDER_FALLBACK_VISUAL,
    letter: normalized[0]?.toUpperCase() || DEFAULT_PROVIDER_FALLBACK_VISUAL.letter,
  };
}

export function providerNeedsDarkLogoBackground(provider: unknown): boolean {
  const normalized = normalizeProviderInput(provider);
  return isProviderVisualId(normalized) && PROVIDERS_WITH_DARK_LOGO_BG.has(normalized);
}

export function providerUsesSelfContainedLogo(provider: unknown): boolean {
  const normalized = normalizeProviderInput(provider);
  return isProviderVisualId(normalized) && PROVIDERS_WITH_SELF_CONTAINED_LOGO.has(normalized);
}

// Provider brand colors
export const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  agy: '#f3722c',
  codex: '#10a37f',
  openai: '#111827',
  vertex: '#4285F4',
  iflow: '#f94144',
  qwen: '#6236FF',
  kiro: '#4d908e',
  ghcp: '#43aa8b',
  claude: '#D97757',
  kimi: '#FF6B35',
};

const PROVIDER_NAMES: Record<string, string> = {
  ...Object.fromEntries(
    CLIPROXY_PROVIDERS.map((provider) => [provider, PROVIDER_METADATA[provider].displayName])
  ),
  openai: 'OpenAI',
  vertex: 'Vertex AI',
};

export function getProviderDisplayName(provider: unknown): string {
  const normalized = normalizeProviderInput(provider);
  if (!normalized) {
    return 'Unknown provider';
  }
  return PROVIDER_NAMES[normalized] || String(provider);
}

/** Map provider to user-facing short description */
export function getProviderDescription(provider: unknown): string {
  const normalized = normalizeProviderInput(provider);
  if (!isValidProvider(normalized)) return '';
  return PROVIDER_METADATA[normalized].description;
}

/**
 * Providers that use Device Code OAuth flow instead of Authorization Code flow.
 */
export const DEVICE_CODE_PROVIDERS: CLIProxyProvider[] = [
  ...getProvidersByOAuthFlow('device_code'),
];

const DEVICE_CODE_PROVIDER_DISPLAY_NAMES: Readonly<Partial<Record<CLIProxyProvider, string>>> =
  Object.freeze({
    ghcp: 'GitHub Copilot',
    kiro: 'Kiro (AWS)',
    qwen: 'Qwen Code',
  });

const DEVICE_CODE_PROVIDER_INSTRUCTIONS: Readonly<Partial<Record<CLIProxyProvider, string>>> =
  Object.freeze({
    ghcp: 'Sign in with your GitHub account that has Copilot access.',
    qwen: 'Sign in with your Qwen account to authorize access.',
    kiro: 'Sign in with your selected Kiro auth provider to continue.',
    kimi: 'Sign in with your Kimi account and finish the device authorization.',
  });

/** Check if provider uses Device Code flow */
export function isDeviceCodeProvider(provider: unknown): boolean {
  const normalized = normalizeProviderInput(provider);
  return isValidProvider(normalized) && DEVICE_CODE_PROVIDERS.includes(normalized);
}

/** Provider display name tuned for device-code UX copy. */
export function getDeviceCodeProviderDisplayName(provider: unknown): string {
  const normalized = normalizeProviderInput(provider);
  if (!normalized) {
    return 'Unknown provider';
  }
  if (isValidProvider(normalized)) {
    return DEVICE_CODE_PROVIDER_DISPLAY_NAMES[normalized] || getProviderDisplayName(normalized);
  }
  return String(provider);
}

/** Provider-specific helper text for device-code dialog. */
export function getDeviceCodeProviderInstruction(provider: unknown): string {
  const normalized = normalizeProviderInput(provider);
  if (isValidProvider(normalized)) {
    return (
      DEVICE_CODE_PROVIDER_INSTRUCTIONS[normalized] || 'Complete the authorization in your browser.'
    );
  }
  return 'Complete the authorization in your browser.';
}

/** Kiro auth methods exposed in CCS UI (aligned with CLIProxyAPIPlus support). */
export const KIRO_AUTH_METHODS = ['aws', 'aws-authcode', 'google', 'github'] as const;
export type KiroAuthMethod = (typeof KIRO_AUTH_METHODS)[number];

export type KiroFlowType = 'authorization_code' | 'device_code';
export type KiroStartEndpoint = 'start' | 'start-url';

export interface KiroAuthMethodOption {
  id: KiroAuthMethod;
  label: string;
  description: string;
  flowType: KiroFlowType;
  startEndpoint: KiroStartEndpoint;
}

/** UX-first default for issue #233: AWS Builder ID device flow. */
export const DEFAULT_KIRO_AUTH_METHOD: KiroAuthMethod = 'aws';

export const KIRO_AUTH_METHOD_OPTIONS: readonly KiroAuthMethodOption[] = [
  {
    id: 'aws',
    label: 'AWS Builder ID (Recommended)',
    description: 'Device code flow for AWS organizations and Builder ID accounts.',
    flowType: 'device_code',
    startEndpoint: 'start',
  },
  {
    id: 'aws-authcode',
    label: 'AWS Builder ID (Auth Code)',
    description: 'Authorization code flow via CLI binary.',
    flowType: 'authorization_code',
    startEndpoint: 'start',
  },
  {
    id: 'google',
    label: 'Google OAuth',
    description: 'Social OAuth flow with callback URL support.',
    flowType: 'authorization_code',
    startEndpoint: 'start-url',
  },
  {
    id: 'github',
    label: 'GitHub OAuth',
    description: 'Social OAuth flow via management API callback.',
    flowType: 'authorization_code',
    startEndpoint: 'start-url',
  },
];

export function isKiroAuthMethod(value: string): value is KiroAuthMethod {
  return KIRO_AUTH_METHODS.includes(value as KiroAuthMethod);
}

export function normalizeKiroAuthMethod(value?: string): KiroAuthMethod {
  if (!value) return DEFAULT_KIRO_AUTH_METHOD;
  const normalized = value.trim().toLowerCase();
  return isKiroAuthMethod(normalized) ? normalized : DEFAULT_KIRO_AUTH_METHOD;
}

export function getKiroAuthMethodOption(method: KiroAuthMethod): KiroAuthMethodOption {
  const option = KIRO_AUTH_METHOD_OPTIONS.find((candidate) => candidate.id === method);
  return option || KIRO_AUTH_METHOD_OPTIONS[0];
}

import {
  DEFAULT_IMAGE_ANALYSIS_CONFIG,
  type ImageAnalysisConfig,
} from '../../config/unified-config-types';
import {
  getProviderDisplayName,
  isCLIProxyProvider,
  mapExternalProviderName,
} from '../../cliproxy/provider-capabilities';
import { extractProviderFromPathname } from '../../cliproxy/model-id-normalizer';
import type { CliproxyBridgeMetadata } from '../../api/services/profile-types';
import type { Settings } from '../../types/config';
import type { ProfileType } from '../../types/profile';

export type ImageAnalysisResolutionSource =
  | 'cliproxy-provider'
  | 'cliproxy-variant'
  | 'cliproxy-composite'
  | 'copilot-alias'
  | 'cliproxy-bridge'
  | 'profile-backend'
  | 'fallback-backend'
  | 'disabled'
  | 'unsupported-profile'
  | 'unresolved'
  | 'missing-model';

export type ImageAnalysisStatusCode =
  | 'active'
  | 'mapped'
  | 'attention'
  | 'disabled'
  | 'skipped'
  | 'hook-missing';

export interface ImageAnalysisResolutionContext {
  profileName: string;
  profileType?: ProfileType;
  settingsPath?: string | null;
  cliproxyProvider?: string | null;
  isComposite?: boolean;
  settings?: Pick<Settings, 'env'> | null;
  cliproxyBridge?: CliproxyBridgeMetadata | null;
  hookInstalled?: boolean;
  sharedHookInstalled?: boolean;
}

export interface ImageAnalysisStatus {
  enabled: boolean;
  supported: boolean;
  status: ImageAnalysisStatusCode;
  backendId: string | null;
  backendDisplayName: string | null;
  model: string | null;
  resolutionSource: ImageAnalysisResolutionSource;
  reason: string | null;
  shouldPersistHook: boolean;
  persistencePath: string | null;
  runtimePath: string | null;
  usesCurrentTarget: boolean | null;
  usesCurrentAuthToken: boolean | null;
  hookInstalled: boolean | null;
  sharedHookInstalled: boolean | null;
}

function resolveProviderFromBaseUrl(baseUrl: unknown): string | null {
  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    return null;
  }

  try {
    const parsed = new URL(baseUrl);
    const extracted = extractProviderFromPathname(parsed.pathname);
    return extracted ? mapExternalProviderName(extracted) : null;
  } catch {
    const extracted = extractProviderFromPathname(baseUrl);
    return extracted ? mapExternalProviderName(extracted) : null;
  }
}

function findCaseInsensitiveKey(
  entries: Record<string, string> | undefined,
  requestedKey: string
): string | null {
  if (!entries) {
    return null;
  }

  const normalizedRequestedKey = requestedKey.trim().toLowerCase();
  for (const key of Object.keys(entries)) {
    if (key.trim().toLowerCase() === normalizedRequestedKey) {
      return key;
    }
  }

  return null;
}

export function normalizeImageAnalysisBackendId(
  value: string | null | undefined,
  knownBackends: Iterable<string> = []
): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();
  const canonicalProvider = mapExternalProviderName(trimmed.toLowerCase());
  if (canonicalProvider) {
    return canonicalProvider;
  }

  const knownBackendList = Array.from(knownBackends);
  const exactKey = knownBackendList.find((backend) => backend === trimmed);
  if (exactKey) {
    return exactKey;
  }

  const caseInsensitiveKey = knownBackendList.find(
    (backend) => backend.trim().toLowerCase() === trimmed.toLowerCase()
  );
  if (caseInsensitiveKey) {
    return caseInsensitiveKey;
  }

  return trimmed.toLowerCase();
}

export function canonicalizeImageAnalysisConfig(config: ImageAnalysisConfig): ImageAnalysisConfig {
  const normalizedProviderModels = Object.entries(config.provider_models ?? {}).reduce(
    (acc, [backend, model]) => {
      const normalizedBackend = normalizeImageAnalysisBackendId(
        backend,
        Object.keys(DEFAULT_IMAGE_ANALYSIS_CONFIG.provider_models)
      );
      if (!normalizedBackend || typeof model !== 'string' || model.trim().length === 0) {
        return acc;
      }

      acc[normalizedBackend] = model.trim();
      return acc;
    },
    {} as Record<string, string>
  );

  const normalizedFallbackBackend =
    normalizeImageAnalysisBackendId(
      config.fallback_backend ?? DEFAULT_IMAGE_ANALYSIS_CONFIG.fallback_backend,
      Object.keys(normalizedProviderModels)
    ) ?? DEFAULT_IMAGE_ANALYSIS_CONFIG.fallback_backend;

  const normalizedProfileBackends = Object.entries(config.profile_backends ?? {}).reduce(
    (acc, [profileName, backend]) => {
      const trimmedProfileName = profileName.trim();
      const normalizedBackend = normalizeImageAnalysisBackendId(
        backend,
        Object.keys(normalizedProviderModels)
      );
      if (!trimmedProfileName || !normalizedBackend) {
        return acc;
      }

      acc[trimmedProfileName] = normalizedBackend;
      return acc;
    },
    {} as Record<string, string>
  );

  return {
    enabled: config.enabled,
    timeout: config.timeout,
    provider_models: normalizedProviderModels,
    fallback_backend: normalizedFallbackBackend,
    profile_backends: normalizedProfileBackends,
  };
}

function resolveConfiguredProfileBackend(
  profileName: string,
  config: ImageAnalysisConfig
): string | null {
  if (!config.profile_backends) {
    return null;
  }

  const exactKey = config.profile_backends[profileName];
  if (exactKey) {
    return normalizeImageAnalysisBackendId(exactKey, Object.keys(config.provider_models));
  }

  const matchedKey = findCaseInsensitiveKey(config.profile_backends, profileName);
  if (!matchedKey) {
    return null;
  }

  return normalizeImageAnalysisBackendId(
    config.profile_backends[matchedKey],
    Object.keys(config.provider_models)
  );
}

function getBackendDisplayName(backendId: string | null): string | null {
  if (!backendId) {
    return null;
  }

  return isCLIProxyProvider(backendId) ? getProviderDisplayName(backendId) : backendId;
}

function getRuntimePath(backendId: string | null): string | null {
  if (!backendId) {
    return null;
  }

  return `/api/provider/${backendId}`;
}

function resolveBackend(
  context: ImageAnalysisResolutionContext,
  config: ImageAnalysisConfig
): Pick<ImageAnalysisStatus, 'backendId' | 'backendDisplayName' | 'resolutionSource' | 'reason'> {
  const { profileName, profileType, cliproxyProvider, isComposite, cliproxyBridge, settings } =
    context;

  if (!config.enabled) {
    return {
      backendId: null,
      backendDisplayName: null,
      resolutionSource: 'disabled',
      reason: 'Disabled globally.',
    };
  }

  if (profileType === 'default' || profileType === 'account') {
    return {
      backendId: null,
      backendDisplayName: null,
      resolutionSource: 'unsupported-profile',
      reason: 'This profile type is not currently covered by image-analysis runtime.',
    };
  }

  if (profileType === 'copilot' || profileName === 'copilot') {
    const backendId = normalizeImageAnalysisBackendId('ghcp', Object.keys(config.provider_models));
    return {
      backendId,
      backendDisplayName: getBackendDisplayName(backendId),
      resolutionSource: 'copilot-alias',
      reason: null,
    };
  }

  const normalizedCliproxyProvider = normalizeImageAnalysisBackendId(
    cliproxyProvider,
    Object.keys(config.provider_models)
  );
  if (normalizedCliproxyProvider) {
    return {
      backendId: normalizedCliproxyProvider,
      backendDisplayName: getBackendDisplayName(normalizedCliproxyProvider),
      resolutionSource:
        isComposite || profileName.startsWith('composite-')
          ? 'cliproxy-composite'
          : profileName === normalizedCliproxyProvider
            ? 'cliproxy-provider'
            : 'cliproxy-variant',
      reason: null,
    };
  }

  const bridgeBackend = normalizeImageAnalysisBackendId(
    cliproxyBridge?.provider ??
      resolveProviderFromBaseUrl(settings?.env?.ANTHROPIC_BASE_URL ?? undefined),
    Object.keys(config.provider_models)
  );
  if (bridgeBackend) {
    return {
      backendId: bridgeBackend,
      backendDisplayName: getBackendDisplayName(bridgeBackend),
      resolutionSource: 'cliproxy-bridge',
      reason: null,
    };
  }

  const mappedBackend = resolveConfiguredProfileBackend(profileName, config);
  if (mappedBackend) {
    return {
      backendId: mappedBackend,
      backendDisplayName: getBackendDisplayName(mappedBackend),
      resolutionSource: 'profile-backend',
      reason: null,
    };
  }

  const fallbackBackend = normalizeImageAnalysisBackendId(
    config.fallback_backend,
    Object.keys(config.provider_models)
  );
  if (fallbackBackend) {
    return {
      backendId: fallbackBackend,
      backendDisplayName: getBackendDisplayName(fallbackBackend),
      resolutionSource: 'fallback-backend',
      reason: null,
    };
  }

  return {
    backendId: null,
    backendDisplayName: null,
    resolutionSource: 'unresolved',
    reason: 'No supported backend could be resolved.',
  };
}

export function resolveImageAnalysisStatus(
  context: ImageAnalysisResolutionContext,
  rawConfig: ImageAnalysisConfig = DEFAULT_IMAGE_ANALYSIS_CONFIG
): ImageAnalysisStatus {
  const config = canonicalizeImageAnalysisConfig(rawConfig);
  const resolution = resolveBackend(context, config);
  const model = resolution.backendId
    ? (config.provider_models[resolution.backendId] ?? null)
    : null;
  const shouldPersistHook =
    config.enabled && context.profileType !== 'default' && context.profileType !== 'account';

  let status: ImageAnalysisStatusCode = 'active';
  let reason = resolution.reason;

  if (!config.enabled) {
    status = 'disabled';
    reason ??=
      'This profile falls back to native Read because image analysis is turned off in CCS config.';
  } else if (!resolution.backendId) {
    status = 'skipped';
    reason ??= 'No supported backend could be resolved.';
  } else if (!model) {
    status = 'skipped';
    reason = 'Resolved backend has no image-analysis model configured.';
  } else if (
    shouldPersistHook &&
    (context.hookInstalled === false || context.sharedHookInstalled === false)
  ) {
    status = 'hook-missing';
    reason =
      context.sharedHookInstalled === false
        ? 'Shared image-analysis hook is not installed.'
        : 'Profile hook is missing from the persisted settings file.';
  } else if (
    resolution.resolutionSource === 'cliproxy-bridge' &&
    context.cliproxyBridge &&
    (!context.cliproxyBridge.usesCurrentTarget || !context.cliproxyBridge.usesCurrentAuthToken)
  ) {
    status = 'attention';
    reason =
      'Active, but runtime uses the current CLIProxy target instead of the stale route saved in this profile.';
  } else if (resolution.resolutionSource === 'profile-backend') {
    status = 'mapped';
  }

  return {
    enabled: config.enabled,
    supported: Boolean(config.enabled && resolution.backendId && model),
    status,
    backendId: resolution.backendId,
    backendDisplayName: resolution.backendDisplayName,
    model,
    resolutionSource: resolution.resolutionSource,
    reason,
    shouldPersistHook,
    persistencePath: shouldPersistHook ? `${context.profileName}.settings.json` : null,
    runtimePath: getRuntimePath(resolution.backendId),
    usesCurrentTarget: context.cliproxyBridge?.usesCurrentTarget ?? null,
    usesCurrentAuthToken: context.cliproxyBridge?.usesCurrentAuthToken ?? null,
    hookInstalled: context.hookInstalled ?? null,
    sharedHookInstalled: context.sharedHookInstalled ?? null,
  };
}

import {
  apiProfileExists,
  createApiProfile,
  getPresetById,
  getPresetIds,
  getUrlWarning,
  isOpenRouterUrl,
  isUsingUnifiedConfig,
  pickOpenRouterModel,
  sanitizeBaseUrl,
  validateApiName,
  validateUrl,
  type ModelMapping,
  type ProviderPreset,
} from '../../api/services';
import { syncToLocalConfig } from '../../cliproxy/sync/local-config-sync';
import type { TargetType } from '../../targets/target-adapter';
import { color, dim, fail, header, info, infoBox, initUI, warn } from '../../utils/ui';
import { InteractivePrompt } from '../../utils/prompt';
import { exitOnApiCommandErrors, parseApiCommandArgs } from './shared';

function resolvePresetOrExit(presetId?: string): ProviderPreset | null {
  if (!presetId) {
    return null;
  }

  const preset = getPresetById(presetId);
  if (preset) {
    return preset;
  }

  console.log(fail(`Unknown preset: ${presetId}`));
  console.log('');
  console.log('Available presets:');
  getPresetIds().forEach((id) => console.log(`  - ${id}`));
  process.exit(1);
}

async function resolveProfileName(
  providedName: string | undefined,
  preset: ProviderPreset | null
): Promise<string> {
  const name = providedName || preset?.defaultProfileName;
  if (!name) {
    return InteractivePrompt.input('API name', {
      validate: validateApiName,
    });
  }

  const error = validateApiName(name);
  if (error) {
    console.log(fail(error));
    process.exit(1);
  }
  return name;
}

async function resolveBaseUrl(
  providedBaseUrl: string | undefined,
  preset: ProviderPreset | null
): Promise<string> {
  let baseUrl = providedBaseUrl ?? preset?.baseUrl ?? '';

  if (!baseUrl && !preset) {
    baseUrl = await InteractivePrompt.input(
      'API Base URL (e.g., https://api.example.com/v1 - without /chat/completions)',
      { validate: validateUrl }
    );
  } else if (!preset) {
    const error = validateUrl(baseUrl);
    if (error) {
      console.log(fail(error));
      process.exit(1);
    }
  }

  if (!preset) {
    const urlWarning = getUrlWarning(baseUrl);
    if (urlWarning) {
      console.log('');
      console.log(warn(urlWarning));
      const continueAnyway = await InteractivePrompt.confirm('Continue with this URL anyway?', {
        default: false,
      });
      if (!continueAnyway) {
        baseUrl = await InteractivePrompt.input('API Base URL', {
          validate: validateUrl,
          default: sanitizeBaseUrl(baseUrl),
        });
      }
    }
    return baseUrl;
  }

  console.log(info(`Using preset: ${preset.name}`));
  console.log(dim(`  ${preset.description}`));
  console.log(
    dim(
      preset.baseUrl
        ? `  Base URL: ${preset.baseUrl}`
        : '  Auth: Native Anthropic API (x-api-key header)'
    )
  );
  console.log('');
  return baseUrl;
}

async function resolveApiKey(
  providedApiKey: string | undefined,
  preset: ProviderPreset | null
): Promise<string> {
  if (preset?.requiresApiKey === false) {
    if (providedApiKey) {
      console.log(dim(`Note: Using provided API key for ${preset.name} (optional)`));
      return providedApiKey;
    }
    console.log(info(`No API key required for ${preset.name}`));
    return preset.apiKeyPlaceholder || preset.id;
  }

  if (providedApiKey) {
    return providedApiKey;
  }

  const keyPrompt = preset?.apiKeyHint ? `API Key (${preset.apiKeyHint})` : 'API Key';
  const apiKey = await InteractivePrompt.password(keyPrompt);
  if (!apiKey) {
    console.log(fail('API key is required'));
    process.exit(1);
  }
  return apiKey;
}

async function resolveModelConfiguration(
  baseUrl: string,
  preset: ProviderPreset | null,
  providedModel: string | undefined,
  yes: boolean | undefined
): Promise<{ model: string; models: ModelMapping }> {
  let openRouterModel: string | undefined;
  let openRouterTierMapping: { opus?: string; sonnet?: string; haiku?: string } | undefined;

  if (isOpenRouterUrl(baseUrl) && !providedModel) {
    console.log('');
    console.log(info('OpenRouter detected!'));
    const useInteractive = await InteractivePrompt.confirm('Browse models interactively?', {
      default: true,
    });
    if (useInteractive) {
      const selection = await pickOpenRouterModel();
      if (selection) {
        openRouterModel = selection.model;
        openRouterTierMapping = selection.tierMapping;
      }
    }
    console.log('');
    console.log(dim('Note: For OpenRouter, ANTHROPIC_API_KEY should be empty.'));
  }

  const defaultModel = preset?.defaultModel || 'claude-sonnet-4-6';
  let model = providedModel || openRouterModel || preset?.defaultModel;
  if (!model && !yes && !preset) {
    model = await InteractivePrompt.input('Default model (ANTHROPIC_MODEL)', {
      default: defaultModel,
    });
  }
  model = model || defaultModel;

  let opusModel = openRouterTierMapping?.opus || model;
  let sonnetModel = openRouterTierMapping?.sonnet || model;
  let haikuModel = openRouterTierMapping?.haiku || model;
  const shouldPromptForMapping = !yes && !openRouterTierMapping && !preset;

  if (shouldPromptForMapping) {
    let wantCustomMapping = model !== defaultModel;
    if (!wantCustomMapping) {
      console.log('');
      console.log(dim('Some API proxies route different model types to different backends.'));
      wantCustomMapping = await InteractivePrompt.confirm(
        'Configure different models for Opus/Sonnet/Haiku?',
        { default: false }
      );
    }

    if (wantCustomMapping) {
      console.log('');
      console.log(dim('Leave blank to use the default model for each tier.'));
      opusModel =
        (await InteractivePrompt.input('Opus model (ANTHROPIC_DEFAULT_OPUS_MODEL)', {
          default: model,
        })) || model;
      sonnetModel =
        (await InteractivePrompt.input('Sonnet model (ANTHROPIC_DEFAULT_SONNET_MODEL)', {
          default: model,
        })) || model;
      haikuModel =
        (await InteractivePrompt.input('Haiku model (ANTHROPIC_DEFAULT_HAIKU_MODEL)', {
          default: model,
        })) || model;
    }
  }

  return {
    model,
    models: {
      default: model,
      opus: opusModel,
      sonnet: sonnetModel,
      haiku: haikuModel,
    },
  };
}

async function resolveDefaultTarget(
  providedTarget: TargetType | undefined,
  yes: boolean | undefined
): Promise<TargetType> {
  if (providedTarget) {
    return providedTarget;
  }
  if (yes) {
    return 'claude';
  }

  const useDroidByDefault = await InteractivePrompt.confirm(
    'Set default target to Factory Droid for this profile?',
    { default: false }
  );
  return useDroidByDefault ? 'droid' : 'claude';
}

export async function handleApiCreateCommand(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseApiCommandArgs(args);
  exitOnApiCommandErrors(parsedArgs.errors);

  console.log(header('Create API Profile'));
  console.log('');

  const preset = resolvePresetOrExit(parsedArgs.preset);
  const name = await resolveProfileName(parsedArgs.name, preset);

  if (apiProfileExists(name) && !parsedArgs.force) {
    console.log(fail(`API '${name}' already exists`));
    console.log(`    Use ${color('--force', 'command')} to overwrite`);
    process.exit(1);
  }

  let baseUrl = await resolveBaseUrl(parsedArgs.baseUrl, preset);
  if (baseUrl && baseUrl.includes('api.anthropic.com') && !preset) {
    console.log('');
    console.log(info('Anthropic Direct API detected. Base URL will be omitted for native auth.'));
    baseUrl = '';
  }

  const apiKey = await resolveApiKey(parsedArgs.apiKey, preset);
  const { model, models } = await resolveModelConfiguration(
    baseUrl,
    preset,
    parsedArgs.model,
    parsedArgs.yes
  );
  const target = await resolveDefaultTarget(parsedArgs.target, parsedArgs.yes);

  console.log('');
  console.log(info('Creating API profile...'));
  const result = createApiProfile(name, baseUrl || '', apiKey, models, target);
  if (!result.success) {
    console.log(fail(`Failed to create API profile: ${result.error}`));
    process.exit(1);
  }

  try {
    syncToLocalConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`[i] Auto-sync to CLIProxy config skipped: ${message}`);
  }

  const hasCustomMapping =
    models.opus !== model || models.sonnet !== model || models.haiku !== model;
  let details =
    `API:      ${name}\n` +
    `Config:   ${isUsingUnifiedConfig() ? '~/.ccs/config.yaml' : '~/.ccs/config.json'}\n` +
    `Settings: ${result.settingsFile}\n` +
    `Base URL: ${baseUrl}\n` +
    `Model:    ${model}\n` +
    `Target:   ${target}`;

  if (hasCustomMapping) {
    details +=
      `\n\nModel Mapping:\n` +
      `  Opus:   ${models.opus}\n` +
      `  Sonnet: ${models.sonnet}\n` +
      `  Haiku:  ${models.haiku}`;
  }

  console.log('');
  console.log(infoBox(details, 'API Profile Created'));
  console.log('');
  console.log(header('Usage'));
  if (target === 'droid') {
    console.log(
      `  ${color(`ccs ${name} "your prompt"`, 'command')} ${dim('# uses droid by default')}`
    );
    console.log(
      `  ${color(`ccsd ${name} "your prompt"`, 'command')} ${dim('# explicit droid alias')}`
    );
    console.log(
      `  ${color(`ccs ${name} --target claude "your prompt"`, 'command')} ${dim('# override to Claude')}`
    );
  } else {
    console.log(
      `  ${color(`ccs ${name} "your prompt"`, 'command')} ${dim('# uses claude by default')}`
    );
    console.log(
      `  ${color(`ccs ${name} --target droid "your prompt"`, 'command')} ${dim('# run on droid for this call')}`
    );
  }
  console.log('');
  console.log(header('Edit Settings'));
  console.log(`  ${dim('To modify env vars later:')}`);
  console.log(`  ${color(`nano ${result.settingsFile.replace('~', '$HOME')}`, 'command')}`);
  console.log('');
}

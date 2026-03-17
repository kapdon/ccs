import type { TargetType } from '../../targets/target-adapter';
import { fail } from '../../utils/ui';
import { extractOption, hasAnyFlag } from '../arg-extractor';

export interface ApiCommandArgs {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  preset?: string;
  target?: TargetType;
  force?: boolean;
  yes?: boolean;
  errors: string[];
}

export const API_BOOLEAN_FLAGS = ['--force', '--yes', '-y'] as const;
export const API_VALUE_FLAGS = [
  '--base-url',
  '--api-key',
  '--model',
  '--preset',
  '--target',
] as const;
export const API_KNOWN_FLAGS: readonly string[] = [...API_BOOLEAN_FLAGS, ...API_VALUE_FLAGS];

const API_VALUE_FLAG_SET = new Set<string>(API_VALUE_FLAGS);

export function sanitizeHelpText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyRepeatedOption(
  args: string[],
  flags: readonly string[],
  onValue: (value: string) => void,
  onMissing: () => void
): string[] {
  let remaining = [...args];

  while (true) {
    const extracted = extractOption(remaining, flags, {
      allowDashValue: true,
      knownFlags: API_KNOWN_FLAGS,
    });
    if (!extracted.found) {
      return remaining;
    }

    if (extracted.missingValue || !extracted.value) {
      onMissing();
    } else {
      onValue(extracted.value);
    }

    remaining = extracted.remainingArgs;
  }
}

export function extractPositionalArgs(args: string[]): string[] {
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === '--') {
      positionals.push(...args.slice(i + 1));
      break;
    }

    if (token.startsWith('-')) {
      if (!token.includes('=') && API_VALUE_FLAG_SET.has(token)) {
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          i++;
        }
      }
      continue;
    }

    positionals.push(token);
  }

  return positionals;
}

function parseTargetValue(value: string): TargetType | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'claude' || normalized === 'droid') {
    return normalized;
  }
  return null;
}

export function parseOptionalTargetFlag(
  args: string[],
  knownFlags: readonly string[]
): { target?: TargetType; remainingArgs: string[]; errors: string[] } {
  const extracted = extractOption(args, ['--target'], {
    allowDashValue: true,
    knownFlags,
  });
  if (!extracted.found) {
    return { remainingArgs: args, errors: [] };
  }
  if (extracted.missingValue || !extracted.value) {
    return { remainingArgs: extracted.remainingArgs, errors: ['Missing value for --target'] };
  }

  const target = parseTargetValue(extracted.value);
  if (!target) {
    return {
      remainingArgs: extracted.remainingArgs,
      errors: [`Invalid --target value "${extracted.value}". Use: claude or droid`],
    };
  }

  return { target, remainingArgs: extracted.remainingArgs, errors: [] };
}

export function parseApiCommandArgs(args: string[]): ApiCommandArgs {
  const result: ApiCommandArgs = {
    force: hasAnyFlag(args, ['--force']),
    yes: hasAnyFlag(args, ['--yes', '-y']),
    errors: [],
  };

  let remaining = [...args];

  remaining = applyRepeatedOption(
    remaining,
    ['--base-url'],
    (value) => {
      result.baseUrl = value;
    },
    () => {
      result.errors.push('Missing value for --base-url');
    }
  );

  remaining = applyRepeatedOption(
    remaining,
    ['--api-key'],
    (value) => {
      result.apiKey = value;
    },
    () => {
      result.errors.push('Missing value for --api-key');
    }
  );

  remaining = applyRepeatedOption(
    remaining,
    ['--model'],
    (value) => {
      result.model = value;
    },
    () => {
      result.errors.push('Missing value for --model');
    }
  );

  remaining = applyRepeatedOption(
    remaining,
    ['--preset'],
    (value) => {
      result.preset = value;
    },
    () => {
      result.errors.push('Missing value for --preset');
    }
  );

  remaining = applyRepeatedOption(
    remaining,
    ['--target'],
    (value) => {
      const target = parseTargetValue(value);
      if (!target) {
        result.errors.push(`Invalid --target value "${value}". Use: claude or droid`);
        return;
      }
      result.target = target;
    },
    () => {
      result.errors.push('Missing value for --target');
    }
  );

  result.name = extractPositionalArgs(remaining)[0];
  return result;
}

export function exitOnApiCommandErrors(errors: string[]): void {
  if (errors.length === 0) {
    return;
  }

  errors.forEach((errorMessage) => {
    console.log(fail(errorMessage));
  });
  process.exit(1);
}

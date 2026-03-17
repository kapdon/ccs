import * as fs from 'fs';
import { importApiProfileBundle, type ProfileValidationIssue } from '../../api/services';
import { color, fail, info, initUI, ok, warn } from '../../utils/ui';
import { InteractivePrompt } from '../../utils/prompt';
import { extractOption, hasAnyFlag } from '../arg-extractor';
import { API_KNOWN_FLAGS, extractPositionalArgs, parseOptionalTargetFlag } from './shared';

function renderValidationIssue(issue: ProfileValidationIssue): void {
  const indicator = issue.level === 'error' ? color('[X]', 'error') : color('[!]', 'warning');
  console.log(`${indicator} ${issue.message}`);
}

export async function handleApiImportCommand(args: string[]): Promise<void> {
  await initUI();
  const force = hasAnyFlag(args, ['--force']);
  const yes = hasAnyFlag(args, ['--yes', '-y']);

  const nameExtracted = extractOption(args, ['--name'], {
    allowDashValue: true,
    knownFlags: [...API_KNOWN_FLAGS, '--name'],
  });
  if (nameExtracted.found && (nameExtracted.missingValue || !nameExtracted.value)) {
    console.log(fail('Missing value for --name'));
    process.exit(1);
  }

  const targetParsed = parseOptionalTargetFlag(nameExtracted.remainingArgs, [
    ...API_KNOWN_FLAGS,
    '--name',
  ]);
  if (targetParsed.errors.length > 0) {
    targetParsed.errors.forEach((errorMessage) => console.log(fail(errorMessage)));
    process.exit(1);
  }

  const importPath = extractPositionalArgs(targetParsed.remainingArgs)[0];
  if (!importPath) {
    console.log(
      fail('Import file path is required. Usage: ccs api import <file> [--name <new-name>]')
    );
    process.exit(1);
  }

  if (!fs.existsSync(importPath)) {
    console.log(fail(`File not found: ${importPath}`));
    process.exit(1);
  }

  let bundle: unknown;
  try {
    bundle = JSON.parse(fs.readFileSync(importPath, 'utf8'));
  } catch (error) {
    console.log(fail(`Invalid JSON file: ${(error as Error).message}`));
    process.exit(1);
  }

  if (!yes) {
    const confirmed = await InteractivePrompt.confirm(
      `Import profile bundle from "${importPath}"?`,
      {
        default: true,
      }
    );
    if (!confirmed) {
      console.log(info('Cancelled'));
      process.exit(0);
    }
  }

  const result = importApiProfileBundle(bundle, {
    name: nameExtracted.value,
    target: targetParsed.target,
    force,
  });
  if (!result.success) {
    console.log(fail(result.error || 'Failed to import profile'));
    if (result.validation?.issues?.length) {
      console.log('');
      result.validation.issues.forEach(renderValidationIssue);
    }
    process.exit(1);
  }

  console.log(ok(`Profile imported: ${result.name}`));
  result.warnings?.forEach((warningMessage) => console.log(warn(warningMessage)));
  console.log('');
}

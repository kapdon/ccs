import * as fs from 'fs';
import * as path from 'path';
import { exportApiProfile } from '../../api/services';
import { fail, initUI, ok, warn } from '../../utils/ui';
import { extractOption, hasAnyFlag } from '../arg-extractor';
import { API_KNOWN_FLAGS, extractPositionalArgs } from './shared';

export async function handleApiExportCommand(args: string[]): Promise<void> {
  await initUI();
  const includeSecrets = hasAnyFlag(args, ['--include-secrets']);

  const outExtracted = extractOption(args, ['--out'], {
    allowDashValue: true,
    knownFlags: [...API_KNOWN_FLAGS, '--out', '--include-secrets'],
  });
  if (outExtracted.found && (outExtracted.missingValue || !outExtracted.value)) {
    console.log(fail('Missing value for --out'));
    process.exit(1);
  }

  const name = extractPositionalArgs(outExtracted.remainingArgs)[0];
  if (!name) {
    console.log(fail('Profile name is required. Usage: ccs api export <name> [--out <file>]'));
    process.exit(1);
  }

  const result = exportApiProfile(name, includeSecrets);
  if (!result.success || !result.bundle) {
    console.log(fail(result.error || 'Failed to export profile'));
    process.exit(1);
  }

  const outputPath = path.resolve(outExtracted.value || `${name}.ccs-profile.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result.bundle, null, 2) + '\n', 'utf8');

  console.log(ok(`Profile exported to: ${outputPath}`));
  if (result.redacted) {
    console.log(warn('Token was redacted in export. Use --include-secrets to include it.'));
  }
  console.log('');
}

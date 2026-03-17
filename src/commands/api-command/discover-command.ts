import { discoverApiProfileOrphans, registerApiProfileOrphans } from '../../api/services';
import { color, fail, header, info, initUI, ok, table, warn } from '../../utils/ui';
import { hasAnyFlag } from '../arg-extractor';
import { API_KNOWN_FLAGS, parseOptionalTargetFlag } from './shared';

export async function handleApiDiscoverCommand(args: string[]): Promise<void> {
  await initUI();
  const register = hasAnyFlag(args, ['--register']);
  const jsonOutput = hasAnyFlag(args, ['--json']);
  const force = hasAnyFlag(args, ['--force']);

  const targetParsed = parseOptionalTargetFlag(args, [...API_KNOWN_FLAGS, '--register', '--json']);
  if (targetParsed.errors.length > 0) {
    targetParsed.errors.forEach((errorMessage) => console.log(fail(errorMessage)));
    process.exit(1);
  }

  const result = discoverApiProfileOrphans();
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(header('Discover Orphan API Profiles'));
  console.log('');

  if (result.orphans.length === 0) {
    console.log(ok('No orphan settings files found.'));
    console.log('');
    return;
  }

  console.log(
    table(
      result.orphans.map((orphan) => {
        const status = orphan.validation.valid ? color('[OK]', 'success') : color('[X]', 'error');
        const issueSummary =
          orphan.validation.issues.length > 0
            ? orphan.validation.issues[0].message
            : 'Ready to register';
        return [orphan.name, status, issueSummary];
      }),
      {
        head: ['Profile', 'Status', 'Validation'],
        colWidths: [20, 10, 64],
      }
    )
  );
  console.log('');

  if (!register) {
    console.log(info('To register discovered profiles:'));
    console.log(`  ${color('ccs api discover --register', 'command')}`);
    console.log('');
    return;
  }

  const registration = registerApiProfileOrphans({
    target: targetParsed.target || 'claude',
    force,
  });
  console.log(ok(`Registered: ${registration.registered.length}`));
  if (registration.skipped.length > 0) {
    console.log(warn(`Skipped: ${registration.skipped.length}`));
    registration.skipped.forEach((item) => {
      console.log(`  - ${item.name}: ${item.reason}`);
    });
  }
  console.log('');
}

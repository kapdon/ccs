import { listApiProfiles, isUsingUnifiedConfig } from '../../api/services';
import { dim, header, initUI, subheader, table, warn, color } from '../../utils/ui';

export async function handleApiListCommand(): Promise<void> {
  await initUI();
  console.log(header('CCS API Profiles'));
  console.log('');

  const { profiles, variants } = listApiProfiles();
  if (profiles.length === 0) {
    console.log(warn('No API profiles configured'));
    console.log('');
    console.log('To create an API profile:');
    console.log(`  ${color('ccs api create', 'command')}`);
    console.log('');
    return;
  }

  const rows = profiles.map((profile) => {
    const status = profile.isConfigured ? color('[OK]', 'success') : color('[!]', 'warning');
    return [profile.name, profile.target, profile.settingsPath, status];
  });

  console.log(
    table(rows, {
      head: ['API', 'Target', isUsingUnifiedConfig() ? 'Config' : 'Settings File', 'Status'],
      colWidths: isUsingUnifiedConfig() ? [15, 10, 20, 10] : [15, 10, 35, 10],
    })
  );
  console.log('');

  if (variants.length > 0) {
    console.log(subheader('CLIProxy Variants'));
    console.log(
      table(
        variants.map((variant) => [
          variant.name,
          variant.provider,
          variant.target,
          variant.settings,
        ]),
        {
          head: ['Variant', 'Provider', 'Target', 'Settings'],
          colWidths: [15, 12, 10, 28],
        }
      )
    );
    console.log('');
  }

  console.log(dim(`Total: ${profiles.length} API profile(s)`));
  console.log('');
}

import { getApiProfileNames, isUsingUnifiedConfig, removeApiProfile } from '../../api/services';
import { color, fail, header, info, initUI, ok, warn } from '../../utils/ui';
import { InteractivePrompt } from '../../utils/prompt';
import { exitOnApiCommandErrors, parseApiCommandArgs } from './shared';

export async function handleApiRemoveCommand(args: string[]): Promise<void> {
  await initUI();
  const parsedArgs = parseApiCommandArgs(args);
  exitOnApiCommandErrors(parsedArgs.errors);

  const apis = getApiProfileNames();
  if (apis.length === 0) {
    console.log(warn('No API profiles to remove'));
    process.exit(0);
  }

  let name = parsedArgs.name;
  if (!name) {
    console.log(header('Remove API Profile'));
    console.log('');
    console.log('Available APIs:');
    apis.forEach((api, index) => console.log(`  ${index + 1}. ${api}`));
    console.log('');
    name = await InteractivePrompt.input('API name to remove', {
      validate: (value) => {
        if (!value) return 'API name is required';
        if (!apis.includes(value)) return `API '${value}' not found`;
        return null;
      },
    });
  }

  if (!apis.includes(name)) {
    console.log(fail(`API '${name}' not found`));
    console.log('');
    console.log('Available APIs:');
    apis.forEach((api) => console.log(`  - ${api}`));
    process.exit(1);
  }

  console.log('');
  console.log(`API '${color(name, 'command')}' will be removed.`);
  console.log(`  Settings: ~/.ccs/${name}.settings.json`);
  if (isUsingUnifiedConfig()) {
    console.log('  Config: ~/.ccs/config.yaml');
  }
  console.log('');

  const confirmed =
    parsedArgs.yes ||
    (await InteractivePrompt.confirm('Delete this API profile?', { default: false }));
  if (!confirmed) {
    console.log(info('Cancelled'));
    process.exit(0);
  }

  const result = removeApiProfile(name);
  if (!result.success) {
    console.log(fail(`Failed to remove API profile: ${result.error}`));
    process.exit(1);
  }

  console.log(ok(`API profile removed: ${name}`));
  console.log('');
}

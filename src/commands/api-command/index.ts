import { dispatchNamedCommand, type NamedCommandRoute } from '../named-command-router';
import { handleApiCopyCommand } from './copy-command';
import { handleApiCreateCommand } from './create-command';
import { handleApiDiscoverCommand } from './discover-command';
import { handleApiExportCommand } from './export-command';
import { showApiCommandHelp, showUnknownApiCommand } from './help';
import { handleApiImportCommand } from './import-command';
import { handleApiListCommand } from './list-command';
import { handleApiRemoveCommand } from './remove-command';

export { parseApiCommandArgs } from './shared';

const API_COMMAND_ROUTES: readonly NamedCommandRoute[] = [
  { name: 'create', handle: handleApiCreateCommand },
  { name: 'list', handle: async () => handleApiListCommand() },
  { name: 'discover', handle: handleApiDiscoverCommand },
  { name: 'copy', handle: handleApiCopyCommand },
  { name: 'export', handle: handleApiExportCommand },
  { name: 'import', handle: handleApiImportCommand },
  { name: 'remove', aliases: ['delete', 'rm'], handle: handleApiRemoveCommand },
];

export async function handleApiCommand(args: string[]): Promise<void> {
  await dispatchNamedCommand({
    args,
    routes: API_COMMAND_ROUTES,
    onHelp: showApiCommandHelp,
    onUnknown: showUnknownApiCommand,
    allowEmptyHelp: true,
  });
}

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

let calls: string[] = [];

beforeEach(() => {
  calls = [];

  mock.module('../../../src/commands/api-command/help', () => ({
    showApiCommandHelp: async () => {
      calls.push('help');
    },
    showUnknownApiCommand: async (command: string) => {
      calls.push(`unknown:${command}`);
    },
  }));

  mock.module('../../../src/commands/api-command/create-command', () => ({
    handleApiCreateCommand: async (args: string[]) => {
      calls.push(`create:${args.join(' ')}`);
    },
  }));

  mock.module('../../../src/commands/api-command/list-command', () => ({
    handleApiListCommand: async () => {
      calls.push('list');
    },
  }));

  mock.module('../../../src/commands/api-command/remove-command', () => ({
    handleApiRemoveCommand: async (args: string[]) => {
      calls.push(`remove:${args.join(' ')}`);
    },
  }));

  mock.module('../../../src/commands/api-command/discover-command', () => ({
    handleApiDiscoverCommand: async (args: string[]) => {
      calls.push(`discover:${args.join(' ')}`);
    },
  }));

  mock.module('../../../src/commands/api-command/copy-command', () => ({
    handleApiCopyCommand: async (args: string[]) => {
      calls.push(`copy:${args.join(' ')}`);
    },
  }));

  mock.module('../../../src/commands/api-command/export-command', () => ({
    handleApiExportCommand: async (args: string[]) => {
      calls.push(`export:${args.join(' ')}`);
    },
  }));

  mock.module('../../../src/commands/api-command/import-command', () => ({
    handleApiImportCommand: async (args: string[]) => {
      calls.push(`import:${args.join(' ')}`);
    },
  }));
});

afterEach(() => {
  mock.restore();
});

async function loadHandleApiCommand() {
  const mod = await import(`../../../src/commands/api-command?test=${Date.now()}-${Math.random()}`);
  return mod.handleApiCommand;
}

describe('api-command router', () => {
  it('defaults to help when no subcommand is provided', async () => {
    const handleApiCommand = await loadHandleApiCommand();

    await handleApiCommand([]);

    expect(calls).toEqual(['help']);
  });

  it('routes remove aliases through the named command dispatcher', async () => {
    const handleApiCommand = await loadHandleApiCommand();

    await handleApiCommand(['rm', 'profile-a']);

    expect(calls).toEqual(['remove:profile-a']);
  });

  it('delegates unknown commands to the shared unknown handler', async () => {
    const handleApiCommand = await loadHandleApiCommand();

    await handleApiCommand(['bogus']);

    expect(calls).toEqual(['unknown:bogus']);
  });
});

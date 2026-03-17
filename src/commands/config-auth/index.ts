/**
 * Config Auth Commands (Facade)
 *
 * CLI interface for managing dashboard authentication.
 * Commands: setup, show, disable
 *
 * Implementation follows auth-commands.ts pattern.
 */

import { initUI, header, subheader, color, dim, fail } from '../../utils/ui';
import { dispatchNamedCommand, type NamedCommandRoute } from '../named-command-router';

// Import command handlers
import { handleSetup } from './setup-command';
import { handleShow } from './show-command';
import { handleDisable } from './disable-command';

const CONFIG_AUTH_ROUTES: readonly NamedCommandRoute[] = [
  {
    name: 'setup',
    handle: async () => {
      await handleSetup();
    },
  },
  {
    name: 'show',
    aliases: ['status'],
    handle: async () => {
      await handleShow();
    },
  },
  {
    name: 'disable',
    handle: async () => {
      await handleDisable();
    },
  },
];

/**
 * Show help for config auth commands
 */
async function showHelp(): Promise<void> {
  await initUI();

  console.log('');
  console.log(header('Dashboard Auth Management'));
  console.log('');
  console.log(subheader('Usage'));
  console.log(`  ${color('ccs config auth', 'command')} <command>`);
  console.log('');
  console.log(subheader('Commands'));
  console.log(`  ${color('setup', 'command')}               Configure username and password`);
  console.log(`  ${color('show', 'command')}                Display current auth status`);
  console.log(`  ${color('disable', 'command')}             Disable authentication`);
  console.log('');
  console.log(subheader('Examples'));
  console.log(`  ${dim('# Interactive setup wizard')}`);
  console.log(`  ${color('ccs config auth setup', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Check current status')}`);
  console.log(`  ${color('ccs config auth show', 'command')}`);
  console.log('');
  console.log(`  ${dim('# Disable authentication')}`);
  console.log(`  ${color('ccs config auth disable', 'command')}`);
  console.log('');
  console.log(subheader('Environment Variables'));
  console.log('  These override config.yaml values:');
  console.log(
    `  ${color('CCS_DASHBOARD_AUTH_ENABLED', 'command')}     Enable/disable (true/false)`
  );
  console.log(`  ${color('CCS_DASHBOARD_USERNAME', 'command')}         Username`);
  console.log(`  ${color('CCS_DASHBOARD_PASSWORD_HASH', 'command')}    Bcrypt hash`);
  console.log('');
  console.log(subheader('Documentation'));
  console.log('  https://ccs.kaitran.ca/features/dashboard-auth');
  console.log('');
}

/**
 * Route config auth command to appropriate handler
 */
export async function handleConfigAuthCommand(args: string[]): Promise<void> {
  await dispatchNamedCommand({
    args,
    routes: CONFIG_AUTH_ROUTES,
    onHelp: showHelp,
    allowEmptyHelp: true,
    onUnknown: async (command) => {
      await initUI();
      console.log(fail(`Unknown command: ${command}`));
      console.log('');
      console.log('Run for help:');
      console.log(`  ${color('ccs config auth --help', 'command')}`);
      process.exit(1);
    },
  });
}

// Re-export types
export type { ConfigAuthContext, AuthSetupResult, AuthStatusInfo } from './types';

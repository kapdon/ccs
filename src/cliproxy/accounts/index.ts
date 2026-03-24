/**
 * Account Manager Module
 * Barrel export for all account management functionality
 *
 * This module manages multiple OAuth accounts per provider (Gemini, Codex, etc.).
 * Each provider can have multiple accounts, with one designated as default.
 *
 * Account storage: ~/.ccs/cliproxy/accounts.json
 * Token storage: ~/.ccs/cliproxy/auth/ (flat structure, CLIProxyAPI discovers by type field)
 * Paused tokens: ~/.ccs/cliproxy/auth-paused/ (sibling dir, outside CLIProxyAPI scan path)
 */

// Types and constants
export type { AccountInfo, AccountTier, AccountsRegistry, ProviderAccounts } from './types';
export type { BulkOperationResult, SoloOperationResult } from './types';
export { PROVIDERS_WITHOUT_EMAIL } from './types';

// Token file operations
export {
  getAccountsRegistryPath,
  getPausedDir,
  getAccountTokenPath,
  extractAccountIdFromTokenFile,
  deriveNoEmailProviderAccountId,
  generateNickname,
  validateNickname,
  hasAccountNameConflict,
  findAccountNameMatch,
  tokenFileExists,
} from './token-file-ops';

// Registry operations (CRUD)
export {
  loadAccountsRegistry,
  saveAccountsRegistry,
  syncRegistryWithTokenFiles,
  registerAccount,
  setDefaultAccount,
  pauseAccount,
  resumeAccount,
  removeAccount,
  renameAccount,
  touchAccount,
  setAccountTier,
  discoverExistingAccounts,
} from './registry';

// Query operations
export {
  getProviderAccounts,
  getDefaultAccount,
  getAccount,
  findAccountByQuery,
  getActiveAccounts,
  isAccountPaused,
  getAllAccountsSummary,
} from './query';

// Bulk operations
export { bulkPauseAccounts, bulkResumeAccounts, soloAccount } from './bulk-ops';

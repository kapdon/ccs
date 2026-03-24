/**
 * Account Manager for CLIProxyAPI Multi-Account Support
 *
 * DEPRECATED: This file is now a re-export shim for backwards compatibility.
 * New code should import directly from './accounts/' module.
 *
 * Manages multiple OAuth accounts per provider (Gemini, Codex, etc.).
 * Each provider can have multiple accounts, with one designated as default.
 *
 * Account storage: ~/.ccs/cliproxy/accounts.json
 * Token storage: ~/.ccs/cliproxy/auth/ (flat structure, CLIProxyAPI discovers by type field)
 * Paused tokens: ~/.ccs/cliproxy/auth-paused/ (sibling dir, outside CLIProxyAPI scan path)
 */

// Re-export everything from the accounts module
export type {
  AccountInfo,
  AccountTier,
  AccountsRegistry,
  ProviderAccounts,
  BulkOperationResult,
  SoloOperationResult,
} from './accounts';

export {
  PROVIDERS_WITHOUT_EMAIL,
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
  getProviderAccounts,
  getDefaultAccount,
  getAccount,
  findAccountByQuery,
  getActiveAccounts,
  isAccountPaused,
  getAllAccountsSummary,
  bulkPauseAccounts,
  bulkResumeAccounts,
  soloAccount,
} from './accounts';

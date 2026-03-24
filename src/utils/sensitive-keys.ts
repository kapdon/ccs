/**
 * Sensitive Key Detection Utilities
 *
 * Shared patterns for detecting secret/sensitive environment variable keys.
 * Used by migration (secrets separation) and UI (masking).
 */

/**
 * Patterns that match sensitive keys (API keys, tokens, passwords).
 * More specific than substring matching to avoid false positives.
 */
export const SENSITIVE_KEY_PATTERNS = [
  /^ANTHROPIC_AUTH_TOKEN$/, // Exact match for Anthropic auth token
  /_TOKEN$/, // Keys ending with _TOKEN
  /_API_KEY$/, // Keys ending with _API_KEY
  /_AUTH_TOKEN$/, // Keys ending with _AUTH_TOKEN
  /_SECRET$/, // Keys ending with _SECRET
  /_SECRET_KEY$/, // Keys ending with _SECRET_KEY
  /^TOKEN$/, // Exact match for TOKEN
  /^API_KEY$/, // Exact match for API_KEY
  /^AUTH_TOKEN$/, // Exact match for AUTH_TOKEN
  /^SECRET$/, // Exact match for SECRET
  /_PASSWORD$/, // Keys ending with _PASSWORD
  /^PASSWORD$/, // Exact match for PASSWORD
  /_CREDENTIAL$/, // Keys ending with _CREDENTIAL
  /_PRIVATE_KEY$/, // Keys ending with _PRIVATE_KEY
];

/**
 * Check if a key name contains a secret/sensitive value.
 * Used during migration to separate secrets from config.
 *
 * @param key - Environment variable key name
 * @returns true if the key likely contains sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Mask a sensitive value for display.
 * Shows first 4 and last 4 characters, replaces middle with asterisks.
 *
 * @param value - The sensitive value to mask
 * @returns Masked value like "sk-a****xyz1"
 */
export function maskSensitiveValue(value: string): string {
  if (!value || value.length <= 8) {
    return '*'.repeat(value?.length || 0);
  }
  return value.slice(0, 4) + '*'.repeat(Math.max(0, value.length - 8)) + value.slice(-4);
}

/**
 * Mask all sensitive keys in an env object.
 *
 * @param env - Environment variables object
 * @returns New object with sensitive values masked
 */
export function maskSensitiveEnv(env: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    masked[key] = isSensitiveKey(key) ? maskSensitiveValue(value) : value;
  }
  return masked;
}

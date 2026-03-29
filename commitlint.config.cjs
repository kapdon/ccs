// Commitlint configuration for conventional commits
// See: https://commitlint.js.org/
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allowed commit types (determines version bump)
    'type-enum': [2, 'always', [
      'feat',     // New feature → MINOR
      'fix',      // Bug fix → PATCH
      'docs',     // Documentation only → no release
      'style',    // Formatting, no code change → no release
      'refactor', // Code change, no feat/fix → no release
      'perf',     // Performance improvement → PATCH
      'test',     // Adding tests → no release
      'chore',    // Maintenance → no release
      'ci',       // CI/CD changes → no release
      'build',    // Build system → no release
      'revert',   // Revert commit → PATCH
      'hotfix'    // Production hotfix → PATCH
    ]],
    // Subject case - disabled to allow capital letters
    'subject-case': [0],
    // Max header length (type + scope + subject)
    'header-max-length': [2, 'always', 100]
  }
};

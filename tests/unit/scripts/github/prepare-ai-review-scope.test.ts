import { describe, expect, test } from 'bun:test';

const reviewScope = await import('../../../../scripts/github/prepare-ai-review-scope.mjs');

describe('prepare-ai-review-scope', () => {
  test('paginates pull request files and preserves all pages', async () => {
    const pageOneHeaders = new Headers({
      link: '<https://api.github.com/repos/kaitranntt/ccs/pulls/880/files?page=2>; rel="next"',
    });
    const pageTwoHeaders = new Headers();

    const files = await reviewScope.collectPullRequestFiles(
      'https://api.github.com/repos/kaitranntt/ccs/pulls/880/files?page=1',
      async (url: string) => {
        if (url.endsWith('page=1')) {
          return {
            body: [{ filename: 'src/commands/review.ts', status: 'modified', additions: 5, deletions: 2, patch: '+a' }],
            headers: pageOneHeaders,
          };
        }

        return {
          body: [{ filename: 'scripts/github/normalize-ai-review-output.mjs', status: 'modified', additions: 8, deletions: 1, patch: '+b' }],
          headers: pageTwoHeaders,
        };
      }
    );

    expect(files).toHaveLength(2);
    expect(files[1].filename).toBe('scripts/github/normalize-ai-review-output.mjs');
  });

  test('prefers reviewable high-risk files and excludes low-signal churn in triage mode', () => {
    const scope = reviewScope.buildReviewScope(
      reviewScope.normalizePullFiles([
        {
          filename: '.github/review-prompt.md',
          status: 'modified',
          additions: 12,
          deletions: 4,
          changes: 16,
          patch: '@@ -1 +1 @@\n-old\n+new',
        },
        {
          filename: '.github/workflows/ai-review.yml',
          status: 'modified',
          additions: 120,
          deletions: 45,
          changes: 165,
          patch: '@@ -1 +1 @@\n-old\n+new',
        },
        {
          filename: 'scripts/github/normalize-ai-review-output.mjs',
          status: 'modified',
          additions: 40,
          deletions: 10,
          changes: 50,
          patch: '@@ -1 +1 @@\n-old\n+new',
        },
        {
          filename: 'README.md',
          status: 'modified',
          additions: 300,
          deletions: 0,
          changes: 300,
          patch: '@@ -1 +1 @@\n-old\n+new',
        },
        {
          filename: 'docs/ai-review.md',
          status: 'modified',
          additions: 180,
          deletions: 10,
          changes: 190,
          patch: '@@ -1 +1 @@\n-old\n+new',
        },
      ]),
      'triage'
    );

    expect(scope.mode).toBe('triage');
    expect(scope.selected.map((file: { filename: string }) => file.filename)).toEqual(
      expect.arrayContaining([
        '.github/review-prompt.md',
        '.github/workflows/ai-review.yml',
        'scripts/github/normalize-ai-review-output.mjs',
      ])
    );
    expect(scope.lowSignal.map((file: { filename: string }) => file.filename)).toEqual([
      'README.md',
      'docs/ai-review.md',
    ]);
    expect(scope.reviewableFiles).toBe(3);
  });

  test('falls back to low-signal files when they are the only changed files', () => {
    const scope = reviewScope.buildReviewScope(
      reviewScope.normalizePullFiles([
        {
          filename: 'README.md',
          status: 'modified',
          additions: 20,
          deletions: 3,
          changes: 23,
          patch: '@@ -1 +1 @@\n-old\n+new',
        },
      ]),
      'fast'
    );

    expect(scope.selected).toHaveLength(1);
    expect(scope.selected[0].filename).toBe('README.md');
    expect(scope.reviewableFiles).toBe(1);
    expect(scope.scopeLabel).toBe('changed files');
  });

  test('renders deterministic scope metadata and fences patch content safely', () => {
    const oversizedPatch = ['+line 1', '```', ...Array.from({ length: 118 }, (_, index) => `+line ${index + 2}`)].join('\n');
    const scope = reviewScope.buildReviewScope(
      reviewScope.normalizePullFiles([
        {
          filename: '.github/workflows/ai-review.yml',
          status: 'modified',
          additions: 120,
          deletions: 0,
          changes: 120,
          patch: oversizedPatch,
        },
      ]),
      'triage'
    );

    const markdown = reviewScope.renderReviewScope({
      prNumber: 880,
      baseRef: 'dev',
      turnBudget: 6,
      timeoutMinutes: 5,
      scope,
    });

    expect(markdown).toContain('# AI Review Scope');
    expect(markdown).toContain('- Mode: `triage` (hotspot-based bounded review (non-exhaustive))');
    expect(markdown).toContain('- Selected files: 1 of 1 reviewable files (1 total changed files)');
    expect(markdown).toContain('````diff');
    expect(markdown).toContain('```');
    expect(markdown).toContain('... patch trimmed for bounded review ...');
  });
});

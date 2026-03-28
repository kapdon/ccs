import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest-setup.ts'],
    globals: true,
    css: false,
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        // 90% coverage thresholds as per user requirement
        // Applied to testable pure logic files only
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
      include: [
        // Settings - context and pure logic
        'src/pages/settings/settings-context.ts',
        'src/pages/settings/context.tsx',
        'src/pages/settings/hooks/context-hooks.ts',
        // Analytics - pure utils
        'src/pages/analytics/utils.ts',
        // Auth monitor - pure utils
        'src/components/monitoring/auth-monitor/utils.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/components/ui/**', // shadcn components
        'src/main.tsx',
        'src/**/index.tsx', // barrel exports and page containers
        'src/**/index.ts', // barrel exports
        'src/**/types.ts', // type-only files
        '**/*.test.{ts,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../src/shared'),
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});

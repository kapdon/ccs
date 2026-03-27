import { describe, expect, it } from 'bun:test';
import {
  renderCapturedLines,
  useDockerSubcommandConsoleCapture,
} from './docker-subcommand-test-helpers';

const capture = useDockerSubcommandConsoleCapture();

async function loadHandleDown() {
  const mod = await import(
    `../../../src/commands/docker/down-subcommand?test=${Date.now()}-${Math.random()}`
  );
  return mod.handleDown;
}

describe('docker down subcommand', () => {
  it('prints progress and success output for remote shutdowns', async () => {
    const calls: Array<{ host?: string }> = [];
    const dockerModule = (await import(
      '../../../src/docker'
    )) as typeof import('../../../src/docker');
    const originalDown = dockerModule.DockerExecutor.prototype.down;
    dockerModule.DockerExecutor.prototype.down = function (options: { host?: string }) {
      calls.push(options);
    };

    try {
      const handleDown = await loadHandleDown();
      await handleDown(['--host', 'docker-box']);

      const rendered = renderCapturedLines(capture.logLines);
      expect(calls).toEqual([{ host: 'docker-box' }]);
      expect(rendered).toContain('Stopping Docker stack on docker-box...');
      expect(rendered).toContain('Docker stack stopped on docker-box.');
      expect(capture.errorLines).toEqual([]);
      expect(process.exitCode).toBe(0);
    } finally {
      dockerModule.DockerExecutor.prototype.down = originalDown;
    }
  });

  it('renders executor failures as boxed errors', async () => {
    const dockerModule = (await import(
      '../../../src/docker'
    )) as typeof import('../../../src/docker');
    const originalDown = dockerModule.DockerExecutor.prototype.down;
    dockerModule.DockerExecutor.prototype.down = function () {
      throw new Error('Docker stack shutdown failed.\nCommand timed out after 30s.');
    };

    try {
      const handleDown = await loadHandleDown();
      await handleDown([]);

      const rendered = renderCapturedLines(capture.errorLines);
      expect(rendered).toContain('Docker stack shutdown failed.');
      expect(rendered).toContain('Command timed out after 30s.');
      expect(process.exitCode).toBe(1);
    } finally {
      dockerModule.DockerExecutor.prototype.down = originalDown;
    }
  });
});

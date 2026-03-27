import { describe, expect, it } from 'bun:test';
import {
  renderCapturedLines,
  useDockerSubcommandConsoleCapture,
} from './docker-subcommand-test-helpers';

const capture = useDockerSubcommandConsoleCapture();

async function loadHandleUpdate() {
  const mod = await import(
    `../../../src/commands/docker/update-subcommand?test=${Date.now()}-${Math.random()}`
  );
  return mod.handleUpdate;
}

describe('docker update subcommand', () => {
  it('prints progress and success output for remote updates', async () => {
    const calls: Array<{ host?: string }> = [];
    const dockerModule = (await import(
      '../../../src/docker'
    )) as typeof import('../../../src/docker');
    const originalUpdate = dockerModule.DockerExecutor.prototype.update;
    dockerModule.DockerExecutor.prototype.update = function (options: { host?: string }) {
      calls.push(options);
    };

    try {
      const handleUpdate = await loadHandleUpdate();
      await handleUpdate(['--host', 'docker-box']);

      const rendered = renderCapturedLines(capture.logLines);
      expect(calls).toEqual([{ host: 'docker-box' }]);
      expect(rendered).toContain('Updating running Docker stack on docker-box...');
      expect(rendered).toContain('Docker stack updated on docker-box.');
      expect(capture.errorLines).toEqual([]);
      expect(process.exitCode).toBe(0);
    } finally {
      dockerModule.DockerExecutor.prototype.update = originalUpdate;
    }
  });

  it('renders executor failures as boxed errors', async () => {
    const dockerModule = (await import(
      '../../../src/docker'
    )) as typeof import('../../../src/docker');
    const originalUpdate = dockerModule.DockerExecutor.prototype.update;
    dockerModule.DockerExecutor.prototype.update = function () {
      throw new Error('Docker stack update failed.\nSupervisor restart did not complete.');
    };

    try {
      const handleUpdate = await loadHandleUpdate();
      await handleUpdate([]);

      const rendered = renderCapturedLines(capture.errorLines);
      expect(rendered).toContain('Docker stack update failed.');
      expect(rendered).toContain('Supervisor restart did not complete.');
      expect(process.exitCode).toBe(1);
    } finally {
      dockerModule.DockerExecutor.prototype.update = originalUpdate;
    }
  });
});

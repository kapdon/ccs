import { describe, expect, it } from 'bun:test';
import {
  renderCapturedLines,
  useDockerSubcommandConsoleCapture,
} from './docker-subcommand-test-helpers';

const capture = useDockerSubcommandConsoleCapture();

async function loadHandleUp() {
  const mod = await import(
    `../../../src/commands/docker/up-subcommand?test=${Date.now()}-${Math.random()}`
  );
  return mod.handleUp;
}

describe('docker up subcommand', () => {
  it('prints the success summary with the requested host and port mappings', async () => {
    const calls: Array<{ host?: string; port: number; proxyPort: number }> = [];
    const dockerModule = (await import(
      '../../../src/docker'
    )) as typeof import('../../../src/docker');
    const originalUp = dockerModule.DockerExecutor.prototype.up;
    dockerModule.DockerExecutor.prototype.up = function (options: {
      host?: string;
      port: number;
      proxyPort: number;
    }) {
      calls.push(options);
    };

    try {
      const handleUp = await loadHandleUp();
      await handleUp(['--host', 'docker-box', '--port', '4000', '--proxy-port', '9317']);

      const rendered = renderCapturedLines(capture.logLines);
      expect(calls).toEqual([{ host: 'docker-box', port: 4000, proxyPort: 9317 }]);
      expect(rendered).toContain('Starting integrated Docker stack on docker-box');
      expect(rendered).toContain('Docker stack is running on docker-box.');
      expect(rendered).toContain('Dashboard port: 4000');
      expect(rendered).toContain('CLIProxy port: 9317');
      expect(capture.errorLines).toEqual([]);
      expect(process.exitCode).toBe(0);
    } finally {
      dockerModule.DockerExecutor.prototype.up = originalUp;
    }
  });

  it('renders boxed validation errors without invoking the executor', async () => {
    const handleUp = await loadHandleUp();
    await handleUp(['--port', '70000']);

    const rendered = renderCapturedLines(capture.errorLines);
    expect(rendered).toContain('Invalid value for --port');
    expect(process.exitCode).toBe(1);
  });
});

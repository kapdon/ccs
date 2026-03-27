import { describe, expect, it } from 'bun:test';
import {
  renderCapturedLines,
  useDockerSubcommandConsoleCapture,
} from './docker-subcommand-test-helpers';

const capture = useDockerSubcommandConsoleCapture();

async function loadHandleLogs() {
  const mod = await import(
    `../../../src/commands/docker/logs-subcommand?test=${Date.now()}-${Math.random()}`
  );
  return mod.handleLogs;
}

describe('docker logs subcommand', () => {
  it('prints log snapshots returned by the executor', async () => {
    const calls: Array<{ host?: string; follow: boolean; service?: 'ccs' | 'cliproxy' }> = [];
    const dockerModule = (await import(
      '../../../src/docker'
    )) as typeof import('../../../src/docker');
    const originalLogs = dockerModule.DockerExecutor.prototype.logs;
    dockerModule.DockerExecutor.prototype.logs = async function (options: {
      host?: string;
      follow: boolean;
      service?: 'ccs' | 'cliproxy';
    }) {
      calls.push(options);
      return '== ccs ==\nready';
    };

    try {
      const handleLogs = await loadHandleLogs();
      await handleLogs(['--service', 'ccs']);

      expect(calls).toEqual([{ follow: false, service: 'ccs' }]);
      expect(renderCapturedLines(capture.logLines)).toContain('== ccs ==\nready');
      expect(capture.errorLines).toEqual([]);
      expect(process.exitCode).toBe(0);
    } finally {
      dockerModule.DockerExecutor.prototype.logs = originalLogs;
    }
  });

  it('announces follow mode before streaming logs', async () => {
    const calls: Array<{ host?: string; follow: boolean; service?: 'ccs' | 'cliproxy' }> = [];
    const dockerModule = (await import(
      '../../../src/docker'
    )) as typeof import('../../../src/docker');
    const originalLogs = dockerModule.DockerExecutor.prototype.logs;
    dockerModule.DockerExecutor.prototype.logs = async function (options: {
      host?: string;
      follow: boolean;
      service?: 'ccs' | 'cliproxy';
    }) {
      calls.push(options);
    };

    try {
      const handleLogs = await loadHandleLogs();
      await handleLogs(['--host', 'docker-box', '--follow', '--service', 'cliproxy']);

      const rendered = renderCapturedLines(capture.logLines);
      expect(calls).toEqual([{ host: 'docker-box', follow: true, service: 'cliproxy' }]);
      expect(rendered).toContain('Following Docker logs on docker-box...');
      expect(process.exitCode).toBe(0);
    } finally {
      dockerModule.DockerExecutor.prototype.logs = originalLogs;
    }
  });

  it('renders executor failures as boxed errors', async () => {
    const dockerModule = (await import(
      '../../../src/docker'
    )) as typeof import('../../../src/docker');
    const originalLogs = dockerModule.DockerExecutor.prototype.logs;
    dockerModule.DockerExecutor.prototype.logs = async function () {
      throw new Error('Docker log retrieval failed.\nContainer is not running.');
    };

    try {
      const handleLogs = await loadHandleLogs();
      await handleLogs([]);

      const rendered = renderCapturedLines(capture.errorLines);
      expect(rendered).toContain('Docker log retrieval failed.');
      expect(rendered).toContain('Container is not running.');
      expect(process.exitCode).toBe(1);
    } finally {
      dockerModule.DockerExecutor.prototype.logs = originalLogs;
    }
  });
});

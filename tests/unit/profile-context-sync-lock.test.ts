import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ProfileContextSyncLock from '../../src/management/profile-context-sync-lock';

describe('ProfileContextSyncLock', () => {
  let tempRoot = '';
  let instancesDir = '';

  const getLockPath = (lockName: string): string => {
    const safeName = lockName.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const profileHash = createHash('sha1').update(lockName).digest('hex').slice(0, 8);
    return path.join(instancesDir, '.locks', `${safeName}-${profileHash}.lock`);
  };

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-context-lock-test-'));
    instancesDir = path.join(tempRoot, 'instances');
    fs.mkdirSync(instancesDir, { recursive: true });
  });

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('acquires and releases synchronous named locks', () => {
    const lock = new ProfileContextSyncLock(instancesDir);
    const lockPath = getLockPath('__plugin-layout__');

    let sawLockInsideCallback = false;
    const result = lock.withNamedLockSync('__plugin-layout__', () => {
      sawLockInsideCallback = fs.existsSync(lockPath);
      expect(fs.readFileSync(lockPath, 'utf8')).toContain(`"pid":${process.pid}`);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(sawLockInsideCallback).toBe(true);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('releases synchronous named locks when the callback throws', () => {
    const lock = new ProfileContextSyncLock(instancesDir);
    const lockPath = getLockPath('__plugin-layout__');

    expect(() =>
      lock.withNamedLockSync('__plugin-layout__', () => {
        throw new Error('boom');
      })
    ).toThrow('boom');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('reclaims dead-owner locks before entering the callback', () => {
    const lock = new ProfileContextSyncLock(instancesDir);
    const lockPath = getLockPath('__plugin-layout__');

    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(
      lockPath,
      JSON.stringify({
        version: 1,
        pid: 999999,
        nonce: 'dead-owner',
        acquiredAtMs: Date.now() - 1000,
      }),
      'utf8'
    );

    const result = lock.withNamedLockSync('__plugin-layout__', () => 'reclaimed');

    expect(result).toBe('reclaimed');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('reclaims malformed stale locks before entering the callback', () => {
    const lock = new ProfileContextSyncLock(instancesDir);
    const lockPath = getLockPath('__plugin-layout__');
    const staleDate = new Date(Date.now() - 60_000);

    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, 'not-json', 'utf8');
    fs.utimesSync(lockPath, staleDate, staleDate);

    const result = lock.withNamedLockSync('__plugin-layout__', () => 'stale-reclaimed');

    expect(result).toBe('stale-reclaimed');
    expect(fs.existsSync(lockPath)).toBe(false);
  });
});

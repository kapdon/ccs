import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

interface ContextSyncLockPayload {
  version: 1;
  pid: number;
  nonce: string;
  acquiredAtMs: number;
}

interface ContextSyncLockSnapshot {
  raw: string;
  owner: { pid: number; nonce?: string } | null;
}

class ProfileContextSyncLock {
  private readonly locksDir: string;

  constructor(instancesDir: string) {
    this.locksDir = path.join(instancesDir, '.locks');
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
  }

  private getLockPath(profileName: string): string {
    const safeName = this.sanitizeName(profileName);
    const profileHash = createHash('sha1').update(profileName).digest('hex').slice(0, 8);
    return path.join(this.locksDir, `${safeName}-${profileHash}.lock`);
  }

  private isProcessAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) {
      return false;
    }

    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EPERM') {
        return true;
      }
      return false;
    }
  }

  private parseContextSyncLock(raw: string): { pid: number; nonce?: string } | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as Partial<ContextSyncLockPayload>;
      if (typeof parsed.pid === 'number' && Number.isInteger(parsed.pid) && parsed.pid > 0) {
        const nonce =
          typeof parsed.nonce === 'string' && parsed.nonce.length > 0 ? parsed.nonce : undefined;
        return { pid: parsed.pid, nonce };
      }
    } catch {
      const legacyPid = Number.parseInt(trimmed, 10);
      if (Number.isInteger(legacyPid) && legacyPid > 0) {
        return { pid: legacyPid };
      }
    }

    return null;
  }

  private readContextSyncLockSnapshot(lockPath: string): ContextSyncLockSnapshot | null {
    try {
      const raw = fs.readFileSync(lockPath, 'utf8');
      return {
        raw,
        owner: this.parseContextSyncLock(raw),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      return null;
    }
  }

  private tryRemoveLockIfUnchanged(lockPath: string, expectedRaw: string): boolean {
    try {
      const currentRaw = fs.readFileSync(lockPath, 'utf8');
      if (currentRaw !== expectedRaw) {
        return false;
      }
      fs.unlinkSync(lockPath);
      return true;
    } catch {
      return false;
    }
  }

  private tryRemoveDeadOwnerLock(lockPath: string, snapshot: ContextSyncLockSnapshot): boolean {
    if (!snapshot.owner || this.isProcessAlive(snapshot.owner.pid)) {
      return false;
    }

    return this.tryRemoveLockIfUnchanged(lockPath, snapshot.raw);
  }

  async withNamedLock<T>(lockName: string, callback: () => Promise<T>): Promise<T> {
    const lockPath = this.getLockPath(lockName);
    const retryDelayMs = 50;
    const staleLockMs = 30000;
    const timeoutMs = staleLockMs + 5000;
    const start = Date.now();
    const ownerPayload: ContextSyncLockPayload = {
      version: 1,
      pid: process.pid,
      nonce: createHash('sha1')
        .update(`${process.pid}:${Date.now()}:${Math.random()}`)
        .digest('hex')
        .slice(0, 16),
      acquiredAtMs: Date.now(),
    };
    const ownerPayloadRaw = JSON.stringify(ownerPayload);

    fs.mkdirSync(this.locksDir, { recursive: true, mode: 0o700 });

    while (true) {
      try {
        const fd = fs.openSync(lockPath, 'wx', 0o600);
        fs.writeFileSync(fd, ownerPayloadRaw, 'utf8');
        fs.closeSync(fd);
        break;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'EEXIST') {
          throw error;
        }

        const lockSnapshot = this.readContextSyncLockSnapshot(lockPath);
        if (lockSnapshot) {
          if (this.tryRemoveDeadOwnerLock(lockPath, lockSnapshot)) {
            continue;
          }

          // For malformed lock payloads, fall back to age-based stale cleanup.
          if (!lockSnapshot.owner) {
            try {
              const lockStats = fs.statSync(lockPath);
              if (Date.now() - lockStats.mtimeMs > staleLockMs) {
                if (this.tryRemoveLockIfUnchanged(lockPath, lockSnapshot.raw)) {
                  continue;
                }
              }
            } catch {
              // Best-effort stale lock cleanup.
            }
          }
        }

        if (Date.now() - start > timeoutMs) {
          throw new Error(`Timed out waiting for profile context lock: ${lockName}`);
        }

        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    try {
      return await callback();
    } finally {
      this.tryRemoveLockIfUnchanged(lockPath, ownerPayloadRaw);
    }
  }

  async withLock<T>(profileName: string, callback: () => Promise<T>): Promise<T> {
    return this.withNamedLock(profileName, callback);
  }

  withNamedLockSync<T>(lockName: string, callback: () => T): T {
    const lockPath = this.getLockPath(lockName);
    const retryDelayMs = 50;
    const staleLockMs = 30000;
    const timeoutMs = staleLockMs + 5000;
    const start = Date.now();
    const ownerPayload: ContextSyncLockPayload = {
      version: 1,
      pid: process.pid,
      nonce: createHash('sha1')
        .update(`${process.pid}:${Date.now()}:${Math.random()}`)
        .digest('hex')
        .slice(0, 16),
      acquiredAtMs: Date.now(),
    };
    const ownerPayloadRaw = JSON.stringify(ownerPayload);

    fs.mkdirSync(this.locksDir, { recursive: true, mode: 0o700 });

    while (true) {
      try {
        const fd = fs.openSync(lockPath, 'wx', 0o600);
        fs.writeFileSync(fd, ownerPayloadRaw, 'utf8');
        fs.closeSync(fd);
        break;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'EEXIST') {
          throw error;
        }

        const lockSnapshot = this.readContextSyncLockSnapshot(lockPath);
        if (lockSnapshot) {
          if (this.tryRemoveDeadOwnerLock(lockPath, lockSnapshot)) {
            continue;
          }

          if (!lockSnapshot.owner) {
            try {
              const lockStats = fs.statSync(lockPath);
              if (Date.now() - lockStats.mtimeMs > staleLockMs) {
                if (this.tryRemoveLockIfUnchanged(lockPath, lockSnapshot.raw)) {
                  continue;
                }
              }
            } catch {
              // Best-effort stale lock cleanup.
            }
          }
        }

        if (Date.now() - start > timeoutMs) {
          throw new Error(`Timed out waiting for profile context lock: ${lockName}`);
        }

        const until = Date.now() + retryDelayMs;
        while (Date.now() < until) {
          // Sync callers need a synchronous retry path here.
          // This lock only guards short local filesystem normalization work, so
          // contention should be brief and limited to profile/bootstrap edges.
        }
      }
    }

    try {
      return callback();
    } finally {
      this.tryRemoveLockIfUnchanged(lockPath, ownerPayloadRaw);
    }
  }

  withLockSync<T>(profileName: string, callback: () => T): T {
    return this.withNamedLockSync(profileName, callback);
  }
}

export default ProfileContextSyncLock;

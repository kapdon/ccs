import { useCallback, useState } from 'react';
import type { OfficialChannelId, OfficialChannelsConfig, OfficialChannelsStatus } from '../types';

const DEFAULT_CONFIG: OfficialChannelsConfig = {
  selected: [],
  unattended: false,
};

export function useOfficialChannelsConfig() {
  const [config, setConfig] = useState<OfficialChannelsConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<OfficialChannelsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const flashSuccess = useCallback((message: string) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 1500);
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/channels');
      if (!res.ok) {
        throw new Error('Failed to load Official Channels settings');
      }

      const data = (await res.json()) as {
        config?: OfficialChannelsConfig;
        status?: OfficialChannelsStatus;
      };

      setConfig(data.config ?? DEFAULT_CONFIG);
      setStatus(data.status ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(
    async (updates: Partial<OfficialChannelsConfig>, successMessage = 'Settings saved') => {
      try {
        setSaving(true);
        setError(null);

        const res = await fetch('/api/channels', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || 'Failed to save Official Channels settings');
        }

        const data = (await res.json()) as { config?: OfficialChannelsConfig };
        setConfig(data.config ?? { ...config, ...updates });
        flashSuccess(successMessage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setSaving(false);
      }
    },
    [config, flashSuccess]
  );

  const saveToken = useCallback(
    async (channelId: OfficialChannelId, token: string) => {
      try {
        setSaving(true);
        setError(null);

        const res = await fetch(`/api/channels/${channelId}/token`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || `Failed to save ${channelId} token`);
        }

        await fetchConfig();
        flashSuccess(`${channelId} token saved`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setSaving(false);
      }
    },
    [fetchConfig, flashSuccess]
  );

  const clearToken = useCallback(
    async (channelId: OfficialChannelId) => {
      try {
        setSaving(true);
        setError(null);

        const res = await fetch(`/api/channels/${channelId}/token`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error || `Failed to clear ${channelId} token`);
        }

        await fetchConfig();
        flashSuccess(`${channelId} token cleared`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setSaving(false);
      }
    },
    [fetchConfig, flashSuccess]
  );

  return {
    config,
    status,
    loading,
    saving,
    error,
    success,
    fetchConfig,
    updateConfig,
    saveToken,
    clearToken,
  };
}

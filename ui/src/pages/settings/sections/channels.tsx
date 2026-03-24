import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useOfficialChannelsConfig } from '../hooks/use-official-channels-config';
import { useRawConfig } from '../hooks';
import type { OfficialChannelId } from '../types';

type TokenDrafts = Record<OfficialChannelId, string>;

const EMPTY_DRAFTS: TokenDrafts = {
  telegram: '',
  discord: '',
  imessage: '',
};

export default function ChannelsSection() {
  const {
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
  } = useOfficialChannelsConfig();
  const { fetchRawConfig } = useRawConfig();
  const [tokenDrafts, setTokenDrafts] = useState<TokenDrafts>(EMPTY_DRAFTS);

  useEffect(() => {
    void fetchConfig();
    void fetchRawConfig();
  }, [fetchConfig, fetchRawConfig]);

  const refreshAll = async () => {
    await Promise.all([fetchConfig(), fetchRawConfig()]);
  };

  const toggleChannel = async (channelId: OfficialChannelId, checked: boolean): Promise<void> => {
    const nextSelected = checked
      ? [...new Set([...config.selected, channelId])]
      : config.selected.filter((value) => value !== channelId);

    await updateConfig(
      { selected: nextSelected },
      checked ? `${channelId} enabled` : `${channelId} disabled`
    );
    await fetchRawConfig();
  };

  const updateTokenDraft = (channelId: OfficialChannelId, value: string) => {
    setTokenDrafts((current) => ({ ...current, [channelId]: value }));
  };

  const handleSaveToken = async (channelId: OfficialChannelId): Promise<void> => {
    await saveToken(channelId, tokenDrafts[channelId]);
    setTokenDrafts((current) => ({ ...current, [channelId]: '' }));
    await fetchRawConfig();
  };

  const handleClearToken = async (channelId: OfficialChannelId): Promise<void> => {
    await clearToken(channelId);
    setTokenDrafts((current) => ({ ...current, [channelId]: '' }));
    await fetchRawConfig();
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Loading</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`absolute left-5 right-5 top-20 z-10 transition-all duration-200 ease-out ${
          error || success
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        {error && (
          <Alert variant="destructive" className="py-2 shadow-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-700 shadow-lg dark:border-green-900/50 dark:bg-green-900/90 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{success}</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-5">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Auto-enable Anthropic&apos;s official Claude channels for compatible native Claude
              sessions. CCS stores only channel selection in <code>config.yaml</code>; bot tokens
              stay in Claude&apos;s per-channel env files.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected</p>
              <p className="mt-1 font-medium">
                {config.selected.length > 0 ? config.selected.join(', ') : 'None'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Applies only to native Claude <code>default</code> and <code>account</code>{' '}
                sessions.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Bun</span>
                <span className={status?.bunInstalled ? 'text-green-600' : 'text-amber-600'}>
                  {status?.bunInstalled ? 'Installed' : 'Missing'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Supported profiles</span>
                <span>{status?.supportedProfiles.join(', ')}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/30 p-4">
              <div className="flex gap-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <Label className="text-sm font-medium">
                    Also add <code>--dangerously-skip-permissions</code>
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Opt-in only. CCS adds the bypass flag once when at least one selected channel
                    is being auto-enabled and you did not already pass a permission flag yourself.
                  </p>
                </div>
              </div>
              <Switch
                checked={config.unattended}
                disabled={saving}
                onCheckedChange={(checked) =>
                  void updateConfig(
                    { unattended: checked },
                    checked ? 'Unattended mode enabled' : 'Unattended mode disabled'
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-4">
            {status?.channels.map((channel) => {
              const enabled = config.selected.includes(channel.id);
              const tokenDraft = tokenDrafts[channel.id];

              return (
                <div key={channel.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Label className="text-base font-medium">{channel.displayName}</Label>
                      <p className="mt-1 text-sm text-muted-foreground">{channel.summary}</p>
                      <p className="mt-2 font-mono text-xs text-muted-foreground">
                        {channel.pluginSpec}
                      </p>
                      {channel.unavailableReason && (
                        <p className="mt-2 text-sm text-amber-600">{channel.unavailableReason}</p>
                      )}
                    </div>
                    <Switch
                      checked={enabled}
                      disabled={saving || Boolean(channel.unavailableReason)}
                      onCheckedChange={(checked) => void toggleChannel(channel.id, checked)}
                    />
                  </div>

                  {channel.requiresToken && (
                    <div className="space-y-3 rounded-lg bg-muted/30 p-4">
                      <p className="text-sm text-muted-foreground">
                        Save <code>{channel.envKey}</code> in Claude&apos;s official channel env
                        file. The dashboard never reads the token value back after save.
                      </p>
                      <Input
                        type="password"
                        value={tokenDraft}
                        onChange={(event) => updateTokenDraft(channel.id, event.target.value)}
                        placeholder={
                          channel.tokenConfigured
                            ? `Configured. Enter a new ${channel.envKey} to replace it.`
                            : `Paste ${channel.envKey}`
                        }
                        disabled={saving}
                      />
                      <div className="text-xs text-muted-foreground break-all">
                        {channel.tokenPath}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void handleSaveToken(channel.id)}
                          disabled={saving || !tokenDraft.trim()}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Save Token
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => void handleClearToken(channel.id)}
                          disabled={saving || !channel.tokenConfigured}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Clear Token
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Claude-side setup</p>
                    {(channel.manualSetupCommands ?? []).map((command) => (
                      <div
                        key={command}
                        className="rounded-md bg-muted px-3 py-2 font-mono text-sm break-all"
                      >
                        {command}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Alert>
            <AlertDescription>
              CCS does not persist a global Claude setting for channels. It only prepares channel
              env files and injects runtime flags when the selected channels are compatible and
              ready.
            </AlertDescription>
          </Alert>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => void refreshAll()} disabled={saving}>
              <RefreshCw className={`mr-2 h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

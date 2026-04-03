/**
 * CLIProxy Control Panel Embed
 *
 * Embeds the CLIProxy management.html with auto-authentication.
 * Local mode proxies through the dashboard (/cliproxy-local/* and /v0/*)
 * so the browser never needs direct access to the CLIProxy port.
 * Supports both local and remote CLIProxy server connections.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefreshCw, AlertCircle, Gauge } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, withApiBase } from '@/lib/api-client';
import type { CliproxyServerConfig } from '@/lib/api-client';
import { CLIPROXY_DEFAULT_PORT } from '@/lib/preset-utils';

interface AuthTokensResponse {
  apiKey: { value: string; isCustom: boolean };
  managementSecret: { value: string; isCustom: boolean };
}

interface ControlPanelEmbedProps {
  port?: number;
}

export function ControlPanelEmbed({ port = CLIPROXY_DEFAULT_PORT }: ControlPanelEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [iframeRevision, setIframeRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch cliproxy_server config for remote/local mode detection
  const { data: cliproxyConfig, error: configError } = useQuery<CliproxyServerConfig>({
    queryKey: ['cliproxy-server-config'],
    queryFn: () => api.cliproxyServer.get(),
    staleTime: 30000, // 30 seconds
  });

  // Fetch auth tokens for local mode (gets effective management secret)
  const { data: authTokens } = useQuery<AuthTokensResponse>({
    queryKey: ['auth-tokens-raw'],
    queryFn: async () => {
      const response = await fetch(withApiBase('/settings/auth/tokens/raw'));
      if (!response.ok) throw new Error('Failed to fetch auth tokens');
      return response.json();
    },
    staleTime: 30000, // 30 seconds
  });

  // Log config fetch errors (fallback to local mode on error)
  useEffect(() => {
    if (configError) {
      console.warn('[ControlPanelEmbed] Config fetch failed, using local mode:', configError);
    }
  }, [configError]);

  // Calculate URLs and settings based on remote or local mode
  const { managementUrl, checkUrl, authToken, isRemote, displayHost } = useMemo(() => {
    const remote = cliproxyConfig?.remote;
    const localPort = cliproxyConfig?.local?.port ?? port;

    if (remote?.enabled && remote?.host) {
      const protocol = remote.protocol || 'http';
      // Use port from config, or default based on protocol (443 for https, 8317 for http)
      const remotePort = remote.port || (protocol === 'https' ? 443 : CLIPROXY_DEFAULT_PORT);
      // Only include port in URL if it's non-standard
      const portSuffix =
        (protocol === 'https' && remotePort === 443) || (protocol === 'http' && remotePort === 80)
          ? ''
          : `:${remotePort}`;
      const baseUrl = `${protocol}://${remote.host}${portSuffix}`;

      return {
        managementUrl: `${baseUrl}/management.html`,
        checkUrl: `${baseUrl}/`,
        authToken: remote.auth_token || undefined,
        isRemote: true,
        displayHost: `${remote.host}${portSuffix}`,
      };
    }

    // Local mode - proxy through dashboard server so the browser never needs
    // direct access to the CLIProxy port (important for Docker/remote deploys).
    // management.html derives its API base from window.location, so the
    // dashboard also proxies /v0/* to CLIProxy alongside /cliproxy-local/*.
    const effectiveSecret = authTokens?.managementSecret?.value || 'ccs';
    return {
      managementUrl: withApiBase('/cliproxy-local/management.html'),
      checkUrl: withApiBase('/cliproxy-local/'),
      authToken: effectiveSecret,
      isRemote: false,
      displayHost: `localhost:${localPort}`,
    };
  }, [cliproxyConfig, authTokens, port]);

  const iframeLoaded = loadedUrl === managementUrl;
  const isLoading = !iframeLoaded;

  // Check if CLIProxy is running
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const updateConnectionState = (connected: boolean, nextError: string | null) => {
      if (cancelled) return;
      setIsConnected(connected);
      setError(nextError);
    };

    const checkConnection = async () => {
      try {
        if (isRemote) {
          // Remote mode: use the test endpoint via same-origin API to avoid CORS
          const remote = cliproxyConfig?.remote;
          const result = await api.cliproxyServer.test({
            host: remote?.host ?? '',
            port: remote?.port,
            protocol: remote?.protocol ?? 'http',
            authToken: remote?.auth_token,
          });
          if (result?.reachable) {
            updateConnectionState(true, null);
          } else {
            updateConnectionState(
              false,
              result?.error
                ? `Remote CLIProxy at ${displayHost}: ${result.error}`
                : `Remote CLIProxy at ${displayHost} returned an error`
            );
          }
        } else {
          // Local mode: probe the proxied control panel root directly.
          const response = await fetch(checkUrl, { signal: controller.signal });
          if (response.ok) {
            updateConnectionState(true, null);
          } else {
            updateConnectionState(false, 'CLIProxy returned an error');
          }
        }
      } catch (e) {
        // Ignore abort errors (component unmounting)
        if (e instanceof Error && e.name === 'AbortError') return;

        updateConnectionState(
          false,
          isRemote
            ? `Remote CLIProxy at ${displayHost} is not reachable`
            : 'CLIProxy is not running'
        );
      }
    };

    // Start connection check with timeout
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    checkConnection().finally(() => clearTimeout(timeoutId));

    // Cleanup: abort fetch on unmount
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [checkUrl, isRemote, displayHost, cliproxyConfig]);

  // In local mode, wait for authTokens to resolve before rendering the iframe.
  // This prevents seeding localStorage with the fallback 'ccs' secret — management.html
  // only reads these keys once during restoreSession() and the iframe isn't remounted
  // when the real token arrives later.
  const tokensReady = isRemote || authTokens !== undefined;

  // Pre-seed localStorage for management.html auto-login in local (proxied) mode.
  // management.html (same-origin via proxy) reads these keys on init via its
  // restoreSession flow: isLoggedIn + apiBase + managementKey → auto-login.
  // IMPORTANT: This must run synchronously during render (useMemo), NOT in useEffect,
  // because the iframe starts loading as soon as it's rendered — if we seed after
  // render, management.html's restoreSession() runs before the values are set.
  useMemo(() => {
    if (isRemote || !authToken || !tokensReady) return;

    // management.html's apiBase = window.location origin + /v0/management
    // Since it's proxied through the dashboard, window.location is the dashboard origin.
    // The /v0/* proxy forwards these calls to CLIProxy.
    const apiBase = `${window.location.origin}/v0/management`;

    try {
      // Set as plain strings — management.html's migratePlaintextKeys() picks up
      // non-encrypted values and migrates them into its encrypted storage on init.
      localStorage.setItem('apiBase', apiBase);
      localStorage.setItem('managementKey', authToken);
      localStorage.setItem('isLoggedIn', 'true');
    } catch (e) {
      console.debug('[ControlPanelEmbed] Failed to pre-seed localStorage:', e);
    }
  }, [isRemote, authToken, tokensReady]);

  // Handle iframe load - mark ready then let effect post credentials.
  const handleIframeLoad = useCallback(() => {
    setLoadedUrl(managementUrl);
  }, [managementUrl]);

  const handleRefresh = () => {
    setLoadedUrl(null);
    setIframeRevision((value) => value + 1);
    setError(null);
    setIsConnected(false);
  };

  // Show error state if CLIProxy is not running
  if (!isConnected && error) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">CLIProxy Control Panel</h2>
          </div>
          <button
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center bg-muted/20">
          <div className="text-center max-w-md px-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">CLIProxy Not Available</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <p className="text-sm text-muted-foreground">
              Start a CLIProxy session with{' '}
              <code className="bg-muted px-1 rounded">ccs gemini</code> or run{' '}
              <code className="bg-muted px-1 rounded">ccs config</code> which auto-starts it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {isRemote
                  ? `Loading Control Panel from ${displayHost}...`
                  : 'Loading Control Panel...'}
              </p>
            </div>
          </div>
        )}

        {/* Iframe — deferred until auth tokens resolve to avoid seeding wrong credentials */}
        {tokensReady && (
          <iframe
            key={`${managementUrl}:${iframeRevision}`}
            ref={iframeRef}
            src={managementUrl}
            className="flex-1 w-full border-0"
            title="CLIProxy Management Panel"
            onLoad={handleIframeLoad}
          />
        )}
      </div>
    </div>
  );
}

import { AlertTriangle, Image as ImageIcon, Route } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ImageAnalysisStatus } from '@/lib/api-client';

interface ImageAnalysisStatusSectionProps {
  status?: ImageAnalysisStatus | null;
}

function getBadge(status: ImageAnalysisStatus | null | undefined): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (status?.status) {
    case 'active':
      return { label: 'Ready', variant: 'default' };
    case 'mapped':
      return { label: 'Saved mapping', variant: 'secondary' };
    case 'attention':
      return { label: 'Needs review', variant: 'outline' };
    case 'disabled':
      return { label: 'Disabled', variant: 'outline' };
    case 'hook-missing':
      return { label: 'Setup needed', variant: 'destructive' };
    case 'skipped':
      return { label: 'Not available', variant: 'outline' };
    default:
      return { label: 'Checking', variant: 'outline' };
  }
}

function getSummary(status: ImageAnalysisStatus): string {
  const backendName = status.backendDisplayName || status.backendId || 'this backend';

  switch (status.status) {
    case 'disabled':
      return "Disabled globally. This profile uses Claude's built-in file reading because CCS image analysis is turned off.";
    case 'mapped':
      return `Ready via saved ${backendName} mapping. CCS could not infer the backend from this alias, so it uses the mapping saved in CCS config.`;
    case 'attention':
      return `Ready via ${backendName}, but runtime is using the current CLIProxy route instead of the route saved in this profile.`;
    case 'hook-missing':
      return `Configured for ${backendName}, but the image-analysis hook is not fully installed yet.`;
    case 'skipped':
      return status.reason || 'Skipped for this profile.';
    case 'active':
    default:
      if (status.resolutionSource === 'cliproxy-bridge') {
        return `Ready via ${backendName}. Images and PDFs are routed through CLIProxy before Claude sees text.`;
      }

      if (status.resolutionSource === 'fallback-backend') {
        return `Ready via ${backendName} fallback. Images and PDFs are routed through CLIProxy before Claude sees text.`;
      }

      return `Ready via ${backendName}. Images and PDFs are routed through CLIProxy before Claude sees text.`;
  }
}

function getRuntimeLine(status: ImageAnalysisStatus): string {
  if (!status.runtimePath) {
    return 'Read -> native file access';
  }

  return `Read -> image-analysis hook -> ${status.runtimePath}`;
}

function getPersistenceLine(status: ImageAnalysisStatus): string {
  if (!status.shouldPersistHook || !status.persistencePath) {
    return 'Not persisted for this profile type';
  }

  if (status.hookInstalled) {
    return `${status.persistencePath} hook`;
  }

  return `${status.persistencePath} hook missing`;
}

export function ImageAnalysisStatusSection({ status }: ImageAnalysisStatusSectionProps) {
  if (!status) {
    return (
      <div className="rounded-md border bg-muted/20 p-4" aria-live="polite">
        <div className="h-4 w-44 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-72 animate-pulse rounded bg-muted" />
        <p className="mt-3 text-sm text-muted-foreground">Checking backend status...</p>
      </div>
    );
  }

  const badge = getBadge(status);
  const detailLabel = status.supported ? 'Model' : 'Reason';
  const detailValue = status.supported ? status.model : status.reason || 'Unavailable';

  return (
    <section className="rounded-md border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-sky-600" />
            <h3 className="text-sm font-semibold">Image-analysis backend</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Derived runtime status. This section is not written into the JSON editor above.
          </p>
        </div>
        <Badge variant={badge.variant} className="shrink-0 text-[11px]">
          {badge.label}
        </Badge>
      </div>

      <p aria-live="polite" className="mt-3 text-sm leading-6 text-muted-foreground">
        {getSummary(status)}
      </p>

      <dl className="mt-4 grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Backend
          </dt>
          <dd className="text-sm font-medium">{status.backendDisplayName || 'Unresolved'}</dd>
        </div>

        <div className="space-y-1">
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Runtime
          </dt>
          <dd
            className="font-mono text-xs leading-5 text-foreground"
            title={getRuntimeLine(status)}
          >
            {getRuntimeLine(status)}
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Persistence
          </dt>
          <dd
            className="font-mono text-xs leading-5 text-foreground"
            title={status.persistencePath || 'Not persisted'}
          >
            {getPersistenceLine(status)}
          </dd>
        </div>

        <div className="space-y-1">
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {detailLabel}
          </dt>
          <dd className={cn('text-sm text-foreground', status.supported && 'font-mono text-xs')}>
            {detailValue}
          </dd>
        </div>
      </dl>

      {(status.status === 'attention' || status.status === 'hook-missing') && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>{status.reason}</span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <Route className="h-3.5 w-3.5" />
        <span>
          WebSearch stays managed separately and is not controlled by this backend status.
        </span>
      </div>
    </section>
  );
}

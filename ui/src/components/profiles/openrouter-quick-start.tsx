import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOpenRouterReady } from '@/hooks/use-openrouter-models';
import { cn } from '@/lib/utils';
import {
  ArrowRight,
  CloudCog,
  ExternalLink,
  KeyRound,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface OpenRouterQuickStartProps {
  hasProfiles: boolean;
  profileCount: number;
  onOpenRouterClick: () => void;
  onAlibabaCodingPlanClick: () => void;
  onCliproxyClick: () => void;
  onCustomClick: () => void;
}

interface QuickStartCardProps {
  badge: string;
  badgeClassName?: string;
  className?: string;
  title: string;
  description: string;
  visual: ReactNode;
  highlights: Array<{ icon: ReactNode; label: string }>;
  actionLabel: string;
  actionClassName: string;
  onAction: () => void;
  footer?: ReactNode;
}

function QuickStartCard({
  badge,
  badgeClassName,
  className,
  title,
  description,
  visual,
  highlights,
  actionLabel,
  actionClassName,
  onAction,
  footer,
}: QuickStartCardProps) {
  return (
    <Card className={cn('flex h-full flex-col border shadow-sm', className)}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-center gap-3">
          {visual}
          <Badge variant="secondary" className={badgeClassName}>
            {badge}
          </Badge>
        </div>
        <div className="space-y-1.5">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="text-sm leading-6">{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="mt-auto flex flex-1 flex-col gap-4 pt-0">
        <div className="space-y-2 text-xs text-muted-foreground">
          {highlights.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <Button onClick={onAction} className={actionClassName}>
          {actionLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

export function OpenRouterQuickStart({
  hasProfiles,
  profileCount,
  onOpenRouterClick,
  onAlibabaCodingPlanClick,
  onCliproxyClick,
  onCustomClick,
}: OpenRouterQuickStartProps) {
  const { t } = useTranslation();
  const { modelCount, isLoading } = useOpenRouterReady();
  const modelCountLabel = isLoading ? '300+' : `${modelCount}+`;
  const profileSummaryLabel = hasProfiles
    ? t('openrouterQuickStart.profileCount', { count: profileCount })
    : t('openrouterQuickStart.recommended');
  const summaryTitle = hasProfiles
    ? t('openrouterQuickStart.selectProfileTitle')
    : t('apiProfiles.noProfilesYet');
  const summaryDescription = hasProfiles
    ? t('openrouterQuickStart.summaryDescriptionWithProfiles', { count: profileCount })
    : t('openrouterQuickStart.summaryDescriptionNoProfiles');

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-muted/20 p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <Card className="border-dashed bg-background/90 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{profileSummaryLabel}</Badge>
                <Badge variant="outline">
                  {t('openrouterQuickStart.openrouterModelsBadge', { modelCountLabel })}
                </Badge>
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{summaryTitle}</h2>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                  {summaryDescription}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onCustomClick} className="shrink-0">
              {t('openrouterQuickStart.createCustomProfile')}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <QuickStartCard
            badge={t('openrouterQuickStart.recommended')}
            title={t('openrouterQuickStart.title')}
            description={t('openrouterQuickStart.description', { modelCountLabel })}
            visual={
              <div className="rounded-lg bg-accent/10 p-2">
                <img src="/icons/openrouter.svg" alt="OpenRouter" className="h-5 w-5" />
              </div>
            }
            highlights={[
              {
                icon: <Zap className="h-3.5 w-3.5 text-accent" />,
                label: t('openrouterQuickStart.featureOneApi'),
              },
              {
                icon: <Sparkles className="h-3.5 w-3.5 text-accent" />,
                label: t('openrouterQuickStart.featureTierMapping'),
              },
            ]}
            actionLabel={t('openrouterQuickStart.createOpenRouterProfile')}
            actionClassName="w-full bg-accent text-white hover:bg-accent/90"
            onAction={onOpenRouterClick}
            footer={
              <>
                {t('openrouterQuickStart.getApiKeyAt')}{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  openrouter.ai/keys
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            }
          />

          <QuickStartCard
            badge={t('openrouterQuickStart.runtimeProviderBadge')}
            badgeClassName="bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
            title={t('openrouterQuickStart.runtimeProviderTitle')}
            description={t('openrouterQuickStart.runtimeProviderDescription')}
            visual={
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <SlidersHorizontal className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
              </div>
            }
            highlights={[
              {
                icon: <SlidersHorizontal className="h-3.5 w-3.5 text-emerald-600" />,
                label: t('openrouterQuickStart.runtimeProviderFeatureConnectors'),
              },
              {
                icon: <KeyRound className="h-3.5 w-3.5 text-emerald-600" />,
                label: t('openrouterQuickStart.runtimeProviderFeatureSecrets'),
              },
            ]}
            actionLabel={t('openrouterQuickStart.runtimeProviderTitle')}
            actionClassName="w-full bg-emerald-600 text-white hover:bg-emerald-600/90"
            onAction={onCliproxyClick}
            footer={<span>{t('openrouterQuickStart.runtimeProviderFooter')}</span>}
          />

          <QuickStartCard
            badge={t('alibabaCodingPlanQuickStart.recommended')}
            badgeClassName="bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200"
            className="lg:col-span-2"
            title={t('alibabaCodingPlanQuickStart.title')}
            description={t('alibabaCodingPlanQuickStart.description')}
            visual={
              <div className="rounded-lg bg-orange-500/10 p-2">
                <img
                  src="/assets/providers/alibabacloud-color.svg"
                  alt="Alibaba Coding Plan"
                  className="h-5 w-5"
                />
              </div>
            }
            highlights={[
              {
                icon: <CloudCog className="h-3.5 w-3.5 text-orange-600" />,
                label: t('alibabaCodingPlanQuickStart.featureEndpoint'),
              },
              {
                icon: <KeyRound className="h-3.5 w-3.5 text-orange-600" />,
                label: t('alibabaCodingPlanQuickStart.featureKeyFormat'),
              },
            ]}
            actionLabel={t('alibabaCodingPlanQuickStart.createAlibabaProfile')}
            actionClassName="w-full bg-orange-600 text-white hover:bg-orange-600/90"
            onAction={onAlibabaCodingPlanClick}
            footer={
              <>
                {t('alibabaCodingPlanQuickStart.readGuideAt')}{' '}
                <a
                  href="https://www.alibabacloud.com/help/en/model-studio/coding-plan"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-orange-700 hover:underline dark:text-orange-400"
                >
                  Alibaba Cloud Model Studio
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

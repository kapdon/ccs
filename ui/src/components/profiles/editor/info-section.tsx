/**
 * Profile Info Section
 * Displays profile information and usage commands
 */

import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/ui/copy-button';
import { Info } from 'lucide-react';
import type { SettingsResponse } from './types';
import type { CliTarget } from '@/lib/api-client';

interface InfoSectionProps {
  profileName: string;
  target: CliTarget;
  data: SettingsResponse | undefined;
}

export function InfoSection({ profileName, target, data }: InfoSectionProps) {
  const { t } = useTranslation();
  const isDroidTarget = target === 'droid';

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Profile Information */}
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Info className="w-4 h-4" />
            {t('profileEditor.profileInfo')}
          </h3>
          <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
            {data && (
              <>
                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                  <span className="font-medium text-muted-foreground">
                    {t('profileEditor.profileName')}
                  </span>
                  <span className="font-mono">{data.profile}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                  <span className="font-medium text-muted-foreground">
                    {t('profileEditor.filePath')}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">
                      {data.path}
                    </code>
                    <CopyButton value={data.path} size="icon" className="h-5 w-5" />
                  </div>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                  <span className="font-medium text-muted-foreground">
                    {t('profileEditor.lastModified')}
                  </span>
                  <span className="text-xs">{new Date(data.mtime).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                  <span className="font-medium text-muted-foreground">
                    {t('profileEditor.defaultTarget')}
                  </span>
                  <span className="font-mono">{target}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Usage */}
        <div>
          <h3 className="text-sm font-medium mb-3">{t('profileEditor.quickUsage')}</h3>
          <div className="space-y-3 bg-card rounded-lg border p-4 shadow-sm">
            <div>
              <Label className="text-xs text-muted-foreground">
                {t('profileEditor.runWithProfile')}
              </Label>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono truncate">
                  ccs {profileName} "prompt"
                </code>
                <CopyButton value={`ccs ${profileName} "prompt"`} size="icon" className="h-6 w-6" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {isDroidTarget
                  ? t('profileEditor.droidAliasExplicit')
                  : t('profileEditor.runOnDroid')}
              </Label>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono truncate">
                  {`ccs-droid ${profileName} "prompt"`}
                </code>
                <CopyButton
                  value={`ccs-droid ${profileName} "prompt"`}
                  size="icon"
                  className="h-6 w-6"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {isDroidTarget
                  ? t('profileEditor.overrideToClaude')
                  : t('profileEditor.runOnDroidWithFlag')}
              </Label>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono truncate">
                  ccs {profileName} --target {isDroidTarget ? 'claude' : 'droid'} "prompt"
                </code>
                <CopyButton
                  value={`ccs ${profileName} --target ${isDroidTarget ? 'claude' : 'droid'} "prompt"`}
                  size="icon"
                  className="h-6 w-6"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">
                {t('profileEditor.setAsDefault')}
              </Label>
              <div className="mt-1 flex gap-2">
                <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono truncate">
                  ccs default {profileName}
                </code>
                <CopyButton value={`ccs default ${profileName}`} size="icon" className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

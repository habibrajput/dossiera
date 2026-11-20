'use client';

import { useEffect, useState } from 'react';
import { Briefcase, Check, Trash } from '@phosphor-icons/react';
import {
  deleteApiKey,
  fetchApiKeyStatus,
  fetchFeatureConfig,
  JOB_SEARCH_PROVIDERS,
  updateApiKeys,
  updateFeatureConfig,
  type ApiKeyProviderStatus,
  type JobSearchProvider,
} from '@/lib/api/config';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Job search source and its private key. Each keyed source keeps its own key. */
export function JobSearchSettings() {
  const { t } = useTranslations();
  const [provider, setProvider] = useState<JobSearchProvider>('off');
  const [statuses, setStatuses] = useState<ApiKeyProviderStatus[]>([]);
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchFeatureConfig().catch(() => null),
      fetchApiKeyStatus().catch(() => null),
    ]).then(([config, status]) => {
      if (!active) return;
      const stored = config?.job_search_provider;
      if (stored && JOB_SEARCH_PROVIDERS.some((source) => source.id === stored)) {
        setProvider(stored);
      }
      setStatuses(status?.providers ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const selected =
    JOB_SEARCH_PROVIDERS.find((source) => source.id === provider) ?? JOB_SEARCH_PROVIDERS[4];
  const keyProvider = provider === 'jsearch' || provider === 'adzuna' ? provider : null;
  const storedKey = statuses.find((status) => status.provider === keyProvider && status.configured);

  const changeProvider = async (next: JobSearchProvider) => {
    if (next === provider) return;
    const previous = provider;
    setProvider(next);
    setKeyInput('');
    setSaved(false);
    setError(null);
    try {
      const updated = await updateFeatureConfig({ job_search_provider: next });
      setProvider(updated.job_search_provider ?? next);
    } catch {
      setProvider(previous);
      setError(t('settings.jobSearch.saveError'));
    }
  };

  const refreshKeyStatus = async () => {
    const status = await fetchApiKeyStatus().catch(() => null);
    setStatuses(status?.providers ?? []);
  };

  const saveKey = async () => {
    if (!keyProvider || !keyInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await updateApiKeys({ [keyProvider]: keyInput.trim() });
      await refreshKeyStatus();
      setKeyInput('');
      setSaved(true);
    } catch {
      setError(t('settings.jobSearch.keySaveError'));
    } finally {
      setSaving(false);
    }
  };

  const removeKey = async () => {
    if (!keyProvider) return;
    setSaving(true);
    setError(null);
    try {
      await deleteApiKey(keyProvider);
      await refreshKeyStatus();
      setSaved(false);
    } catch {
      setError(t('settings.jobSearch.keySaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6" aria-labelledby="job-search-title">
      <div className="flex items-center gap-2 border-b border-panel-hover pb-2">
        <Briefcase aria-hidden="true" className="w-4 h-4" />
        <h2 id="job-search-title" className="font-serif text-xl font-bold text-ink text-balance">
          {t('settings.jobSearch.title')}
        </h2>
      </div>

      <p className="font-mono text-sm text-ink-soft">{t('settings.jobSearch.description')}</p>

      {error && (
        <Alert tone="error" title={t('common.error')}>
          {error}
        </Alert>
      )}

      <fieldset className="space-y-2" disabled={loading}>
        <legend className="sr-only">{t('settings.jobSearch.title')}</legend>
        {JOB_SEARCH_PROVIDERS.map(({ id, titleKey, descriptionKey, metaKey, requiresKey }) => {
          const active = provider === id;
          return (
            <label
              key={id}
              className={cn(
                'flex cursor-pointer items-start gap-3 border border-ink p-4 shadow-sw-nested',
                active ? 'bg-info-tint' : 'bg-white hover:bg-paper'
              )}
            >
              <input
                type="radio"
                name="job-search-provider"
                value={id}
                checked={active}
                onChange={() => void changeProvider(id)}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold uppercase text-ink">
                    {t(titleKey)}
                  </span>
                  {requiresKey && (
                    <span className="font-mono text-xs uppercase text-steel">
                      {t('settings.jobSearch.requiresKey')}
                    </span>
                  )}
                  {active && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}
                </span>
                <span className="mt-1 block font-sans text-sm text-ink-soft">
                  {t(descriptionKey)}
                </span>
                <span className="mt-2 block font-mono text-xs uppercase text-steel">
                  {t(metaKey)}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {keyProvider ? (
        <div className="space-y-3 border border-ink bg-paper p-4 shadow-sw-nested">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="job-search-api-key">
              {t('settings.jobSearch.apiKeyLabel', { provider: t(selected.titleKey) })}
            </Label>
            {storedKey && (
              <StatusIndicator tone="ready" live={false}>
                {t('settings.jobSearch.savedKey')}
              </StatusIndicator>
            )}
          </div>
          <Input
            id="job-search-api-key"
            type="password"
            value={keyInput}
            onChange={(event) => {
              setKeyInput(event.target.value);
              setSaved(false);
            }}
            placeholder={t('settings.jobSearch.apiKeyPlaceholder', {
              provider: t(selected.titleKey),
            })}
            autoComplete="off"
          />
          <p className="font-mono text-xs text-steel">{t('settings.jobSearch.apiKeyHelp')}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void saveKey()}
              disabled={saving || !keyInput.trim()}
            >
              {saving ? t('settings.jobSearch.saving') : t('settings.jobSearch.saveKey')}
            </Button>
            {storedKey && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void removeKey()}
                disabled={saving}
              >
                <Trash aria-hidden="true" />
                {t('common.delete')}
              </Button>
            )}
            {saved && (
              <span className="font-mono text-xs text-success">
                {t('settings.jobSearch.savedMessage')}
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="font-mono text-xs text-steel">{t('settings.jobSearch.noKeyNeeded')}</p>
      )}
    </section>
  );
}

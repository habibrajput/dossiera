import { ResumePreviewProvider } from '@/components/common/resume_previewer_context';
import { TopNav } from '@/components/common/top-nav';
import { StatusCacheProvider } from '@/lib/context/status-cache';
import { LanguageProvider } from '@/lib/context/language-context';
import { LocalizedErrorBoundary } from '@/components/common/error-boundary';
import { MotionProvider } from '@/components/common/motion-provider';
import { EffectsProvider } from '@/lib/context/effects-context';
import { BlockDissolveProvider } from '@/components/effects/block-dissolve-provider';
import { LazyToaster } from '@/components/ui/lazy-toaster';

export default function DefaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <StatusCacheProvider>
      <LanguageProvider>
        <ResumePreviewProvider>
          <LocalizedErrorBoundary>
            <MotionProvider>
              <EffectsProvider>
                <BlockDissolveProvider>
                  <main className="flex h-dvh">
                    <TopNav />
                    <div className="min-h-0 min-w-0 flex-1">{children}</div>
                  </main>
                </BlockDissolveProvider>
              </EffectsProvider>
            </MotionProvider>
          </LocalizedErrorBoundary>
        </ResumePreviewProvider>
        <LazyToaster />
      </LanguageProvider>
    </StatusCacheProvider>
  );
}

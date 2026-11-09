'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  Buildings,
  Envelope,
  Files,
  MagnifyingGlass,
  Robot,
  SquaresFour,
} from '@phosphor-icons/react';
import { buttonClass } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: SquaresFour },
  { href: '/resume-board', labelKey: 'nav.resumeBoard', icon: Files },
  { href: '/find-jobs', labelKey: 'nav.findJobs', icon: MagnifyingGlass },
  { href: '/startups', labelKey: 'nav.startups', icon: Buildings },
  { href: '/agent', labelKey: 'nav.agent', icon: Robot },
  { href: '/tracker', labelKey: 'nav.applications', icon: Briefcase },
  { href: '/inbox', labelKey: 'nav.inbox', icon: Envelope },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <header className="sticky top-0 z-40 h-16 shrink-0 border-b border-ink bg-canvas">
      <div className="mx-auto flex h-full max-w-[104rem] items-center gap-4 px-4 md:px-8">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={t('nav.dashboard')}
        >
          <Image src="/logo.svg" alt="" width={24} height={24} className="size-6" />
          <span className="hidden font-mono text-sm font-bold uppercase tracking-tight text-ink lg:inline">
            Resume Matcher
          </span>
        </Link>

        <nav
          aria-label={t('nav.primary')}
          className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-2"
        >
          {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={buttonClass({
                  variant: active ? 'default' : 'outline',
                  size: 'sm',
                  className: 'shrink-0',
                })}
              >
                <Icon aria-hidden="true" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNavigation = pathname !== '/';

  return (
    <>
      {showNavigation && <TopNav />}
      <main
        className={cn(
          'flex flex-col',
          showNavigation ? 'min-h-[calc(100vh-4rem)]' : 'min-h-screen'
        )}
        style={
          showNavigation
            ? ({ '--app-viewport-height': 'calc(100dvh - 4rem)' } as React.CSSProperties)
            : undefined
        }
      >
        {children}
      </main>
    </>
  );
}

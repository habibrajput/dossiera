'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Briefcase,
  ChartLineUp,
  Files,
  Gear,
  ListNumbers,
  Robot,
  SignOut,
  SquaresFour,
} from '@phosphor-icons/react';
import { logout } from '@/lib/api/auth';
import { useTranslations } from '@/lib/i18n';
import { buttonClass } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', labelKey: 'nav.dashboard', Icon: ChartLineUp },
  { href: '/resume-board', labelKey: 'nav.resumeBoard', Icon: Files },
  { href: '/queue', labelKey: 'nav.queue', Icon: ListNumbers },
  { href: '/tracker', labelKey: 'nav.applicationTracker', Icon: SquaresFour },
  { href: '/find-jobs', labelKey: 'nav.findJobs', Icon: Briefcase },
  { href: '/agent', labelKey: 'nav.agent', Icon: Robot },
] as const;

const ICON_BUTTON = 'size-9 shrink-0 justify-center p-0';

/** Compact icon rail. The label appears on hover/focus, beside the icon. */
function RailLabel({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap border border-ink bg-white px-2 py-1 font-mono text-xs uppercase text-ink opacity-0 shadow-sw-default transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    >
      {children}
    </span>
  );
}

/** Global app navigation. Kept outside page frames so it stays put across routes. */
export function TopNav() {
  const { t } = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
  const menuId = useId();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await logout();
    } catch (error) {
      console.error('Failed to sign out', error);
    } finally {
      router.replace('/');
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      // The menu has two items: either arrow key moves focus to the other one.
      itemRefs.current[index === 0 ? 1 : 0]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setMenuOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'Tab') {
      setMenuOpen(false);
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex h-dvh w-12 shrink-0 flex-col items-center gap-1 border-r border-ink bg-canvas py-3">
      <Link
        href="/dashboard"
        aria-label={t('nav.home')}
        className={cn(
          buttonClass({ variant: 'ghost', size: 'sm', className: `${ICON_BUTTON} group` })
        )}
      >
        <Image src="/logo.svg" alt="" width={20} height={20} className="size-5" />
        <RailLabel>{t('nav.home')}</RailLabel>
      </Link>

      <nav aria-label={t('nav.main')} className="flex flex-col items-center gap-1">
        {NAV_ITEMS.map(({ href, labelKey, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={t(labelKey)}
              aria-current={active ? 'page' : undefined}
              className={buttonClass({
                variant: active ? 'secondary' : 'ghost',
                size: 'sm',
                className: `${ICON_BUTTON} group`,
              })}
            >
              <Icon aria-hidden="true" />
              <RailLabel>{t(labelKey)}</RailLabel>
            </Link>
          );
        })}
      </nav>

      <div ref={menuRef} className="relative mt-auto">
        <button
          ref={triggerRef}
          type="button"
          aria-label={t('nav.settings')}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          onClick={() => setMenuOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setMenuOpen(true);
            }
          }}
          className={buttonClass({
            variant: 'ghost',
            size: 'sm',
            className: `${ICON_BUTTON} group`,
          })}
        >
          <Gear aria-hidden="true" />
          <RailLabel>{t('nav.settings')}</RailLabel>
        </button>

        {menuOpen && (
          <div
            id={menuId}
            role="menu"
            aria-label={t('nav.settings')}
            className="absolute left-full top-0 z-50 ml-2 w-48 divide-y divide-ink border border-ink bg-white shadow-sw-default"
          >
            <Link
              ref={(el) => {
                itemRefs.current[0] = el;
              }}
              role="menuitem"
              href="/settings"
              onClick={() => setMenuOpen(false)}
              onKeyDown={(event) => onMenuKeyDown(event, 0)}
              className="flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase text-ink hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <Gear aria-hidden="true" />
              {t('nav.settings')}
            </Link>
            <button
              ref={(el) => {
                itemRefs.current[1] = el;
              }}
              type="button"
              role="menuitem"
              onClick={handleLogout}
              onKeyDown={(event) => onMenuKeyDown(event, 1)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs uppercase text-ink hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <SignOut aria-hidden="true" />
              {t('login.signOut')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

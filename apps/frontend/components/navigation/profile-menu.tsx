'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, m } from 'motion/react';
import { Gear, SignOut, SpinnerGap, UserCircle } from '@phosphor-icons/react';
import { buttonClass } from '@/components/ui/button';
import { fetchAuthState, logout } from '@/lib/api/auth';
import { useTranslations } from '@/lib/i18n';
import { DURATION, EASE_OUT_EXPO, SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * The top-bar identity control. It is deliberately a menu, not a select: the
 * two actions leave the page, so they are menu items and not selectable values.
 */
export function ProfileMenu() {
  const { t } = useTranslations();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const settingsRef = useRef<HTMLAnchorElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) settingsRef.current?.focus();
  }, [isOpen]);

  const close = (returnFocus = true) => {
    setIsOpen(false);
    setError(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    setError(false);
    try {
      await logout();
      const state = await fetchAuthState();
      router.refresh();
      setIsOpen(false);
      if (state.authRequired) router.replace('/login');
    } catch {
      setSigningOut(false);
      setError(true);
    }
  };

  return (
    <div ref={containerRef} className="relative ml-auto shrink-0" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('nav.profile')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        className={buttonClass({ variant: 'outline', size: 'icon-sm' })}
      >
        <UserCircle aria-hidden="true" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <m.div
            key="profile-menu"
            id={menuId}
            role="menu"
            aria-label={t('nav.profile')}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: {
                opacity: { duration: DURATION.menuIn, ease: EASE_OUT_EXPO },
                scale: SPRING,
              },
            }}
            exit={{
              opacity: 0,
              scale: 0.98,
              transition: { duration: DURATION.menuOut, ease: EASE_OUT_EXPO },
            }}
            className="absolute right-0 top-full z-50 mt-2 w-56 divide-y divide-border overflow-hidden rounded-lg border border-border bg-white shadow-sw-default"
          >
            <Link
              ref={settingsRef}
              role="menuitem"
              href="/settings"
              onClick={() => close(false)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <Gear aria-hidden="true" />
              {t('nav.settings')}
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              disabled={signingOut}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors',
                'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            >
              {signingOut ? (
                <SpinnerGap aria-hidden="true" className="animate-spin" />
              ) : (
                <SignOut aria-hidden="true" />
              )}
              {signingOut ? t('nav.signingOut') : t('nav.logout')}
            </button>
            {error && (
              <p role="alert" className="px-3 py-2 font-mono text-xs text-destructive">
                {t('nav.logoutFailed')}
              </p>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

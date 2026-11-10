import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Hero from '@/components/home/hero';

vi.mock('@/lib/i18n', () => ({ useTranslations: () => ({ t: (key: string) => key }) }));

const css = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../app/(default)/css/globals.css'),
  'utf8'
);

describe('Hero entrance', () => {
  it('staggers the heading and the CTA row, and nothing finer', () => {
    render(<Hero />);
    const links = screen.getAllByRole('link');
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('hero-enter');
    expect(links[0].parentElement).toHaveClass('hero-enter', 'hero-enter-delay-2');
    for (const link of links) expect(link.className).not.toContain('hero-enter');
  });

  it('shows only the local Launch App action, with no external branding links', () => {
    render(<Hero />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('home.launchApp');
    expect(links[0]).toHaveAttribute('href', '/dashboard');
    expect(links[0]).toHaveClass('bg-primary');
    expect(
      document.querySelector('a[href*="github.com"], a[href*="resumematcher.fyi"]')
    ).toBeNull();
    expect(screen.queryByRole('link', { name: 'community.follow' })).toBeNull();
  });

  it('sits on plain Canvas, ready for the background effect behind its frame', () => {
    const { container } = render(<Hero />);
    expect(container.firstChild).toHaveClass('relative', 'isolate', 'bg-canvas');
    expect(container.firstChild).not.toHaveClass('bg-blueprint');
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('keeps the xl shadow, which only the home hero frame carries', () => {
    const { container } = render(<Hero />);
    const frame = container.querySelector('.shadow-sw-xl');
    expect(frame).not.toBeNull();
    expect(frame!.className).not.toMatch(/shadow-sw-(?:nested|default|lg)/);
  });

  it('defines the one-shot expo keyframes in CSS and switches them off for reduced motion', () => {
    expect(css).toMatch(
      /\.hero-enter\s*\{\s*animation:\s*hero-enter 300ms cubic-bezier\(0\.16, 1, 0\.3, 1\) both;/
    );
    expect(css).toMatch(/\.hero-enter-delay-2\s*\{\s*animation-delay:\s*120ms;/);
    expect(css).not.toContain('hero-enter-delay-1');
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{\s*\.hero-enter\s*\{\s*animation:\s*none;/
    );
  });

  it('no longer pulls in tw-animate-css', () => {
    expect(css).not.toContain('tw-animate-css');
  });
});

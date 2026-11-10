import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * The "DEFAULT" marker for the default master resume (dashboard + viewer).
 * Reproduces the badge as it rendered on the dashboard tile (`border-black` → `border-border`).
 * `className` lets a host recolour it (the dashboard tile turns its frame white on blue).
 */
export function DefaultBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-md border border-border px-1 font-mono text-xs uppercase',
        className
      )}
    >
      {children}
    </span>
  );
}

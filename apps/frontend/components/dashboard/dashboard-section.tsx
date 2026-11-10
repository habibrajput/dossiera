import type { ReactNode } from 'react';

interface DashboardSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  description,
  action,
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <section className={`border border-border bg-canvas shadow-sw-nested ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-6 md:p-6">
        <div>
          <h2 className="font-serif text-2xl font-bold uppercase tracking-tight text-ink">
            {title}
          </h2>
          {description && <p className="mt-2 max-w-[62ch] text-sm text-ink-soft">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-6 md:p-6">{children}</div>
    </section>
  );
}

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Soft, shadcn-style button. Hairline borders, gentle elevation, colour/focus
 * feedback instead of hard-offset press movement.
 */
export type ButtonVariant =
  | 'default'
  | 'destructive'
  | 'outline-destructive'
  | 'success'
  | 'warning'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'link';

export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const BASE = cn(
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
  'text-sm font-medium',
  'transition-[background-color,border-color,box-shadow,color]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
  'disabled:pointer-events-none disabled:opacity-50',
  "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0"
);

const ELEVATION = 'shadow-sw-sm hover:shadow-sw-sm active:shadow-none';

const VARIANTS: Record<ButtonVariant, string> = {
  default: cn('border border-transparent bg-primary text-white hover:bg-primary-hover', ELEVATION),
  destructive: cn(
    'border border-transparent bg-destructive text-white hover:bg-destructive-hover',
    ELEVATION
  ),
  'outline-destructive': cn(
    'border border-destructive bg-canvas text-destructive hover:bg-destructive-tint',
    ELEVATION
  ),
  success: cn('border border-transparent bg-success text-white hover:bg-success-hover', ELEVATION),
  warning: cn('border border-transparent bg-warning text-ink hover:bg-warning-hover', ELEVATION),
  outline: cn('border border-border bg-canvas text-ink hover:bg-accent', ELEVATION),
  secondary: cn('border border-border bg-panel text-ink hover:bg-panel-hover', ELEVATION),
  ghost: 'border-none bg-transparent text-ink shadow-none hover:bg-accent active:bg-panel-hover',
  link: 'h-auto border-none bg-transparent p-0 text-primary underline-offset-4 shadow-none hover:underline',
};

// WCAG 2.2 AA target size (2.5.8) is 24×24; 44×44 is the house target (2.5.5 AAA).
// The ::before overlay grows compact icon buttons to ~44px of hit area without
// changing layout. Keep a gap-3 or larger between them so hit areas don't overlap.
const HIT = "before:absolute before:-inset-1.5 before:content-['']";
const HIT_XS = "before:absolute before:-inset-1 before:content-['']";

const SIZES: Record<ButtonSize, string> = {
  default: 'h-10 px-6 py-2',
  sm: 'h-8 px-4 py-1 text-xs',
  lg: 'h-12 px-8 py-3 text-base',
  icon: cn('h-11 w-11 p-0', HIT),
  'icon-sm': cn('h-8 w-8 p-0', HIT),
  'icon-xs': cn('h-6 w-6 p-0', HIT_XS),
};

export function buttonClass({
  variant = 'default',
  size = 'default',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <button ref={ref} className={buttonClass({ variant, size, className })} {...props} />
  )
);
Button.displayName = 'Button';

export { Button };

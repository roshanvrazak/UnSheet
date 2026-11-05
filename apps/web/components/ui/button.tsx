import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'icon';
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer';
    const variantStyles = {
      default: 'bg-brand-700 text-white hover:bg-brand-800',
      outline: 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 bg-rose-600 text-white'
    };
    const sizeStyles = {
      default: 'h-9 px-4 py-2 text-sm',
      sm: 'h-8 px-3 text-xs',
      icon: 'h-9 w-9'
    };

    const combinedClassName = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

    return (
      <button ref={ref} className={combinedClassName} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

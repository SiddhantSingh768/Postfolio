import { cn } from '../../utils/cn';

const variants = {
  primary:   'bg-brand-600 text-white hover:bg-brand-700 shadow-xs active:bg-brand-800',
  secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border)] border border-[var(--border)]',
  ghost:     'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
  danger:    'bg-danger text-white hover:bg-danger-dark shadow-xs',
  outline:   'border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
};

const sizes = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
};

export const Button = ({
  children,
  variant = 'primary',
  size    = 'md',
  loading = false,
  disabled,
  className,
  icon,
  ...props
}) => (
  <button
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center font-medium rounded-md',
      'transition-all duration-150 focus:outline-none focus:ring-2',
      'focus:ring-brand-500/30 disabled:opacity-50 disabled:cursor-not-allowed',
      'select-none whitespace-nowrap',
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  >
    {loading ? (
      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
    ) : icon ? (
      <span className="w-4 h-4 flex-shrink-0">{icon}</span>
    ) : null}
    {children}
  </button>
);
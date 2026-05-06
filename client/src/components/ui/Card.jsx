import { cn } from '../../utils/cn';

export const Card = ({ children, className, padding = true, ...props }) => (
  <div className={cn('card', padding && 'p-5', className)} {...props}>
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, action, className }) => (
  <div className={cn('flex items-start justify-between mb-4', className)}>
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
    </div>
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);
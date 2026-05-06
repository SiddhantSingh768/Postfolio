import { cn } from '../../utils/cn';

export const Stat = ({ label, value, sub, trend, icon, className }) => (
  <div className={cn('card p-5 flex flex-col gap-4', className)}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-[var(--text-muted)] uppercase">
        {label}
      </span>
      {icon && (
        <span className="w-8 h-8 rounded-md bg-brand-50 dark:bg-brand-900/25 flex items-center justify-center text-brand-700 dark:text-brand-400">
          {icon}
        </span>
      )}
    </div>
    <div>
      <div className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
        {value}
      </div>
      {sub && <div className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
    {trend !== undefined && (
      <div className={cn(
        'text-xs font-medium',
        trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-[var(--text-muted)]'
      )}>
        {trend > 0 ? 'Up' : trend < 0 ? 'Down' : 'Flat'} {Math.abs(trend)}% vs last month
      </div>
    )}
  </div>
);

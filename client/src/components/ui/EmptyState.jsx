import { cn } from '../../utils/cn';

export const EmptyState = ({ icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
    {icon && (
      <div className="w-10 h-10 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3 text-[var(--text-muted)]">
        {icon}
      </div>
    )}
    <p className="text-sm font-medium text-[var(--text-primary)] mb-1">{title}</p>
    {description && <p className="text-xs text-[var(--text-muted)] max-w-xs">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);
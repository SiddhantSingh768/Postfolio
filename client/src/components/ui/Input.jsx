import { cn } from '../../utils/cn';

export const Input = ({ label, error, hint, className, icon, ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="label">{label}</label>}
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4">
          {icon}
        </span>
      )}
      <input
        className={cn(
          'input',
          icon && 'pl-9',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className
        )}
        {...props}
      />
    </div>
    {error && <p className="text-xs text-danger">{error}</p>}
    {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
  </div>
);
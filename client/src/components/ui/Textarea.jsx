import { cn } from '../../utils/cn';

export const Textarea = ({ label, error, hint, className, ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="label">{label}</label>}
    <textarea
      className={cn(
        'input resize-none min-h-[80px]',
        error && 'border-danger',
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-danger">{error}</p>}
    {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
  </div>
);
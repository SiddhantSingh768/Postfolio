import { cn } from '../../utils/cn';

export const Select = ({ label, error, className, children, ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="label">{label}</label>}
    <select
      className={cn(
        'input appearance-none cursor-pointer',
        error && 'border-danger',
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs text-danger">{error}</p>}
  </div>
);
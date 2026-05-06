import { AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export const ErrorBox = ({ message, className }) => (
  <div className={cn(
    'flex items-start gap-2 px-3 py-2 rounded-md',
    'bg-danger-light dark:bg-red-900/20 border border-danger/20',
    className
  )}>
    <AlertCircle className="w-3.5 h-3.5 text-danger flex-shrink-0 mt-0.5" />
    <p className="text-xs text-danger leading-relaxed">{message}</p>
  </div>
);
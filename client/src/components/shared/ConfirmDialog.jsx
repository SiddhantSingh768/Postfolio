import { AlertTriangle } from 'lucide-react';
import { Button }        from '../ui/Button';
import { cn }            from '../../utils/cn';

export const ConfirmDialog = ({
  open, onClose, onConfirm,
  title, description,
  confirmLabel = 'Confirm',
  confirmVariant = 'danger',
  loading = false,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-[var(--bg-secondary)] rounded-lg shadow-xl border border-[var(--border)] w-full max-w-sm animate-slide-up">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-danger-light flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-danger" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {title}
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant={confirmVariant}
              size="sm"
              onClick={onConfirm}
              loading={loading}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
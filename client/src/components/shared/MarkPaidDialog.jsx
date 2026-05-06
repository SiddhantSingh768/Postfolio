import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button }  from '../ui/Button';
import { Input }   from '../ui/Input';
import { cn }      from '../../utils/cn';

export const MarkPaidDialog = ({ open, onClose, onConfirm, loading, invoice }) => {
  const [paymentId, setPaymentId] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[var(--bg-secondary)] rounded-lg shadow-xl border border-[var(--border)] w-full max-w-sm animate-slide-up">
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-success-light flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-success" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Mark as paid
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Use this when payment was received outside Razorpay, or the webhook didn't arrive.
              </p>
            </div>
          </div>

          <Input
            label="Razorpay Payment ID (optional)"
            placeholder="pay_XXXXXXXXXX"
            value={paymentId}
            onChange={e => setPaymentId(e.target.value)}
            hint="Find this in your Razorpay dashboard"
          />

          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              loading={loading}
              onClick={() => onConfirm(paymentId || undefined)}
            >
              Mark as paid
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
import { cn } from '../../utils/cn';

const STEPS = [
  { status: 'draft',   label: 'Draft'   },
  { status: 'sent',    label: 'Sent'    },
  { status: 'viewed',  label: 'Viewed'  },
  { status: 'paid',    label: 'Paid'    },
];

const STATUS_ORDER = {
  draft:          0,
  sent:           1,
  viewed:         2,
  paid:           3,
  overdue:        2,
  payment_failed: 2,
  cancelled:      -1,
};

export const InvoiceStatusFlow = ({ status }) => {
  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
        <span className="w-2 h-2 rounded-full bg-neutral-400 flex-shrink-0" />
        <span className="text-xs font-medium text-[var(--text-muted)]">Cancelled</span>
      </div>
    );
  }

  const currentOrder = STATUS_ORDER[status] ?? 0;

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const stepOrder  = STATUS_ORDER[step.status];
        const isComplete = currentOrder > stepOrder;
        const isCurrent  = currentOrder === stepOrder ||
          (status === 'overdue' && step.status === 'viewed') ||
          (status === 'payment_failed' && step.status === 'viewed');
        const isUpcoming = currentOrder < stepOrder;

        return (
          <div key={step.status} className="flex items-center">
            {/* Step */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold',
                'transition-all duration-200',
                isComplete  && 'bg-success text-white',
                isCurrent   && 'bg-brand-600 text-white ring-2 ring-brand-600/30',
                isUpcoming  && 'bg-[var(--border)] text-[var(--text-muted)]',
              )}>
                {isComplete ? '✓' : i + 1}
              </div>
              <span className={cn(
                'text-xs mt-1 font-medium',
                isComplete && 'text-success',
                isCurrent  && 'text-brand-600 dark:text-brand-400',
                isUpcoming && 'text-[var(--text-muted)]',
              )}>
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div className={cn(
                'w-8 h-0.5 mb-4 mx-1 transition-colors duration-200',
                currentOrder > stepOrder ? 'bg-success' : 'bg-[var(--border)]'
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
};
import { cn } from '../../utils/cn';

const configs = {
  draft:          { dot: 'bg-neutral-400',  bg: 'bg-neutral-100 dark:bg-neutral-800',   text: 'text-neutral-600 dark:text-neutral-400',   label: 'Draft'          },
  active:         { dot: 'bg-brand-500',    bg: 'bg-brand-50 dark:bg-brand-900/30',      text: 'text-brand-700 dark:text-brand-400',        label: 'Active'         },
  sent:           { dot: 'bg-blue-500',     bg: 'bg-blue-50 dark:bg-blue-900/30',        text: 'text-blue-700 dark:text-blue-400',          label: 'Sent'           },
  viewed:         { dot: 'bg-violet-500',   bg: 'bg-violet-50 dark:bg-violet-900/30',    text: 'text-violet-700 dark:text-violet-400',      label: 'Viewed'         },
  paid:           { dot: 'bg-success',      bg: 'bg-success-light dark:bg-green-900/30', text: 'text-success-dark dark:text-green-400',     label: 'Paid'           },
  overdue:        { dot: 'bg-danger',       bg: 'bg-danger-light dark:bg-red-900/30',    text: 'text-danger-dark dark:text-red-400',        label: 'Overdue'        },
  payment_failed: { dot: 'bg-danger',       bg: 'bg-danger-light dark:bg-red-900/30',    text: 'text-danger-dark dark:text-red-400',        label: 'Failed'         },
  cancelled:      { dot: 'bg-neutral-400',  bg: 'bg-neutral-100 dark:bg-neutral-800',   text: 'text-neutral-500 dark:text-neutral-400',   label: 'Cancelled'      },
  on_hold:        { dot: 'bg-warning',      bg: 'bg-warning-light dark:bg-amber-900/30', text: 'text-warning-dark dark:text-amber-400',     label: 'On Hold'        },
  completed:      { dot: 'bg-success',      bg: 'bg-success-light dark:bg-green-900/30', text: 'text-success-dark dark:text-green-400',     label: 'Completed'      },
  pending:        { dot: 'bg-neutral-400',  bg: 'bg-neutral-100 dark:bg-neutral-800',   text: 'text-neutral-500 dark:text-neutral-400',   label: 'Pending'        },
  in_progress:    { dot: 'bg-brand-500',    bg: 'bg-brand-50 dark:bg-brand-900/30',      text: 'text-brand-700 dark:text-brand-400',        label: 'In Progress'    },
};

export const Badge = ({ status, className }) => {
  const config = configs[status] || configs.draft;
  return (
    <span className={cn('badge', config.bg, config.text, className)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
      {config.label}
    </span>
  );
};
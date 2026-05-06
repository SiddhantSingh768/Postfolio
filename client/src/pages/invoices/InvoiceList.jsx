import { useState }    from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, FileText, Calendar, DollarSign,
  User, ExternalLink, Eye, Send,
  XCircle, CheckCircle2
} from 'lucide-react';
import { PageWrapper }    from '../../components/layout/PageWrapper';
import { Button }         from '../../components/ui/Button';
import { Badge }          from '../../components/ui/Badge';
import { EmptyState }     from '../../components/ui/EmptyState';
import { PageSpinner }    from '../../components/ui/Spinner';
import { useInvoiceList } from '../../hooks/useInvoices';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { cn }             from '../../utils/cn';

const STATUS_TABS = [
  { value: undefined,        label: 'All'     },
  { value: 'draft',          label: 'Draft'   },
  { value: 'sent,viewed',    label: 'Pending' },
  { value: 'paid',           label: 'Paid'    },
  { value: 'overdue',        label: 'Overdue' },
  { value: 'cancelled',      label: 'Cancelled'},
];

export const InvoiceList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get('status') || undefined;

  const { data, isLoading } = useInvoiceList({ status: activeStatus });
  const invoices   = data?.invoices   || [];
  const pagination = data?.pagination;

  const setStatus = (s) => {
    const p = new URLSearchParams(searchParams);
    s ? p.set('status', s) : p.delete('status');
    setSearchParams(p);
  };

  return (
    <PageWrapper
      title="Invoices"
      subtitle={pagination ? `${pagination.total} invoice${pagination.total !== 1 ? 's' : ''}` : ''}
      actions={
        <Button
          size="sm"
          onClick={() => navigate('/invoices/new')}
          icon={<Plus className="w-4 h-4" />}
        >
          New invoice
        </Button>
      }
    >
      <div className="space-y-4 animate-fade-in">

        {/* Status tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button
              key={String(tab.value)}
              onClick={() => setStatus(tab.value)}
              className={cn(
                'h-8 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                activeStatus === tab.value
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? <PageSpinner /> : invoices.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-5 h-5" />}
            title="No invoices found"
            description={activeStatus ? 'Try a different filter' : 'Create your first invoice'}
            action={
              !activeStatus && (
                <Button
                  size="sm"
                  onClick={() => navigate('/invoices/new')}
                  icon={<Plus className="w-4 h-4" />}
                >
                  New invoice
                </Button>
              )
            }
          />
        ) : (
          <div className="card overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
              {[
                { label: 'Invoice',  span: 'col-span-3' },
                { label: 'Client',   span: 'col-span-3 hidden md:block' },
                { label: 'Amount',   span: 'col-span-2' },
                { label: 'Due date', span: 'col-span-2 hidden lg:block' },
                { label: 'Status',   span: 'col-span-1' },
                { label: '',         span: 'col-span-1' },
              ].map(h => (
                <span key={h.label} className={cn(
                  'text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider',
                  h.span
                )}>
                  {h.label}
                </span>
              ))}
            </div>

            {invoices.map(invoice => (
              <div
                key={invoice._id}
                onClick={() => navigate(`/invoices/${invoice._id}`)}
                className="grid grid-cols-12 gap-4 px-4 py-3.5 border-b border-[var(--border)] last:border-0 table-row-hover cursor-pointer"
              >
                {/* Invoice number */}
                <div className="col-span-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] font-mono">
                      {invoice.invoiceNumber}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatDate(invoice.issueDate)}
                    </p>
                  </div>
                </div>

                {/* Client */}
                <div className="col-span-3 hidden md:flex items-center gap-1.5 min-w-0">
                  <User className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                  <span className="text-sm text-[var(--text-secondary)] truncate">
                    {invoice.client?.name || '—'}
                  </span>
                </div>

                {/* Amount */}
                <div className="col-span-2 flex items-center">
                  <span className="text-sm font-semibold text-[var(--text-primary)] font-mono">
                    {formatCurrency(invoice.grandTotal)}
                  </span>
                </div>

                {/* Due date */}
                <div className="col-span-2 hidden lg:flex items-center">
                  <span className={cn(
                    'text-sm',
                    invoice.status === 'overdue'
                      ? 'text-danger font-medium'
                      : 'text-[var(--text-secondary)]'
                  )}>
                    {formatDate(invoice.dueDate)}
                  </span>
                </div>

                {/* Status */}
                <div className="col-span-1 flex items-center">
                  <Badge status={invoice.status} />
                </div>

                {/* Arrow */}
                <div className="col-span-1 flex items-center justify-end">
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
};
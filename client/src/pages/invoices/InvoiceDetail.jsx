import { useState }              from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, FileText, Download,
  XCircle, CheckCircle2, ExternalLink,
  Copy, RefreshCw, User, Calendar,
  FolderOpen, AlertCircle, Eye
} from 'lucide-react';
import { PageWrapper }         from '../../components/layout/PageWrapper';
import { Card, CardHeader }    from '../../components/ui/Card';
import { Button }              from '../../components/ui/Button';
import { Badge }               from '../../components/ui/Badge';
import { EmptyState }          from '../../components/ui/EmptyState';
import { PageSpinner }         from '../../components/ui/Spinner';
import { ConfirmDialog }       from '../../components/shared/ConfirmDialog';
import { MarkPaidDialog }      from '../../components/shared/MarkPaidDialog';
import { InvoiceStatusFlow }   from '../../components/shared/InvoiceStatusFlow';
import { InvoiceSummary }      from '../../components/shared/InvoiceSummary';
import {
  useInvoice, useSendInvoice, useGeneratePDF,
  useCancelInvoice, useMarkPaid
}                              from '../../hooks/useInvoices';
import { invoicesApi }         from '../../api/endpoints/invoices.api';
import { useToast }            from '../../components/ui/Toast';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { formatINR }           from '../../utils/gst';
import { cn }                  from '../../utils/cn';

export const InvoiceDetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const toast    = useToast();

  const [cancelOpen, setCancelOpen]   = useState(false);
  const [paidOpen, setPaidOpen]       = useState(false);
  const [pdfLoading, setPdfLoading]   = useState(false);
  const [pdfUrl, setPdfUrl]           = useState(null);

  const { data: invoice, isLoading, error } = useInvoice(id);
  const sendMutation      = useSendInvoice();
  const generateMutation  = useGeneratePDF();
  const cancelMutation    = useCancelInvoice();
  const markPaidMutation  = useMarkPaid();

  const handleSend = async () => {
    try {
      await sendMutation.mutateAsync(id);
      toast.success('Invoice sent — Razorpay payment link created');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invoice');
    }
  };

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      if (invoice.status === 'draft') {
        await generateMutation.mutateAsync(id);
      }
      const url = invoicesApi.viewPDF(id);
      window.open(url, '_blank');
    } catch (err) {
      toast.error('Failed to generate PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Invoice cancelled');
      setCancelOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot cancel this invoice');
    }
  };

  const handleMarkPaid = async (razorpayPaymentId) => {
    try {
      await markPaidMutation.mutateAsync({ id, razorpayPaymentId });
      toast.success('Invoice marked as paid');
      setPaidOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark as paid');
    }
  };

  const copyPaymentLink = async () => {
    if (!invoice?.razorpayLinkUrl) return;
    await navigator.clipboard.writeText(invoice.razorpayLinkUrl);
    toast.success('Payment link copied');
  };

  if (isLoading) return <PageWrapper title="Invoice"><PageSpinner /></PageWrapper>;
  if (error || !invoice) return (
    <PageWrapper title="Invoice">
      <EmptyState
        title="Invoice not found"
        action={<Button size="sm" onClick={() => navigate('/invoices')}>Back</Button>}
      />
    </PageWrapper>
  );

  const isDraft     = invoice.status === 'draft';
  const isSent      = ['sent', 'viewed', 'overdue', 'payment_failed'].includes(invoice.status);
  const isPaid      = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';

  return (
    <PageWrapper
      title={invoice.invoiceNumber}
      subtitle={`${invoice.client?.name} · ${formatCurrency(invoice.grandTotal)}`}
      actions={
        <div className="flex items-center gap-2">
          {/* Draft actions */}
          {isDraft && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePDF}
                loading={pdfLoading || generateMutation.isPending}
                icon={<FileText className="w-4 h-4" />}
              >
                Preview PDF
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                loading={sendMutation.isPending}
                icon={<Send className="w-4 h-4" />}
              >
                Send invoice
              </Button>
            </>
          )}

          {/* Sent actions */}
          {isSent && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePDF}
                loading={pdfLoading}
                icon={<Download className="w-4 h-4" />}
              >
                View PDF
              </Button>
              {invoice.razorpayLinkUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyPaymentLink}
                  icon={<Copy className="w-4 h-4" />}
                >
                  Copy pay link
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => setPaidOpen(true)}
                icon={<CheckCircle2 className="w-4 h-4" />}
              >
                Mark paid
              </Button>
            </>
          )}

          {/* Paid actions */}
          {isPaid && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePDF}
              loading={pdfLoading}
              icon={<Download className="w-4 h-4" />}
            >
              Download PDF
            </Button>
          )}

          {/* Cancel — available for non-paid, non-cancelled */}
          {!isPaid && !isCancelled && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCancelOpen(true)}
              className="text-danger hover:bg-danger-light"
              icon={<XCircle className="w-4 h-4" />}
            >
              Cancel
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 animate-fade-in">
        {/* Back */}
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to invoices
        </button>

        {/* Status flow */}
        <Card>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <InvoiceStatusFlow status={invoice.status} />
            <Badge status={invoice.status} />
          </div>

          {/* Payment received banner */}
          {isPaid && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-success-light dark:bg-green-900/20 border border-success/30 rounded-md">
              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-success-dark dark:text-green-400">
                  Payment received — {formatCurrency(invoice.paidAmount)}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {formatDate(invoice.paidAt)}
                  {invoice.manualPaymentNote && ` · Ref: ${invoice.manualPaymentNote}`}
                </p>
              </div>
            </div>
          )}

          {/* Razorpay link */}
          {invoice.razorpayLinkUrl && isSent && (
            <div className="mt-4 flex items-center gap-3 px-3 py-2 bg-[var(--bg-tertiary)] rounded-md">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)] mb-0.5">
                  Payment link active
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {invoice.razorpayLinkUrl}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={copyPaymentLink}
                  icon={<Copy className="w-3 h-3" />}
                >
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => window.open(invoice.razorpayLinkUrl, '_blank')}
                  icon={<ExternalLink className="w-3 h-3" />}
                >
                  Open
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: invoice meta */}
          <div className="space-y-4">
            <Card>
              <CardHeader title="Invoice details" />
              <div className="space-y-3">
                <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Client">
                  <button
                    onClick={() => navigate(`/clients/${invoice.client?._id}`)}
                    className="text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {invoice.client?.name}
                  </button>
                </InfoRow>

                {invoice.project && (
                  <InfoRow icon={<FolderOpen className="w-3.5 h-3.5" />} label="Project">
                    <button
                      onClick={() => navigate(`/projects/${invoice.project?._id || invoice.project}`)}
                      className="text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      {invoice.project?.title || 'View project'}
                    </button>
                  </InfoRow>
                )}

                <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Issue date">
                  {formatDate(invoice.issueDate)}
                </InfoRow>

                <InfoRow
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Due date"
                  valueClass={invoice.status === 'overdue' ? 'text-danger' : ''}
                >
                  {formatDate(invoice.dueDate)}
                </InfoRow>

                {invoice.viewedAt && (
                  <InfoRow icon={<Eye className="w-3.5 h-3.5" />} label="Viewed">
                    {formatDate(invoice.viewedAt)}
                  </InfoRow>
                )}
              </div>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader title="Summary" />
              <InvoiceSummary
                subtotal={invoice.subtotal}
                totalGst={invoice.totalGst}
                grandTotal={invoice.grandTotal}
                lineItems={invoice.lineItems}
              />
            </Card>

            {/* Notes */}
            {invoice.notes && (
              <Card>
                <CardHeader title="Notes" />
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {invoice.notes}
                </p>
              </Card>
            )}
          </div>

          {/* Right: line items */}
          <div className="lg:col-span-2">
            <Card padding={false}>
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Line items</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {invoice.lineItems?.length} item{invoice.lineItems?.length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-[var(--bg-tertiary)] border-b border-[var(--border)]">
                {[
                  { label: 'Description', span: 'col-span-5' },
                  { label: 'Qty',         span: 'col-span-1 text-center' },
                  { label: 'Unit price',  span: 'col-span-2 text-right' },
                  { label: 'GST',         span: 'col-span-1 text-center' },
                  { label: 'Amount',      span: 'col-span-3 text-right' },
                ].map(h => (
                  <span key={h.label} className={cn(
                    'text-xs font-medium text-[var(--text-muted)]',
                    h.span
                  )}>
                    {h.label}
                  </span>
                ))}
              </div>

              {/* Line item rows */}
              {invoice.lineItems?.map((item, i) => {
                const lineTotal = item.amount * (1 + item.gstRate / 100);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 px-5 py-3 border-b border-[var(--border)] last:border-0"
                  >
                    <div className="col-span-5">
                      <p className="text-sm text-[var(--text-primary)]">{item.description}</p>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-sm text-[var(--text-secondary)]">{item.qty}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-sm font-mono text-[var(--text-secondary)]">
                        {formatINR(item.unitPrice)}
                      </span>
                    </div>
                    <div className="col-span-1 text-center">
                      <span className="text-xs text-[var(--text-muted)]">{item.gstRate}%</span>
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="text-sm font-semibold font-mono text-[var(--text-primary)]">
                        {formatINR(lineTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* GSTIN info */}
              {invoice.client?.gstin && (
                <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-tertiary)]">
                  <p className="text-xs text-[var(--text-muted)]">
                    Client GSTIN: <span className="font-mono text-[var(--text-secondary)]">{invoice.client.gstin}</span>
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Cancel confirm */}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        loading={cancelMutation.isPending}
        title="Cancel invoice?"
        description="This invoice will be cancelled. Create a new invoice to replace it. Cancelled invoices preserve the audit trail."
        confirmLabel="Cancel invoice"
      />

      {/* Mark paid dialog */}
      <MarkPaidDialog
        open={paidOpen}
        onClose={() => setPaidOpen(false)}
        onConfirm={handleMarkPaid}
        loading={markPaidMutation.isPending}
        invoice={invoice}
      />
    </PageWrapper>
  );
};

const InfoRow = ({ icon, label, children, valueClass }) => (
  <div className="flex items-start gap-2.5">
    <span className="text-[var(--text-muted)] mt-0.5 flex-shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
      <div className={cn('text-sm text-[var(--text-primary)]', valueClass)}>
        {children}
      </div>
    </div>
  </div>
);
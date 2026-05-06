import { useEffect, useState }        from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Zap, FolderOpen, Calendar, DollarSign,
  FileText, ExternalLink, CreditCard,
  CheckCircle2, Clock, Lock, AlertCircle,
  Sun, Moon
} from 'lucide-react';
import { setPortalToken }        from '../../api/portalClient';
import { usePortalProject, useViewInvoice } from '../../hooks/usePortal';
import { PortalMilestoneTimeline } from './PortalMilestoneTimeline';
import { useTheme }              from '../../context/ThemeContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { formatINR }             from '../../utils/gst';
import { cn }                    from '../../utils/cn';

export const PortalView = () => {
  const { projectId }  = useParams();
  const [params]       = useSearchParams();
  const token          = params.get('token');
  const { toggle, isDark } = useTheme();

  // Set the token in the portal axios client before any requests fire
  useEffect(() => {
    if (token) setPortalToken(token);
  }, [token]);

  const { data, isLoading, error } = usePortalProject(projectId);

  // Token missing — don't even try to load
  if (!token) return <PortalError type="no_token" />;

  if (isLoading) return <PortalLoading />;

  if (error) {
    const status = error.response?.status;
    const code   = error.response?.data?.code;
    return (
      <PortalError
        type={
          status === 403 ? 'forbidden' :
          status === 404 ? 'not_found'  :
          'error'
        }
        code={code}
      />
    );
  }

  const { project, milestones, invoices } = data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      {/* Portal header — minimal, no sidebar */}
      <header className="bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Branding */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Postfolio
            </span>
            <span className="hidden sm:block text-xs text-gray-400 ml-2 border-l border-gray-200 dark:border-neutral-700 pl-2">
              Client portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Project title in header on mobile */}
            <span className="sm:hidden text-xs font-medium text-gray-600 dark:text-gray-400 truncate max-w-[120px]">
              {project.title}
            </span>
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Project hero */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <FolderOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {project.title}
                </h1>
                <ProjectStatusBadge status={project.status} />
              </div>

              {project.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {project.description}
                </p>
              )}

              {/* Meta row */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {project.startDate && (
                  <MetaItem icon={<Calendar className="w-3.5 h-3.5" />}>
                    Started {formatDate(project.startDate)}
                  </MetaItem>
                )}
                {project.endDate && (
                  <MetaItem icon={<Calendar className="w-3.5 h-3.5" />}>
                    Due {formatDate(project.endDate)}
                  </MetaItem>
                )}
                {project.budget && (
                  <MetaItem icon={<DollarSign className="w-3.5 h-3.5" />}>
                    Budget {formatCurrency(project.budget)}
                  </MetaItem>
                )}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {milestones.length > 0 && (
            <ProgressSection milestones={milestones} />
          )}
        </div>

        {/* Milestones */}
        <section>
          <SectionHeader
            icon={<CheckCircle2 className="w-4 h-4" />}
            title="Milestones"
            subtitle={`${milestones.length} milestone${milestones.length !== 1 ? 's' : ''}`}
          />
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5">
            <PortalMilestoneTimeline
              milestones={milestones}
              projectId={projectId}
            />
          </div>
        </section>

        {/* Invoices */}
        {invoices.length > 0 && (
          <section>
            <SectionHeader
              icon={<FileText className="w-4 h-4" />}
              title="Invoices"
              subtitle={`${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
            />
            <div className="space-y-3">
              {invoices.map(invoice => (
                <PortalInvoiceCard
                  key={invoice._id}
                  invoice={invoice}
                  projectId={projectId}
                />
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-6">
          <p className="text-xs text-gray-400">
            Powered by{' '}
            <span className="font-semibold text-gray-500">Postfolio</span>
            {' '}· Client portal
          </p>
        </footer>
      </main>
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ProgressSection = ({ milestones }) => {
  const completed  = milestones.filter(m => m.status === 'completed').length;
  const percent    = Math.round((completed / milestones.length) * 100);

  return (
    <div className="mt-5 pt-5 border-t border-gray-100 dark:border-neutral-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Project progress
        </span>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {completed}/{milestones.length} milestones done
        </span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            percent === 100 ? 'bg-green-500' : 'bg-blue-600'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-right text-xs text-gray-400 mt-1">{percent}%</p>
    </div>
  );
};

const PortalInvoiceCard = ({ invoice, projectId }) => {
  const [loading, setLoading]   = useState(false);
  const [opened, setOpened]     = useState(invoice.status === 'viewed' || invoice.status === 'paid');
  const viewMutation = useViewInvoice(projectId);

  const handleView = async () => {
    setLoading(true);
    try {
      const result = await viewMutation.mutateAsync(invoice._id);
      setOpened(true);
      // Open PDF if URL is returned
      if (result?.pdfUrl) {
        window.open(result.pdfUrl, '_blank');
      }
    } catch {
      // Best effort
    } finally {
      setLoading(false);
    }
  };

  const isPaid = invoice.status === 'paid';
  const isOverdue = invoice.status === 'overdue';

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            isPaid
              ? 'bg-green-50 dark:bg-green-900/30'
              : isOverdue
              ? 'bg-red-50 dark:bg-red-900/30'
              : 'bg-blue-50 dark:bg-blue-900/30'
          )}>
            <FileText className={cn(
              'w-5 h-5',
              isPaid      ? 'text-green-600 dark:text-green-400' :
              isOverdue   ? 'text-red-600 dark:text-red-400'     :
                            'text-blue-600 dark:text-blue-400'
            )} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                {invoice.invoiceNumber}
              </p>
              <PortalInvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Due {formatDate(invoice.dueDate)}
              {invoice.paidAt && ` · Paid ${formatDate(invoice.paidAt)}`}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100 font-mono">
            {formatCurrency(invoice.grandTotal)}
          </p>
          {invoice.paidAmount && invoice.paidAmount !== invoice.grandTotal && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Paid: {formatCurrency(invoice.paidAmount)}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
        {/* View PDF */}
        <button
          onClick={handleView}
          disabled={loading}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <FileText className="w-3.5 h-3.5" />
          )}
          {opened ? 'View again' : 'View invoice'}
        </button>

        {/* Pay Now button */}
        {invoice.razorpayLinkUrl && !isPaid && (
          <a
            href={invoice.razorpayLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors ml-auto"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Pay now — {formatCurrency(invoice.grandTotal)}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Paid indicator */}
        {isPaid && (
          <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Payment received
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectStatusBadge = ({ status }) => {
  const configs = {
    draft:     { bg: 'bg-gray-100 dark:bg-gray-800',    text: 'text-gray-500',                        label: 'Draft'     },
    active:    { bg: 'bg-blue-50 dark:bg-blue-900/30',  text: 'text-blue-700 dark:text-blue-400',     label: 'Active'    },
    on_hold:   { bg: 'bg-amber-50 dark:bg-amber-900/30',text: 'text-amber-700 dark:text-amber-400',   label: 'On hold'   },
    completed: { bg: 'bg-green-50 dark:bg-green-900/30',text: 'text-green-700 dark:text-green-400',   label: 'Completed' },
    cancelled: { bg: 'bg-gray-100 dark:bg-gray-800',    text: 'text-gray-500',                        label: 'Cancelled' },
  };
  const c = configs[status] || configs.draft;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', c.bg, c.text)}>
      {c.label}
    </span>
  );
};

const PortalInvoiceStatusBadge = ({ status }) => {
  const configs = {
    sent:           { bg: 'bg-blue-50 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',     label: 'Awaiting payment'  },
    viewed:         { bg: 'bg-violet-50 dark:bg-violet-900/30',text: 'text-violet-700 dark:text-violet-400', label: 'Viewed'            },
    paid:           { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400',   label: 'Paid'              },
    overdue:        { bg: 'bg-red-50 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',       label: 'Overdue'           },
    payment_failed: { bg: 'bg-red-50 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',       label: 'Payment failed'    },
  };
  const c = configs[status] || configs.sent;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', c.bg, c.text)}>
      {c.label}
    </span>
  );
};

const SectionHeader = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="text-gray-400">{icon}</span>
    <div>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  </div>
);

const MetaItem = ({ icon, children }) => (
  <div className="flex items-center gap-1 text-xs text-gray-400">
    {icon}
    <span>{children}</span>
  </div>
);

// ── Error and loading states ──────────────────────────────────────────────────

const PortalLoading = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center">
    <div className="text-center">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-gray-400">Loading portal...</p>
    </div>
  </div>
);

const PortalError = ({ type, code }) => {
  const configs = {
    no_token: {
      icon:  <Lock className="w-8 h-8 text-gray-400" />,
      title: 'No access token',
      desc:  'This link is incomplete. Ask for a new portal link.',
    },
    forbidden: {
      icon:  <Lock className="w-8 h-8 text-red-400" />,
      title: 'Access denied',
      desc:  code === 'PORTAL_TOKEN_EXPIRED'
        ? 'This portal link has expired. Ask your freelancer to generate a new one.'
        : 'This portal link has been revoked or is invalid.',
    },
    not_found: {
      icon:  <AlertCircle className="w-8 h-8 text-gray-400" />,
      title: 'Project not found',
      desc:  'This project doesn\'t exist or the portal is not enabled.',
    },
    error: {
      icon:  <AlertCircle className="w-8 h-8 text-gray-400" />,
      title: 'Something went wrong',
      desc:  'Unable to load the portal. Try again or contact your freelancer.',
    },
  };

  const c = configs[type] || configs.error;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center p-4">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-4">
          {c.icon}
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {c.title}
        </h1>
        <p className="text-sm text-gray-400 leading-relaxed">{c.desc}</p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs text-gray-400 font-medium">Postfolio</span>
        </div>
      </div>
    </div>
  );
};
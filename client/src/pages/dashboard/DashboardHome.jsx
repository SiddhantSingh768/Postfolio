import { useState }      from 'react';
import { useNavigate }   from 'react-router-dom';
import {
  TrendingUp, Clock, FolderOpen, FileText,
  Plus, ArrowRight, Sparkles, CheckCircle2,
  X, Users, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { PageWrapper }            from '../../components/layout/PageWrapper';
import { Card, CardHeader }       from '../../components/ui/Card';
import { Button }                 from '../../components/ui/Button';
import { Badge }                  from '../../components/ui/Badge';
import { EmptyState }             from '../../components/ui/EmptyState';
import {
  StatSkeleton, ChartSkeleton,
  CardSkeleton, TableRowSkeleton
}                                 from '../../components/ui/Skeleton';
import {
  useDashboardStats, useRevenueTrend, useOnboardingStatus
}                                 from '../../hooks/useDashboard';
import { useInvoicePaidEvent }    from '../../hooks/useInvoicePaidEvent';
import axiosClient                from '../../api/axiosClient';
import { useToast }               from '../../components/ui/Toast';
import { useAuth }                from '../../context/AuthContext';
import { formatCurrency }         from '../../utils/formatters';
import { cn }                     from '../../utils/cn';

const fmt = (n) => formatCurrency(n || 0);

const STATUS_COLORS = {
  draft:          '#a8a29e',
  sent:           '#2563eb',
  viewed:         '#7c3aed',
  paid:           '#059669',
  overdue:        '#dc2626',
  payment_failed: '#dc2626',
  cancelled:      '#d6d3d1',
};

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg border border-[var(--border)]">
      <p className="text-[var(--text-muted)] mb-0.5">{label}</p>
      <p className="font-semibold text-[var(--text-primary)]">
        {fmt(payload[0]?.value)}
      </p>
    </div>
  );
};

const CustomBarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-lg border border-[var(--border)]">
      <p className="font-semibold text-[var(--text-primary)] capitalize">
        {payload[0]?.payload?.status}
      </p>
      <p className="text-[var(--text-muted)]">
        {payload[0]?.value} invoice{payload[0]?.value !== 1 ? 's' : ''}
      </p>
    </div>
  );
};

export const DashboardHome = () => {
  const navigate = useNavigate();
  const toast    = useToast();
  const { user } = useAuth();

  useInvoicePaidEvent();

  const { data: dash,     isLoading: dashLoading }     = useDashboardStats();
  const { data: revenue,  isLoading: revenueLoading }  = useRevenueTrend(12);
  const { data: onboarding, refetch: refetchOnboarding } = useOnboardingStatus();

  const [seedingDemo, setSeedingDemo]   = useState(false);
  const [dismissing, setDismissing]     = useState(false);

  const handleSeedDemo = async () => {
    setSeedingDemo(true);
    try {
      await axiosClient.post('/onboarding/seed');
      toast.success('Demo workspace loaded');
      refetchOnboarding();
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'DEMO_ALREADY_SEEDED') {
        toast.info('Demo data already loaded');
      } else {
        toast.error('Failed to load demo data');
      }
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleDismissOnboarding = async () => {
    setDismissing(true);
    try {
      await axiosClient.post('/onboarding/dismiss');
      refetchOnboarding();
    } catch {
      toast.error('Failed to dismiss');
    } finally {
      setDismissing(false);
    }
  };

  const invoiceBreakdownData = (dash?.invoiceBreakdown || []).map(item => ({
    status: item.status,
    count:  item.count,
    color:  STATUS_COLORS[item.status] || '#a8a29e',
  }));

  const hasAnyRevenue = (dash?.revenue?.allTime?.total || 0) > 0;
  const hasProjects   = (dash?.projects?.active || 0) > 0 ||
                        (dash?.projects?.completed || 0) > 0;

  return (
    <PageWrapper
      title={`Good ${getGreeting()}, ${user?.name?.split(' ')[0] || 'there'}`}
      subtitle={new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      })}
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
      <div className="space-y-6 animate-fade-in">

        {/* Onboarding checklist */}
        {onboarding && !onboarding.isDismissed && (
          <OnboardingChecklist
            data={onboarding}
            onSeedDemo={handleSeedDemo}
            seedingDemo={seedingDemo}
            onDismiss={handleDismissOnboarding}
            dismissing={dismissing}
          />
        )}

        {/* Stats row */}
        {dashLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <StatSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total revenue"
              value={fmt(dash?.revenue?.allTime?.total)}
              sub={`${dash?.revenue?.allTime?.count || 0} paid invoices`}
              icon={<TrendingUp className="w-4 h-4" />}
              trend={getTrend(
                dash?.revenue?.thisMonth?.total,
                dash?.revenue?.lastMonth?.total
              )}
            />
            <StatCard
              label="This month"
              value={fmt(dash?.revenue?.thisMonth?.total)}
              sub={`Last month: ${fmt(dash?.revenue?.lastMonth?.total)}`}
              icon={<Sparkles className="w-4 h-4" />}
            />
            <StatCard
              label="Outstanding"
              value={fmt(dash?.revenue?.outstanding?.total)}
              sub={`${dash?.revenue?.outstanding?.count || 0} unpaid`}
              icon={<Clock className="w-4 h-4" />}
              urgent={(dash?.revenue?.outstanding?.total || 0) > 0}
            />
            <StatCard
              label="Active projects"
              value={dash?.projects?.active || 0}
              sub={`${dash?.projects?.completed || 0} completed`}
              icon={<FolderOpen className="w-4 h-4" />}
            />
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Revenue trend */}
          {revenueLoading ? (
            <div className="lg:col-span-2"><ChartSkeleton /></div>
          ) : (
            <Card className="lg:col-span-2" padding={false}>
              <div className="p-5 pb-2">
                <CardHeader
                  title="Revenue trend"
                  subtitle="Last 12 months — paid invoices only"
                  action={
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      {fmt(revenue?.reduce((s, m) => s + (m.revenue || 0), 0))}
                    </span>
                  }
                />
              </div>
              {!hasAnyRevenue || !revenue?.some(m => m.revenue > 0) ? (
                <div className="h-48 flex items-center justify-center">
                  <EmptyState
                    icon={<TrendingUp className="w-5 h-5" />}
                    title="No revenue data yet"
                    description="Send and get paid on your first invoice"
                  />
                </div>
              ) : (
                <div className="h-48 px-2 pb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={revenue || []}
                      margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                    >
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"   stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="95%"  stopColor="#2563eb" stopOpacity={0}    />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v =>
                          v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` :
                          v >= 1000   ? `₹${(v / 1000).toFixed(0)}k`  :
                          `₹${v}`
                        }
                      />
                      <Tooltip content={<CustomAreaTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#2563eb"
                        strokeWidth={2}
                        fill="url(#revGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#2563eb' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          )}

          {/* Invoice breakdown */}
          {dashLoading ? (
            <CardSkeleton />
          ) : (
            <Card>
              <CardHeader
                title="Invoices"
                subtitle="By status"
                action={
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => navigate('/invoices')}
                  >
                    View all
                  </Button>
                }
              />
              {invoiceBreakdownData.length === 0 ? (
                <EmptyState
                  icon={<FileText className="w-5 h-5" />}
                  title="No invoices yet"
                  action={
                    <Button
                      size="xs"
                      onClick={() => navigate('/invoices/new')}
                    >
                      Create one
                    </Button>
                  }
                />
              ) : (
                <div>
                  {/* Mini bar chart */}
                  <div className="h-28 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={invoiceBreakdownData}
                        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                        barSize={20}
                      >
                        <XAxis
                          dataKey="status"
                          tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis hide />
                        <Tooltip content={<CustomBarTooltip />} />
                        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                          {invoiceBreakdownData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legend */}
                  <div className="space-y-1.5">
                    {invoiceBreakdownData.slice(0, 5).map(item => (
                      <div
                        key={item.status}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: item.color }}
                          />
                          <Badge status={item.status} />
                        </div>
                        <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Top clients */}
        {dashLoading ? (
          <div className="card overflow-hidden">
            <TableRowSkeleton rows={3} />
          </div>
        ) : dash?.topClients?.length > 0 ? (
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Top clients
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  By revenue received
                </p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => navigate('/clients')}
                icon={<ArrowRight className="w-3 h-3" />}
              >
                View all
              </Button>
            </div>
            <div>
              {dash.topClients.map((c, i) => (
                <div
                  key={c.clientId}
                  onClick={() => navigate(`/clients/${c.clientId}`)}
                  className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)] last:border-0 table-row-hover cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-[var(--text-muted)] w-4 text-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-brand-700 dark:text-brand-400">
                        {c.clientName?.[0]?.toUpperCase() || 'C'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {c.clientName || 'Unknown client'}
                      </p>
                      {c.company && (
                        <p className="text-xs text-[var(--text-muted)]">{c.company}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--text-primary)] font-mono">
                      {fmt(c.revenue)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {c.invoices} invoice{c.invoices !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : !dashLoading && !hasAnyRevenue && !hasProjects ? (
          <Card>
            <EmptyState
              icon={<Users className="w-5 h-5" />}
              title="Your dashboard is empty"
              description="Start by adding clients and projects to see your analytics here"
              action={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate('/clients')}
                    icon={<Users className="w-4 h-4" />}
                  >
                    Add client
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSeedDemo}
                    loading={seedingDemo}
                    icon={<Sparkles className="w-4 h-4" />}
                  >
                    Load demo
                  </Button>
                </div>
              }
            />
          </Card>
        ) : null}

      </div>
    </PageWrapper>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, icon, trend, urgent }) => (
  <div className={cn(
    'card p-5 flex flex-col gap-3',
    urgent && 'border-warning/40 bg-warning-light/30 dark:bg-amber-900/10'
  )}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
        {label}
      </span>
      <span className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        urgent
          ? 'bg-warning-light text-warning'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
      )}>
        {icon}
      </span>
    </div>
    <div>
      <p className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>
      )}
    </div>
    {trend !== null && trend !== undefined && (
      <p className={cn(
        'text-xs font-medium',
        trend > 0  ? 'text-success'            :
        trend < 0  ? 'text-danger'             :
                     'text-[var(--text-muted)]'
      )}>
        {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}{' '}
        {Math.abs(trend)}% vs last month
      </p>
    )}
  </div>
);

const OnboardingChecklist = ({
  data, onSeedDemo, seedingDemo, onDismiss, dismissing
}) => {
  const navigate = useNavigate();

  const stepActions = {
    add_client:     () => navigate('/clients'),
    create_project: () => navigate('/projects'),
    send_invoice:   () => navigate('/invoices/new'),
  };

  return (
    <div className="card border-brand-200 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-900/10 p-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-0.5">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Get started with Postfolio
            </p>
            <button
              onClick={onDismiss}
              disabled={dismissing}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Complete these steps to set up your workspace
          </p>

          {/* Steps */}
          <div className="space-y-2 mb-4">
            {(data.steps || []).map(step => (
              <button
                key={step.id}
                onClick={() => !step.completed && stepActions[step.id]?.()}
                disabled={step.completed}
                className={cn(
                  'flex items-center gap-3 w-full text-left group transition-colors',
                  !step.completed && 'hover:opacity-80'
                )}
              >
                <span className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  step.completed
                    ? 'border-success bg-success'
                    : 'border-[var(--border-strong)] group-hover:border-brand-500'
                )}>
                  {step.completed && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                </span>
                <span className={cn(
                  'text-xs',
                  step.completed
                    ? 'line-through text-[var(--text-muted)]'
                    : 'text-[var(--text-primary)] font-medium'
                )}>
                  {step.label}
                </span>
                {!step.completed && (
                  <ArrowRight className="w-3 h-3 text-[var(--text-muted)] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </button>
            ))}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-600 rounded-full transition-all duration-500"
                style={{
                  width: `${((data.completedCount || 0) / (data.totalSteps || 3)) * 100}%`
                }}
              />
            </div>
            <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
              {data.completedCount || 0}/{data.totalSteps || 3}
            </span>
          </div>

          {/* Demo button */}
          <Button
            variant="secondary"
            size="xs"
            onClick={onSeedDemo}
            loading={seedingDemo}
            icon={<Sparkles className="w-3.5 h-3.5" />}
          >
            Load demo data
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

const getTrend = (thisMonth, lastMonth) => {
  if (!thisMonth || !lastMonth || lastMonth === 0) return null;
  return Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
};
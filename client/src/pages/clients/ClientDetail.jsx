import { useState }              from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Archive, Mail, Phone,
  Building2, Hash, Globe, FileText,
  FolderOpen, Link2, Link2Off, Copy, RefreshCw
} from 'lucide-react';
import { PageWrapper }     from '../../components/layout/PageWrapper';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button }          from '../../components/ui/Button';
import { Badge }           from '../../components/ui/Badge';
import { EmptyState }      from '../../components/ui/EmptyState';
import { PageSpinner }     from '../../components/ui/Spinner';
import { ConfirmDialog }   from '../../components/shared/ConfirmDialog';
import { ClientDrawer }    from '../../components/shared/ClientDrawer';
import { useClient, useArchiveClient } from '../../hooks/useClients';
import { clientsApi }      from '../../api/endpoints/clients.api';
import { useToast }        from '../../components/ui/Toast';
import { cn }              from '../../utils/cn';

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0
  }).format(n || 0);

export const ClientDetail = () => {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const toast       = useToast();

  const [editOpen, setEditOpen]         = useState(false);
  const [archiveOpen, setArchiveOpen]   = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: client, isLoading, error } = useClient(id);
  const archiveMutation = useArchiveClient();

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(id);
      toast.success('Client archived');
      navigate('/clients');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleCopyPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await clientsApi.generatePortalToken(id, { expiresInDays: 30 });
      const url = res.data.data.portalUrl || res.data.data.token;
      await navigator.clipboard.writeText(url);
      toast.success('Portal link copied to clipboard');
    } catch {
      toast.error('Failed to generate portal link');
    } finally {
      setPortalLoading(false);
    }
  };

  if (isLoading) return (
    <PageWrapper title="Client">
      <PageSpinner />
    </PageWrapper>
  );

  if (error || !client) return (
    <PageWrapper title="Client">
      <EmptyState
        title="Client not found"
        description="This client doesn't exist or you don't have access."
        action={<Button size="sm" onClick={() => navigate('/clients')}>Back to clients</Button>}
      />
    </PageWrapper>
  );

  return (
    <PageWrapper
      title={client.name}
      subtitle={client.company || client.email}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditOpen(true)}
            icon={<Edit2 className="w-4 h-4" />}
          >
            Edit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyPortal}
            loading={portalLoading}
            icon={<Link2 className="w-4 h-4" />}
          >
            Portal link
          </Button>
        </div>
      }
    >
      <div className="space-y-4 animate-fade-in">
        {/* Back button */}
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to clients
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Profile card */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              {/* Avatar + name */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--border)]">
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg font-semibold text-brand-700 dark:text-brand-400">
                    {client.name[0].toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {client.name}
                  </p>
                  {client.company && (
                    <p className="text-xs text-[var(--text-muted)] truncate">{client.company}</p>
                  )}
                  <Badge
                    status={client.isArchived ? 'cancelled' : 'active'}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Contact details */}
              <div className="space-y-3">
                <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email">
                  <a
                    href={`mailto:${client.email}`}
                    className="text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {client.email}
                  </a>
                </InfoRow>

                {client.phone && (
                  <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone">
                    {client.phone}
                  </InfoRow>
                )}

                {client.company && (
                  <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label="Company">
                    {client.company}
                  </InfoRow>
                )}

                <InfoRow icon={<Globe className="w-3.5 h-3.5" />} label="Country">
                  {client.country || 'IN'}
                </InfoRow>

                {client.gstin && (
                  <InfoRow icon={<Hash className="w-3.5 h-3.5" />} label="GSTIN">
                    <span className="font-mono text-xs">{client.gstin}</span>
                  </InfoRow>
                )}
              </div>

              {client.notes && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Notes</p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {client.notes}
                  </p>
                </div>
              )}

              {/* Danger zone */}
              {!client.isArchived && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-danger hover:bg-danger-light w-full justify-start"
                    onClick={() => setArchiveOpen(true)}
                    icon={<Archive className="w-3.5 h-3.5" />}
                  >
                    Archive client
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Right: Projects + stats */}
          <div className="lg:col-span-2 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total projects', value: client.projects?.length || 0 },
                { label: 'Active',         value: client.projects?.filter(p => p.status === 'active').length || 0 },
                { label: 'Completed',      value: client.projects?.filter(p => p.status === 'completed').length || 0 },
              ].map(stat => (
                <Card key={stat.label} className="text-center">
                  <p className="text-xl font-semibold text-[var(--text-primary)]">{stat.value}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{stat.label}</p>
                </Card>
              ))}
            </div>

            {/* Projects list */}
            <Card padding={false}>
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Projects</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {client.projects?.length || 0} project{client.projects?.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => navigate(`/projects?client=${id}`)}
                  icon={<FolderOpen className="w-3.5 h-3.5" />}
                >
                  View all
                </Button>
              </div>

              {!client.projects?.length ? (
                <EmptyState
                  icon={<FolderOpen className="w-5 h-5" />}
                  title="No projects yet"
                  description="Create a project linked to this client"
                  action={
                    <Button
                      size="sm"
                      onClick={() => navigate(`/projects/new?client=${id}`)}
                      icon={<FolderOpen className="w-3.5 h-3.5" />}
                    >
                      New project
                    </Button>
                  }
                />
              ) : (
                <div>
                  {client.projects.slice(0, 5).map(project => (
                    <div
                      key={project._id}
                      onClick={() => navigate(`/projects/${project._id}`)}
                      className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] last:border-0 table-row-hover cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-md bg-[var(--bg-tertiary)] flex items-center justify-center">
                          <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {project.title}
                          </p>
                          {project.createdAt && (
                            <p className="text-xs text-[var(--text-muted)]">
                              {new Date(project.createdAt).toLocaleDateString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge status={project.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Drawer */}
      <ClientDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        client={client}
      />

      {/* Archive confirm */}
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={handleArchive}
        loading={archiveMutation.isPending}
        title={`Archive ${client.name}?`}
        description="Their projects and invoices are preserved. You can re-add them with the same email address later."
        confirmLabel="Archive"
      />
    </PageWrapper>
  );
};

const InfoRow = ({ icon, label, children }) => (
  <div className="flex items-start gap-2.5">
    <span className="text-[var(--text-muted)] mt-0.5 flex-shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
      <div className="text-sm text-[var(--text-primary)]">{children}</div>
    </div>
  </div>
);
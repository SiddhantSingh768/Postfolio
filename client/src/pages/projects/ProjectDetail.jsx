import { useState }              from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Plus, Link2,
  Link2Off, Calendar, DollarSign,
  User, Tag, Download, Trash2
} from 'lucide-react';
import { PageWrapper }         from '../../components/layout/PageWrapper';
import { Card, CardHeader }    from '../../components/ui/Card';
import { Button }              from '../../components/ui/Button';
import { Badge }               from '../../components/ui/Badge';
import { EmptyState }          from '../../components/ui/EmptyState';
import { PageSpinner }         from '../../components/ui/Spinner';
import { ConfirmDialog }       from '../../components/shared/ConfirmDialog';
import { ProjectDrawer }       from '../../components/shared/ProjectDrawer';
import { MilestoneDrawer }     from '../../components/shared/MilestoneDrawer';
import { MilestoneTimeline }   from '../../components/shared/MilestoneTimeline';
import { StatusTransition }    from '../../components/shared/StatusTransition';
import { useProject, useUpdateProject, useDeleteProject } from '../../hooks/useProjects';
import { projectsApi }         from '../../api/endpoints/projects.api';
import { deliverablesApi }     from '../../api/endpoints/deliverables.api';
import { useToast }            from '../../components/ui/Toast';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { cn }                  from '../../utils/cn';

export const ProjectDetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();
  const toast    = useToast();

  const [editOpen, setEditOpen]         = useState(false);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [editMilestone, setEditMilestone] = useState(null);
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [zipLoading, setZipLoading]     = useState(false);

  const { data: project, isLoading, error } = useProject(id);
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  // Project status transition
  const handleTransition = async (newStatus) => {
    try {
      await updateMutation.mutateAsync({ id, data: { status: newStatus } });
      toast.success(`Project ${newStatus === 'completed' ? 'completed' : 'updated'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transition failed');
    }
  };

  // Delete project
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Project deleted');
      navigate('/projects');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Only draft projects can be deleted');
    }
  };

  // Portal link
  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await projectsApi.generatePortal(id, { expiresInDays: 30 });
      const url = res.data.data.portalUrl;
      await navigator.clipboard.writeText(url);
      toast.success('Portal link copied to clipboard');
    } catch {
      toast.error('Failed to generate portal link');
    } finally {
      setPortalLoading(false);
    }
  };

  // ZIP download
  const handleDownloadZip = async () => {
    setZipLoading(true);
    try {
      const res  = await deliverablesApi.downloadZip(id);
      const url  = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `${project.title}_deliverables.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Download started');
    } catch (err) {
      const code = err.response?.data?.code;
      toast.error(code === 'NO_DELIVERABLES' ? 'No files to download' : 'Download failed');
    } finally {
      setZipLoading(false);
    }
  };

  if (isLoading) return <PageWrapper title="Project"><PageSpinner /></PageWrapper>;

  if (error || !project) return (
    <PageWrapper title="Project">
      <EmptyState
        title="Project not found"
        action={<Button size="sm" onClick={() => navigate('/projects')}>Back to projects</Button>}
      />
    </PageWrapper>
  );

  const milestones        = project.milestones || [];
  const completedCount    = milestones.filter(m => m.status === 'completed').length;
  const progressPercent   = milestones.length
    ? Math.round((completedCount / milestones.length) * 100)
    : 0;

  return (
    <PageWrapper
      title={project.title}
      subtitle={project.client?.name}
      actions={
        <div className="flex items-center gap-2">
          <StatusTransition
            project={project}
            onTransition={handleTransition}
            loading={updateMutation.isPending
              ? updateMutation.variables?.data?.status
              : null
            }
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePortal}
            loading={portalLoading}
            icon={<Link2 className="w-4 h-4" />}
          >
            Portal
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditOpen(true)}
            icon={<Edit2 className="w-4 h-4" />}
          >
            Edit
          </Button>
        </div>
      }
    >
      <div className="space-y-4 animate-fade-in">
        {/* Back */}
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to projects
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left sidebar */}
          <div className="space-y-4">
            {/* Project info */}
            <Card>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {project.title}
                  </p>
                  <Badge status={project.status} className="mt-1" />
                </div>
                {project.status === 'draft' && (
                  <button
                    onClick={() => setDeleteOpen(true)}
                    className="text-[var(--text-muted)] hover:text-danger transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {project.client && (
                  <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Client">
                    <button
                      onClick={() => navigate(`/clients/${project.client._id}`)}
                      className="text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      {project.client.name}
                    </button>
                  </InfoRow>
                )}

                {project.startDate && (
                  <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Start">
                    {formatDate(project.startDate)}
                  </InfoRow>
                )}

                {project.endDate && (
                  <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Deadline">
                    {formatDate(project.endDate)}
                  </InfoRow>
                )}

                {project.budget && (
                  <InfoRow icon={<DollarSign className="w-3.5 h-3.5" />} label="Budget">
                    {formatCurrency(project.budget)}
                  </InfoRow>
                )}

                {project.tags?.length > 0 && (
                  <InfoRow icon={<Tag className="w-3.5 h-3.5" />} label="Tags">
                    <div className="flex flex-wrap gap-1 mt-1">
                      {project.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-secondary)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </InfoRow>
                )}
              </div>

              {project.description && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">Description</p>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {project.description}
                  </p>
                </div>
              )}
            </Card>

            {/* Progress */}
            {milestones.length > 0 && (
              <Card>
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  Progress
                </p>
                <div className="flex items-end justify-between mb-2">
                  <span className="text-2xl font-semibold text-[var(--text-primary)]">
                    {progressPercent}%
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {completedCount}/{milestones.length} done
                  </span>
                </div>
                <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      progressPercent === 100 ? 'bg-success' : 'bg-brand-600'
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </Card>
            )}

            {/* Download ZIP */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={handleDownloadZip}
              loading={zipLoading}
              icon={<Download className="w-4 h-4" />}
            >
              Download all files
            </Button>
          </div>

          {/* Main: milestones */}
          <div className="lg:col-span-2">
            <Card padding={false}>
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Milestones</h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {milestones.length} milestone{milestones.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {['draft', 'active', 'on_hold'].includes(project.status) && (
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => { setEditMilestone(null); setMilestoneOpen(true); }}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add
                  </Button>
                )}
              </div>

              <div className="p-5">
                <MilestoneTimeline
                  milestones={milestones}
                  projectId={id}
                  projectStatus={project.status}
                  onAddMilestone={() => { setEditMilestone(null); setMilestoneOpen(true); }}
                  onEditMilestone={(m) => { setEditMilestone(m); setMilestoneOpen(true); }}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Project edit drawer */}
      <ProjectDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
      />

      {/* Milestone drawer */}
      <MilestoneDrawer
        open={milestoneOpen}
        onClose={() => { setMilestoneOpen(false); setEditMilestone(null); }}
        projectId={id}
        milestone={editMilestone}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        title="Delete project?"
        description="Only draft projects can be deleted. This will permanently remove the project and all its milestones."
        confirmLabel="Delete project"
      />
    </PageWrapper>
  );
};

const InfoRow = ({ icon, label, children }) => (
  <div className="flex items-start gap-2.5">
    <span className="text-[var(--text-muted)] mt-0.5 flex-shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-[var(--text-muted)] mb-0.5">{label}</p>
      <div className="text-sm text-[var(--text-primary)]">{children}</div>
    </div>
  </div>
);
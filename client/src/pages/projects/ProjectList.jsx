import { useState }           from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, FolderOpen, Calendar,
  DollarSign, User, MoreHorizontal,
  Edit2, Trash2, ExternalLink, Link2
} from 'lucide-react';
import { PageWrapper }    from '../../components/layout/PageWrapper';
import { Button }         from '../../components/ui/Button';
import { Badge }          from '../../components/ui/Badge';
import { EmptyState }     from '../../components/ui/EmptyState';
import { PageSpinner }    from '../../components/ui/Spinner';
import { ConfirmDialog }  from '../../components/shared/ConfirmDialog';
import { ProjectDrawer }  from '../../components/shared/ProjectDrawer';
import { useProjectList, useDeleteProject } from '../../hooks/useProjects';
import { projectsApi }    from '../../api/endpoints/projects.api';
import { useToast }       from '../../components/ui/Toast';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { cn }             from '../../utils/cn';

const STATUS_TABS = [
  { value: undefined,    label: 'All'       },
  { value: 'draft',      label: 'Draft'     },
  { value: 'active',     label: 'Active'    },
  { value: 'on_hold',    label: 'On hold'   },
  { value: 'completed',  label: 'Completed' },
  { value: 'cancelled',  label: 'Cancelled' },
];

export const ProjectList = () => {
  const navigate          = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast             = useToast();

  const activeStatus   = searchParams.get('status') || undefined;
  const clientFilter   = searchParams.get('client') || undefined;

  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editProject, setEditProject]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuOpen, setMenuOpen]         = useState(null);

  const deleteMutation = useDeleteProject();

  const { data, isLoading } = useProjectList({
    status: activeStatus,
    client: clientFilter,
  });

  const projects   = data?.projects   || [];
  const pagination = data?.pagination;

  const setStatus = (status) => {
    const params = new URLSearchParams(searchParams);
    if (status) params.set('status', status);
    else        params.delete('status');
    setSearchParams(params);
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(deleteTarget._id);
      toast.success('Project deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Can only delete draft projects');
    }
  };

  const handlePortal = async (project, e) => {
    e.stopPropagation();
    setMenuOpen(null);
    try {
      const res = await projectsApi.generatePortal(project._id, { expiresInDays: 30 });
      const url  = res.data.data.portalUrl;
      await navigator.clipboard.writeText(url);
      toast.success('Portal link copied to clipboard');
    } catch {
      toast.error('Failed to generate portal link');
    }
  };

  return (
    <PageWrapper
      title="Projects"
      subtitle={pagination ? `${pagination.total} project${pagination.total !== 1 ? 's' : ''}` : ''}
      actions={
        <Button
          size="sm"
          onClick={() => { setEditProject(null); setDrawerOpen(true); }}
          icon={<Plus className="w-4 h-4" />}
        >
          New project
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
                'h-8 px-3 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150',
                activeStatus === tab.value
                  ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <PageSpinner />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="w-5 h-5" />}
            title={activeStatus ? `No ${activeStatus} projects` : 'No projects yet'}
            description={
              activeStatus
                ? `You don't have any ${activeStatus} projects`
                : 'Create your first project to get started'
            }
            action={
              !activeStatus && (
                <Button
                  size="sm"
                  onClick={() => { setEditProject(null); setDrawerOpen(true); }}
                  icon={<Plus className="w-4 h-4" />}
                >
                  New project
                </Button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map(project => (
              <ProjectCard
                key={project._id}
                project={project}
                menuOpen={menuOpen === project._id}
                onMenuToggle={(e) => {
                  e.stopPropagation();
                  setMenuOpen(menuOpen === project._id ? null : project._id);
                }}
                onMenuClose={() => setMenuOpen(null)}
                onClick={() => navigate(`/projects/${project._id}`)}
                onEdit={(e) => {
                  e.stopPropagation();
                  setMenuOpen(null);
                  setEditProject(project);
                  setDrawerOpen(true);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setMenuOpen(null);
                  setDeleteTarget(project);
                }}
                onPortal={(e) => handlePortal(project, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      <ProjectDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditProject(null); }}
        project={editProject}
        defaultClientId={clientFilter}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        title={`Delete "${deleteTarget?.title}"?`}
        description="Only draft projects can be deleted. This action cannot be undone."
        confirmLabel="Delete project"
      />
    </PageWrapper>
  );
};

const ProjectCard = ({
  project, menuOpen, onMenuToggle, onMenuClose,
  onClick, onEdit, onDelete, onPortal
}) => (
  <div
    onClick={onClick}
    className="card p-4 cursor-pointer hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 group"
  >
    {/* Header */}
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate mb-1">
          {project.title}
        </p>
        {project.client && (
          <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 truncate">
            <User className="w-3 h-3 flex-shrink-0" />
            {project.client.name}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
        <Badge status={project.status} />
        <div className="relative">
          <button
            onClick={onMenuToggle}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onMenuClose} />
              <div className="absolute right-0 top-8 z-20 w-40 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg py-1 animate-fade-in">
                {[
                  { icon: <ExternalLink className="w-3.5 h-3.5" />, label: 'View', onClick: onClick },
                  { icon: <Edit2         className="w-3.5 h-3.5" />, label: 'Edit', onClick: onEdit },
                  { icon: <Link2         className="w-3.5 h-3.5" />, label: 'Portal link', onClick: onPortal },
                  { icon: <Trash2        className="w-3.5 h-3.5" />, label: 'Delete', onClick: onDelete, danger: true },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors',
                      item.danger
                        ? 'text-danger hover:bg-danger-light dark:hover:bg-red-900/20'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>

    {/* Description */}
    {project.description && (
      <p className="text-xs text-[var(--text-muted)] mb-3 line-clamp-2 leading-relaxed">
        {project.description}
      </p>
    )}

    {/* Footer stats */}
    <div className="flex items-center gap-4 pt-3 border-t border-[var(--border)]">
      {project.endDate && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(project.endDate)}</span>
        </div>
      )}
      {project.budget && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <DollarSign className="w-3 h-3" />
          <span>{formatCurrency(project.budget)}</span>
        </div>
      )}
      {project.milestones?.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] ml-auto">
          <span>{project.milestones.length} milestone{project.milestones.length !== 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  </div>
);
import { useState }  from 'react';
import {
  CheckCircle2, Circle, Clock, AlertCircle,
  Plus, Upload, Edit2, Trash2,
  ChevronDown, ChevronUp, FileText,
  Download, Eye, EyeOff
} from 'lucide-react';
import { Badge }              from '../ui/Badge';
import { Button }             from '../ui/Button';
import { Drawer }             from '../ui/Drawer';
import { DeliverableUpload }  from './DeliverableUpload';
import { ConfirmDialog }      from './ConfirmDialog';
import { useUpdateMilestone, useDeleteMilestone } from '../../hooks/useProjects';
import { deliverablesApi }    from '../../api/endpoints/deliverables.api';
import { formatDate, formatFileSize, isOverdue } from '../../utils/formatters';
import { useToast }           from '../ui/Toast';
import { cn }                 from '../../utils/cn';

// Status icon mapping
const StatusIcon = ({ status, className }) => {
  const icons = {
    completed:   <CheckCircle2 className={cn('text-success', className)} />,
    in_progress: <Clock        className={cn('text-brand-600', className)} />,
    overdue:     <AlertCircle  className={cn('text-danger',   className)} />,
    pending:     <Circle       className={cn('text-[var(--text-muted)]', className)} />,
  };
  return icons[status] || icons.pending;
};

// Status transitions for milestones
const MILESTONE_TRANSITIONS = {
  pending:     ['in_progress'],
  in_progress: ['completed'],
  completed:   [],
  overdue:     ['in_progress', 'completed'],
};

const transitionLabel = { in_progress: 'Start', completed: 'Complete' };

export const MilestoneTimeline = ({
  milestones = [],
  projectId,
  projectStatus,
  onAddMilestone,
  onEditMilestone,
}) => {
  const toast = useToast();
  const [expanded, setExpanded]         = useState({});
  const [uploadTarget, setUploadTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const updateMutation = useUpdateMilestone(projectId);
  const deleteMutation = useDeleteMilestone(projectId);

  const toggleExpand = (id) =>
    setExpanded(e => ({ ...e, [id]: !e[id] }));

  const handleTransition = async (milestone, newStatus) => {
    try {
      await updateMutation.mutateAsync({
        id:   milestone._id,
        data: { status: newStatus }
      });
      toast.success(`Milestone ${newStatus === 'completed' ? 'completed' : 'started'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Transition failed');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(deleteTarget._id);
      toast.success('Milestone deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cannot delete milestone with deliverables');
    }
  };

  const canEdit = ['draft', 'active', 'on_hold'].includes(projectStatus);

  return (
    <div className="space-y-0">
      {milestones.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--text-muted)] mb-3">No milestones yet</p>
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onAddMilestone}
              icon={<Plus className="w-4 h-4" />}
            >
              Add first milestone
            </Button>
          )}
        </div>
      ) : (
        <div>
          {milestones.map((milestone, index) => {
            const isExpanded    = expanded[milestone._id];
            const isLast        = index === milestones.length - 1;
            const overdue       = milestone.status !== 'completed' && isOverdue(milestone.dueDate);
            const displayStatus = overdue && milestone.status !== 'completed' ? 'overdue' : milestone.status;
            const transitions   = MILESTONE_TRANSITIONS[milestone.status] || [];
            const deliverables  = milestone.deliverables || [];

            return (
              <div key={milestone._id} className="relative flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center flex-shrink-0 w-8">
                  <div className="w-8 h-8 flex items-center justify-center z-10">
                    <StatusIcon
                      status={displayStatus}
                      className="w-5 h-5"
                    />
                  </div>
                  {!isLast && (
                    <div className="w-px flex-1 bg-[var(--border)] mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className={cn(
                  'flex-1 pb-6',
                  isLast && 'pb-2'
                )}>
                  {/* Header */}
                  <div
                    className="flex items-start justify-between cursor-pointer group"
                    onClick={() => toggleExpand(milestone._id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={cn(
                          'text-sm font-medium',
                          milestone.status === 'completed'
                            ? 'text-[var(--text-muted)] line-through'
                            : 'text-[var(--text-primary)]'
                        )}>
                          {milestone.title}
                        </p>
                        <Badge status={displayStatus} />
                      </div>

                      {milestone.dueDate && (
                        <p className={cn(
                          'text-xs mt-0.5 flex items-center gap-1',
                          overdue ? 'text-danger' : 'text-[var(--text-muted)]'
                        )}>
                          <Clock className="w-3 h-3" />
                          {overdue ? 'Overdue — ' : 'Due '}
                          {formatDate(milestone.dueDate)}
                        </p>
                      )}

                      {deliverables.length > 0 && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {deliverables.length} file{deliverables.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      {canEdit && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); onEditMilestone(milestone); }}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(milestone); }}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-danger-light hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                        : <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                      }
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 animate-fade-in">
                      {milestone.description && (
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-tertiary)] rounded-md px-3 py-2">
                          {milestone.description}
                        </p>
                      )}

                      {/* Client approval comment */}
                      {milestone.clientNote && (
                        <div className="bg-success-light dark:bg-green-900/20 border border-success/30 rounded-md px-3 py-2">
                          <p className="text-xs font-medium text-success-dark dark:text-green-400 mb-0.5">
                            Client approved
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            "{milestone.clientNote}"
                          </p>
                        </div>
                      )}

                      {/* Status transitions */}
                      {canEdit && transitions.length > 0 && (
                        <div className="flex gap-2">
                          {transitions.map(t => (
                            <Button
                              key={t}
                              size="xs"
                              variant={t === 'completed' ? 'primary' : 'secondary'}
                              loading={updateMutation.isPending}
                              onClick={() => handleTransition(milestone, t)}
                            >
                              {transitionLabel[t] || t}
                            </Button>
                          ))}
                        </div>
                      )}

                      {/* Deliverables */}
                      {deliverables.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                            Files
                          </p>
                          {deliverables.map(d => (
                            <DeliverableRow key={d._id} deliverable={d} />
                          ))}
                        </div>
                      )}

                      {/* Upload button */}
                      {canEdit && (
                        <Button
                          variant="secondary"
                          size="xs"
                          onClick={() => setUploadTarget(milestone)}
                          icon={<Upload className="w-3.5 h-3.5" />}
                        >
                          Upload file
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add milestone button */}
          {canEdit && (
            <div className="flex gap-4 mt-2">
              <div className="w-8 flex justify-center">
                <div className="w-px h-4 bg-[var(--border)]" />
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={onAddMilestone}
                icon={<Plus className="w-3.5 h-3.5" />}
                className="mb-2"
              >
                Add milestone
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upload drawer */}
      <Drawer
        open={!!uploadTarget}
        onClose={() => setUploadTarget(null)}
        title="Upload deliverable"
        subtitle={uploadTarget?.title}
      >
        {uploadTarget && (
          <DeliverableUpload
            milestoneId={uploadTarget._id}
            projectId={projectId}
            onClose={() => setUploadTarget(null)}
          />
        )}
      </Drawer>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        title="Delete milestone?"
        description={
          deleteTarget?.deliverables?.length > 0
            ? 'This milestone has deliverables. Delete them first before deleting the milestone.'
            : `"${deleteTarget?.title}" will be permanently deleted.`
        }
        confirmLabel="Delete"
      />
    </div>
  );
};

// Individual deliverable row
const DeliverableRow = ({ deliverable }) => {
  const toast = useToast();

  const handleOpen = () => {
    if (deliverable.signedUrl || deliverable.fileUrl) {
      window.open(deliverable.signedUrl || deliverable.fileUrl, '_blank');
    } else {
      toast.info('File URL not available');
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-[var(--bg-tertiary)] rounded-md group">
      <FileText className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
          {deliverable.filename}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          v{deliverable.version} · {formatFileSize(deliverable.fileSize)}
          {!deliverable.isClientVisible && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-warning">
              <EyeOff className="w-3 h-3" /> Hidden from client
            </span>
          )}
        </p>
      </div>
      <button
        onClick={handleOpen}
        className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-brand-600 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
import { useState }  from 'react';
import {
  CheckCircle2, Circle, Clock, AlertCircle,
  ChevronDown, ChevronUp, FileText,
  Download, MessageSquare, Send
} from 'lucide-react';
import { useApproveMilestone }  from '../../hooks/usePortal';
import { formatDate, formatFileSize, isOverdue } from '../../utils/formatters';
import { cn } from '../../utils/cn';

const StatusIcon = ({ status, size = 'md' }) => {
  const s = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const icons = {
    completed:   <CheckCircle2 className={cn(s, 'text-green-500')} />,
    in_progress: <Clock        className={cn(s, 'text-blue-500')} />,
    overdue:     <AlertCircle  className={cn(s, 'text-red-500')} />,
    pending:     <Circle       className={cn(s, 'text-gray-400')} />,
  };
  return icons[status] || icons.pending;
};

export const PortalMilestoneTimeline = ({ milestones = [], projectId }) => {
  const [expanded, setExpanded]     = useState({});
  const [commenting, setCommenting] = useState({});
  const [comments, setComments]     = useState({});
  const approveMutation = useApproveMilestone(projectId);

  const toggleExpand = (id) =>
    setExpanded(e => ({ ...e, [id]: !e[id] }));

  const handleApprove = async (milestoneId) => {
    const comment = comments[milestoneId]?.trim();
    if (!comment) return;

    try {
      await approveMutation.mutateAsync({ milestoneId, comment });
      setCommenting(c => ({ ...c, [milestoneId]: false }));
      setComments(c => ({ ...c, [milestoneId]: '' }));
    } catch (err) {
      console.error('Approval failed:', err);
    }
  };

  if (!milestones.length) return (
    <div className="text-center py-8">
      <p className="text-sm text-gray-400">No milestones yet</p>
    </div>
  );

  return (
    <div>
      {milestones.map((milestone, index) => {
        const isLast        = index === milestones.length - 1;
        const overdue       = milestone.status !== 'completed' && isOverdue(milestone.dueDate);
        const displayStatus = overdue ? 'overdue' : milestone.status;
        const isExpanded    = expanded[milestone._id];
        const isCommenting  = commenting[milestone._id];
        const deliverables  = milestone.deliverables || [];
        const hasApproval   = !!milestone.clientNote;

        return (
          <div key={milestone._id} className="relative flex gap-4">
            {/* Timeline connector */}
            <div className="flex flex-col items-center flex-shrink-0 w-8">
              <div className="w-8 h-8 flex items-center justify-center z-10">
                <StatusIcon status={displayStatus} />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1" />
              )}
            </div>

            {/* Content */}
            <div className={cn('flex-1 pb-6', isLast && 'pb-2')}>
              {/* Header row */}
              <div
                className="flex items-start justify-between cursor-pointer group"
                onClick={() => toggleExpand(milestone._id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn(
                      'text-sm font-semibold',
                      milestone.status === 'completed'
                        ? 'text-gray-400 line-through'
                        : 'text-gray-900 dark:text-gray-100'
                    )}>
                      {milestone.title}
                    </p>
                    <MilestoneStatusBadge status={displayStatus} />
                  </div>

                  {milestone.dueDate && (
                    <p className={cn(
                      'text-xs mt-0.5 flex items-center gap-1',
                      overdue ? 'text-red-500' : 'text-gray-400'
                    )}>
                      <Clock className="w-3 h-3" />
                      {overdue ? 'Overdue — ' : 'Due '}
                      {formatDate(milestone.dueDate)}
                    </p>
                  )}

                  {deliverables.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {deliverables.length} file{deliverables.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                <div className="ml-2 flex-shrink-0">
                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                  }
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="mt-3 space-y-3">
                  {/* Description */}
                  {milestone.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2.5">
                      {milestone.description}
                    </p>
                  )}

                  {/* Deliverables */}
                  {deliverables.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Files
                      </p>
                      {deliverables.map(d => (
                        <PortalDeliverableRow key={d._id} deliverable={d} />
                      ))}
                    </div>
                  )}

                  {/* Approval section */}
                  {hasApproval ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Your approval
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-300 italic">
                        "{milestone.clientNote}"
                      </p>
                    </div>
                  ) : milestone.status === 'completed' ? (
                    isCommenting ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                          placeholder="Leave your approval comment..."
                          rows={3}
                          maxLength={500}
                          value={comments[milestone._id] || ''}
                          onChange={e => setComments(c => ({
                            ...c, [milestone._id]: e.target.value
                          }))}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCommenting(c => ({ ...c, [milestone._id]: false }))}
                            className="flex-1 h-8 px-3 text-xs font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleApprove(milestone._id)}
                            disabled={
                              !comments[milestone._id]?.trim() ||
                              approveMutation.isPending
                            }
                            className="flex-1 h-8 px-3 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            {approveMutation.isPending ? (
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Submit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCommenting(c => ({ ...c, [milestone._id]: true }))}
                        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Leave approval comment
                      </button>
                    )
                  ) : null}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const MilestoneStatusBadge = ({ status }) => {
  const configs = {
    pending:     { bg: 'bg-gray-100 dark:bg-gray-800',   text: 'text-gray-500 dark:text-gray-400',   label: 'Pending'     },
    in_progress: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400',   label: 'In progress' },
    completed:   { bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Done'       },
    overdue:     { bg: 'bg-red-50 dark:bg-red-900/30',   text: 'text-red-700 dark:text-red-400',     label: 'Overdue'     },
  };
  const c = configs[status] || configs.pending;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium', c.bg, c.text)}>
      {c.label}
    </span>
  );
};

const PortalDeliverableRow = ({ deliverable }) => (
  <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg group">
    <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
        {deliverable.filename}
      </p>
      <p className="text-xs text-gray-400">
        v{deliverable.version} · {formatFileSize(deliverable.fileSize)}
      </p>
    </div>
    {(deliverable.signedUrl || deliverable.fileUrl) && (
      <a
        href={deliverable.signedUrl || deliverable.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Download className="w-3.5 h-3.5" />
      </a>
    )}
  </div>
);
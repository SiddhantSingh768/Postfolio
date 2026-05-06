const Milestone = require('../models/milestone.model');
const Project   = require('../models/project.model');
const AppError  = require('../utils/AppError');
const logger    = require('../config/logger');
const { buildWorkspaceQuery } = require('../utils/queryHelpers');

// ─── Valid milestone transitions ──────────────────────────────────────────────
// Simpler than projects — milestones move forward only, except overdue
// which is set automatically by the cron job in Phase 7

const MILESTONE_TRANSITIONS = {
  pending:     ['in_progress'],
  in_progress: ['completed'],
  completed:   [],
  overdue:     ['in_progress', 'completed'] // Can still be completed even if overdue
};

const transitionMilestone = (milestone, newStatus) => {
  const allowed = MILESTONE_TRANSITIONS[milestone.status];
  if (!allowed.includes(newStatus)) {
    throw new AppError(
      409,
      'INVALID_MILESTONE_TRANSITION',
      `Cannot transition milestone from "${milestone.status}" to "${newStatus}"`
    );
  }
  milestone.status = newStatus;
  if (newStatus === 'completed') milestone.completedAt = new Date();
};

// ─── Add milestone to project ─────────────────────────────────────────────────

const addMilestone = async (projectId, workspaceId, data) => {
  // Verify project exists and belongs to workspace
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  // Milestones can only be added to active or draft projects
  if (['completed', 'cancelled'].includes(project.status)) {
    throw new AppError(
      409,
      'PROJECT_NOT_EDITABLE',
      `Cannot add milestones to a ${project.status} project`
    );
  }

  // Set order to be after the last existing milestone
  const count = await Milestone.countDocuments({ project: projectId });

  const milestone = await Milestone.create({
    workspace:   workspaceId,
    project:     projectId,
    title:       data.title,
    description: data.description || null,
    dueDate:     data.dueDate     || null,
    order:       data.order       !== undefined ? data.order : count + 1,
  });

  // Add milestone reference to project's milestones array
  await Project.findByIdAndUpdate(projectId, {
    $push: { milestones: milestone._id }
  });

  logger.info({ milestoneId: milestone._id, projectId }, 'Milestone added');
  return milestone;
};

// ─── Update milestone ─────────────────────────────────────────────────────────

const updateMilestone = async (milestoneId, workspaceId, updates) => {
  const milestone = await Milestone.findOne(
    buildWorkspaceQuery({ _id: milestoneId }, workspaceId)
  );
  if (!milestone) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  // Handle status transition
  if (updates.status && updates.status !== milestone.status) {
    transitionMilestone(milestone, updates.status);
  }

  // Update non-status fields
  const allowed = ['title', 'description', 'dueDate', 'order'];
  allowed.forEach(field => {
    if (updates[field] !== undefined) milestone[field] = updates[field];
  });

  await milestone.save();

  logger.info({ milestoneId, workspaceId }, 'Milestone updated');
  return milestone;
};

// ─── Delete milestone ─────────────────────────────────────────────────────────

const deleteMilestone = async (milestoneId, workspaceId) => {
  const milestone = await Milestone.findOne(
    buildWorkspaceQuery({ _id: milestoneId }, workspaceId)
  );
  if (!milestone) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  // Cannot delete a milestone that has deliverables — Phase 3 enforces this
  if (milestone.deliverables.length > 0) {
    throw new AppError(
      409,
      'MILESTONE_HAS_DELIVERABLES',
      'Delete all deliverables on this milestone before deleting it'
    );
  }

  // Remove from project's milestones array
  await Project.findByIdAndUpdate(milestone.project, {
    $pull: { milestones: milestoneId }
  });

  await Milestone.findByIdAndDelete(milestoneId);

  logger.info({ milestoneId, workspaceId }, 'Milestone deleted');
  return { message: 'Milestone deleted' };
};

module.exports = { addMilestone, updateMilestone, deleteMilestone };
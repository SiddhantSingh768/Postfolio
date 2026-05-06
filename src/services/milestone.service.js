const Milestone = require('../models/milestone.model');
const Project   = require('../models/project.model');
const AppError  = require('../utils/AppError');
const logger    = require('../config/logger');
const { buildWorkspaceQuery } = require('../utils/queryHelpers');


const MILESTONE_TRANSITIONS = {
  pending:     ['in_progress'],
  in_progress: ['completed'],
  completed:   [],
  overdue:     ['in_progress', 'completed']
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


const addMilestone = async (projectId, workspaceId, data) => {
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  if (['completed', 'cancelled'].includes(project.status)) {
    throw new AppError(
      409,
      'PROJECT_NOT_EDITABLE',
      `Cannot add milestones to a ${project.status} project`
    );
  }

  const count = await Milestone.countDocuments({ project: projectId });

  const milestone = await Milestone.create({
    workspace:   workspaceId,
    project:     projectId,
    title:       data.title,
    description: data.description || null,
    dueDate:     data.dueDate     || null,
    order:       data.order       !== undefined ? data.order : count + 1,
  });

  await Project.findByIdAndUpdate(projectId, {
    $push: { milestones: milestone._id }
  });

  logger.info({ milestoneId: milestone._id, projectId }, 'Milestone added');
  return milestone;
};


const updateMilestone = async (milestoneId, workspaceId, updates) => {
  const milestone = await Milestone.findOne(
    buildWorkspaceQuery({ _id: milestoneId }, workspaceId)
  );
  if (!milestone) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  if (updates.status && updates.status !== milestone.status) {
    transitionMilestone(milestone, updates.status);
  }

  const allowed = ['title', 'description', 'dueDate', 'order'];
  allowed.forEach(field => {
    if (updates[field] !== undefined) milestone[field] = updates[field];
  });

  await milestone.save();

  logger.info({ milestoneId, workspaceId }, 'Milestone updated');
  return milestone;
};


const deleteMilestone = async (milestoneId, workspaceId) => {
  const milestone = await Milestone.findOne(
    buildWorkspaceQuery({ _id: milestoneId }, workspaceId)
  );
  if (!milestone) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  if (milestone.deliverables.length > 0) {
    throw new AppError(
      409,
      'MILESTONE_HAS_DELIVERABLES',
      'Delete all deliverables on this milestone before deleting it'
    );
  }

  await Project.findByIdAndUpdate(milestone.project, {
    $pull: { milestones: milestoneId }
  });

  await Milestone.findByIdAndDelete(milestoneId);

  logger.info({ milestoneId, workspaceId }, 'Milestone deleted');
  return { message: 'Milestone deleted' };
};

module.exports = { addMilestone, updateMilestone, deleteMilestone };
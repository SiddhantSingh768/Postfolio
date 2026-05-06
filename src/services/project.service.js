const Project   = require('../models/project.model');
const Client    = require('../models/client.model');
const Milestone = require('../models/milestone.model');
const AppError  = require('../utils/AppError');
const logger    = require('../config/logger');
const { buildWorkspaceQuery, getPagination } = require('../utils/queryHelpers');
const { markStepComplete } = require('./onboarding.service');


const VALID_TRANSITIONS = {
  draft:     ['active'],
  active:    ['on_hold', 'completed'],
  on_hold:   ['active', 'cancelled'],
  completed: [],
  cancelled: []
};

const transitionProject = async (project, newStatus) => {
  const allowed = VALID_TRANSITIONS[project.status];

  if (!allowed.includes(newStatus)) {
    throw new AppError(
      409,
      'INVALID_TRANSITION',
      `Cannot transition project from "${project.status}" to "${newStatus}". ` +
      `Allowed transitions: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`
    );
  }

  project.status = newStatus;
  await project.save();

  logger.info(
    { projectId: project._id, from: project.status, to: newStatus },
    'Project status transitioned'
  );
};


const listProjects = async (workspaceId, query) => {
  const { skip, limit, page } = getPagination(query);

  const filter = buildWorkspaceQuery({ isDeleted: false }, workspaceId);

  if (query.status) {
    const statuses = query.status.split(',').map(s => s.trim());
    filter.status = { $in: statuses };
  }

  if (query.client) {
    filter.client = query.client;
  }

  const [projects, total] = await Promise.all([
    Project.find(filter)
           .populate('client', 'name company email') // Attach client name to each project
           .sort({ createdAt: -1 })
           .skip(skip)
           .limit(limit)
           .lean(),
    Project.countDocuments(filter)
  ]);

  return {
    projects,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};


const getProject = async (projectId, workspaceId) => {
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  )
  .populate('client', 'name company email gstin')
  .populate({
    path:    'milestones',
    options: { sort: { order: 1 } } // Return milestones in display order
  })
  .lean();

  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  return project;
};


const createProject = async (workspaceId, data, userId) => {
  const client = await Client.findOne(
    buildWorkspaceQuery({ _id: data.clientId, isArchived: false }, workspaceId)
  );
  if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found in this workspace');

  const project = await Project.create({
    workspace:   workspaceId,
    client:      data.clientId,
    title:       data.title,
    description: data.description || null,
    startDate:   data.startDate   || null,
    endDate:     data.endDate     || null,
    budget:      data.budget      || null,
    tags:        data.tags        || [],
  });

  logger.info({ projectId: project._id, workspaceId }, 'Project created');
  await markStepComplete(userId, 'create_project');
  return project;
};


const updateProject = async (projectId, workspaceId, updates) => {
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  if (updates.status && updates.status !== project.status) {
    await transitionProject(project, updates.status);
  }

  const allowed = ['title', 'description', 'startDate', 'endDate', 'budget', 'tags', 'notifyClient'];
  allowed.forEach(field => {
    if (updates[field] !== undefined) project[field] = updates[field];
  });

  await project.save();

  logger.info({ projectId, workspaceId }, 'Project updated');
  return project;
};


const deleteProject = async (projectId, workspaceId) => {
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  if (project.status !== 'draft') {
    throw new AppError(
      409,
      'PROJECT_NOT_DELETABLE',
      `Only draft projects can be deleted. This project is "${project.status}". ` +
      `Cancel it first, or archive the associated client.`
    );
  }

  project.isDeleted = true;
  project.deletedAt = new Date();
  await project.save();

  logger.info({ projectId, workspaceId }, 'Project soft-deleted');
  return { message: 'Project deleted' };
};

module.exports = {
  listProjects, getProject,
  createProject, updateProject, deleteProject
};
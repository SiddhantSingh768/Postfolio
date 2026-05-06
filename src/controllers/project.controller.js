const projectService = require('../services/project.service');
const asyncHandler   = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const result = await projectService.listProjects(req.workspaceId, req.query);
  res.status(200).json({ status: 'success', data: result });
});

const get = asyncHandler(async (req, res) => {
  const project = await projectService.getProject(req.params.id, req.workspaceId);
  res.status(200).json({ status: 'success', data: { project } });
});

const create = asyncHandler(async (req, res) => {
  const project = await projectService.createProject(req.workspaceId, req.body,req.user._id);
  res.status(201).json({ status: 'success', data: { project } });
});

const update = asyncHandler(async (req, res) => {
  const project = await projectService.updateProject(req.params.id, req.workspaceId, req.body);
  res.status(200).json({ status: 'success', data: { project } });
});

const remove = asyncHandler(async (req, res) => {
  const result = await projectService.deleteProject(req.params.id, req.workspaceId);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { list, get, create, update, remove };
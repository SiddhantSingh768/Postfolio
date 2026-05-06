const clientService  = require('../services/client.service');
const asyncHandler   = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const result = await clientService.listClients(req.workspaceId, req.query);
  res.status(200).json({ status: 'success', data: result });
});

const get = asyncHandler(async (req, res) => {
  const client = await clientService.getClient(req.params.id, req.workspaceId);
  res.status(200).json({ status: 'success', data: { client } });
});

const create = asyncHandler(async (req, res) => {
  const client = await clientService.createClient(req.workspaceId, req.body,req.user._id);
  res.status(201).json({ status: 'success', data: { client } });
});

const update = asyncHandler(async (req, res) => {
  const client = await clientService.updateClient(req.params.id, req.workspaceId, req.body);
  res.status(200).json({ status: 'success', data: { client } });
});

const archive = asyncHandler(async (req, res) => {
  const result = await clientService.archiveClient(req.params.id, req.workspaceId);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { list, get, create, update, archive };
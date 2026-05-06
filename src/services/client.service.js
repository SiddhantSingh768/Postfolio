const Client   = require('../models/client.model');
const Project  = require('../models/project.model');
const AppError = require('../utils/AppError');
const logger   = require('../config/logger');
const { buildWorkspaceQuery, getPagination } = require('../utils/queryHelpers');
const { markStepComplete } = require('./onboarding.service');


const listClients = async (workspaceId, query) => {
  const { skip, limit, page } = getPagination(query);

  const filter = buildWorkspaceQuery({}, workspaceId);

  if (query.archived === 'true') {
    filter.isArchived = true;
  } else {
    filter.isArchived = false;
  }

  if (query.search) {
    const regex = new RegExp(query.search, 'i'); // case-insensitive
    filter.$or = [{ name: regex }, { company: regex }];
  }

  const [clients, total] = await Promise.all([
    Client.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(), // .lean() returns plain JS objects — faster, no Mongoose overhead
    Client.countDocuments(filter)
  ]);

  return {
    clients,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
};


const getClient = async (clientId, workspaceId) => {
  const client = await Client.findOne(
    buildWorkspaceQuery({ _id: clientId }, workspaceId)
  ).lean();

  if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found');

  const projects = await Project.find(
    buildWorkspaceQuery({ client: clientId, isDeleted: false }, workspaceId)
  ).select('title status budget createdAt').lean();

  return { ...client, projects };
};


const createClient = async (workspaceId, data, userId) => {

  const client = await Client.create({
    workspace: workspaceId,
    name:      data.name,
    company:   data.company   || null,
    email:     data.email.toLowerCase().trim(),
    phone:     data.phone     || null,
    country:   data.country   || 'IN',
    gstin:     data.gstin     || null,
    notes:     data.notes     || null,
  });

  logger.info({ clientId: client._id, workspaceId }, 'Client created');
  await markStepComplete(userId, 'add_client');
  return client;
};


const updateClient = async (clientId, workspaceId, updates) => {
  const allowed = ['name', 'company', 'email', 'phone', 'country', 'gstin', 'notes'];
  const sanitised = {};
  allowed.forEach(field => {
    if (updates[field] !== undefined) sanitised[field] = updates[field];
  });

  if (sanitised.email) {
    sanitised.email = sanitised.email.toLowerCase().trim();
  }

  const client = await Client.findOneAndUpdate(
    buildWorkspaceQuery({ _id: clientId, isArchived: false }, workspaceId),
    { $set: sanitised },
    { new: true, runValidators: true }
  );

  if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found or already archived');

  logger.info({ clientId, workspaceId }, 'Client updated');
  return client;
};


const archiveClient = async (clientId, workspaceId) => {

  const client = await Client.findOneAndUpdate(
    buildWorkspaceQuery({ _id: clientId, isArchived: false }, workspaceId),
    { $set: { isArchived: true } },
    { new: true }
  );

  if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found or already archived');

  logger.info({ clientId, workspaceId }, 'Client archived');
  return { message: 'Client archived successfully' };
};

module.exports = { listClients, getClient, createClient, updateClient, archiveClient };
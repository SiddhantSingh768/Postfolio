const Workspace = require('../models/workspace.model');

const createSoloWorkspace = async (userId, userName) => {
  return Workspace.create({
    name:    `${userName}'s Workspace`,
    owner:   userId,
    members: [{ user: userId, role: 'owner', joinedAt: new Date() }],
    plan:    'solo'
  });
};

module.exports = { createSoloWorkspace };
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');
const User      = require('../src/models/user.model');
const Workspace = require('../src/models/workspace.model');
const { generateAccessToken } = require('../src/utils/tokenUtils');

const createVerifiedUser = async (email = 'freelancer@test.com', name = 'Test User') => {
  const workspace = await Workspace.create({
    name:    `${name}'s Workspace`,
    owner:   new mongoose.Types.ObjectId(), // Temp — updated below
    members: [],
    plan:    'solo'
  });

  const user = await User.create({
    name,
    email,
    passwordHash:     await bcrypt.hash('Password1', 10),
    isEmailVerified:  true,
    defaultWorkspace: workspace._id,
    role:             'freelancer'
  });

  workspace.owner   = user._id;
  workspace.members = [{ user: user._id, role: 'owner', joinedAt: new Date() }];
  await workspace.save();

  const token = generateAccessToken(user._id, workspace._id, 'freelancer');
  return { user, workspace, token, workspaceId: workspace._id };
};

module.exports = { createVerifiedUser };
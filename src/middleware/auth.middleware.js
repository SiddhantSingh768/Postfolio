const { verifyAccessToken } = require('../utils/tokenUtils');
const AppError  = require('../utils/AppError');
const User      = require('../models/user.model');
const Workspace = require('../models/workspace.model');


const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'NO_TOKEN', 'Authentication required');
    }

    const token   = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user || !user.isActive) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User account not found or deactivated');
    }

    const workspace = await Workspace.findById(decoded.workspaceId);
    if (!workspace || !workspace.isActive) {
      throw new AppError(401, 'WORKSPACE_NOT_FOUND', 'Workspace not found');
    }

    req.user        = user;
    req.workspace   = workspace;
    req.workspaceId = workspace._id;

    next();
  } catch (err) {
    next(err);
  }
};
const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'You do not have permission for this action'));
  }
  next();
};

module.exports = { protect, restrictTo };
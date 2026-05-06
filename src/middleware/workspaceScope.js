const workspaceScope = (req, res, next) => {
  req.workspaceId = req.workspace._id;
  next();
};

module.exports = workspaceScope;
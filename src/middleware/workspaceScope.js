// This is the multi-tenancy enforcement layer.
// It runs after protect() and ensures req.workspaceId is always available.
//
// Every service in Phase 2+ must scope DB queries like this:
//   Client.findOne({ _id: clientId, workspace: req.workspaceId })
//
// NOT like this:
//   Client.findOne({ _id: clientId })
//
// The second form is broken object-level auth — any authenticated user
// could access any client's data just by knowing the ID.

const workspaceScope = (req, res, next) => {
  // protect() must run before this middleware
  req.workspaceId = req.workspace._id;
  next();
};

module.exports = workspaceScope;
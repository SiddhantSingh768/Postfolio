// buildWorkspaceQuery takes a filter object and injects the workspace ID.
// This is the single enforcement point for multi-tenancy.
//
// EVERY service function that reads from DB must use this.
// Never write: Model.findOne({ _id: id })
// Always write: Model.findOne(buildWorkspaceQuery({ _id: id }, workspaceId))
//
// Usage:
//   const query = buildWorkspaceQuery({ _id: clientId }, req.workspaceId);
//   const client = await Client.findOne(query);

const buildWorkspaceQuery = (filter = {}, workspaceId) => ({
  ...filter,
  workspace: workspaceId
});

// Pagination helper — used on all list endpoints
// Returns { skip, limit } from page/limit query params
const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(50, parseInt(query.limit) || 20);
  return { skip: (page - 1) * limit, limit, page };
};

module.exports = { buildWorkspaceQuery, getPagination };
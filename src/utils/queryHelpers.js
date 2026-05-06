
const buildWorkspaceQuery = (filter = {}, workspaceId) => ({
  ...filter,
  workspace: workspaceId
});

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(50, parseInt(query.limit) || 20);
  return { skip: (page - 1) * limit, limit, page };
};

module.exports = { buildWorkspaceQuery, getPagination };
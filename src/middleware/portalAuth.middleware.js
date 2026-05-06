const { validatePortalToken } = require("../services/portal.service");
const Project = require("../models/project.model");
const AppError = require("../utils/AppError");
const logger = require("../config/logger");

const portalAuth = async (req, res, next) => {
  try {
    const token = req.query.token;
    const projectId = req.params.projectId;

    if (!token) {
      throw new AppError(
        401,
        "NO_PORTAL_TOKEN",
        "Portal access token required",
      );
    }
    const decoded = validatePortalToken(token, projectId);

    const project = await Project.findOne({
      _id: projectId,
      workspace: decoded.workspaceId,
      portalEnabled: true,
      portalToken: token,
    });

    if (!project) {
      throw new AppError(
        403,
        "PORTAL_ACCESS_DENIED",
        "Portal access has been revoked or the link is invalid",
      );
    }
    if (
      project.portalTokenExpiresAt &&
      project.portalTokenExpiresAt < new Date()
    ) {
      throw new AppError(
        403,
        "PORTAL_TOKEN_EXPIRED",
        "Portal link has expired",
      );
    }
    req.portalProjectId = projectId;
    req.portalWorkspaceId = decoded.workspaceId;

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = portalAuth;

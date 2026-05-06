const { validatePortalToken } = require("../services/portal.service");
const Project = require("../models/project.model");
const AppError = require("../utils/AppError");
const logger = require("../config/logger");

// portalAuth replaces protect + workspaceScope for portal routes.
// It validates the HMAC token from the query string and attaches
// req.portalProjectId and req.portalWorkspaceId to the request.
//
// Usage on routes: router.get('/:projectId', portalAuth, handler)

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

    // Decode and verify the token
    const decoded = validatePortalToken(token, projectId);

    // Fetch the project and verify the stored token matches
    // This is the revocation check — if the freelancer revoked the token,
    // project.portalToken will be null and this fails
    const project = await Project.findOne({
      _id: projectId,
      workspace: decoded.workspaceId,
      portalEnabled: true,
      portalToken: token, // Must match exactly
    });

    if (!project) {
      throw new AppError(
        403,
        "PORTAL_ACCESS_DENIED",
        "Portal access has been revoked or the link is invalid",
      );
    }

    // Check expiry against stored date as well
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

    // Attach to request for controllers
    req.portalProjectId = projectId;
    req.portalWorkspaceId = decoded.workspaceId;

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = portalAuth;

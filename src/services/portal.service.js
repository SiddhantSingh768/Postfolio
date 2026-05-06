const Project     = require('../models/project.model');
const Client      = require('../models/client.model');
const Milestone   = require('../models/milestone.model');
const Deliverable = require('../models/deliverable.model');
const Invoice     = require('../models/invoice.model');
const AppError    = require('../utils/AppError');
const logger      = require('../config/logger');
const {
  generatePortalToken,
  verifyPortalToken
}                 = require('../utils/tokenUtils');
const { buildWorkspaceQuery } = require('../utils/queryHelpers');


const generatePortalAccess = async (projectId, workspaceId, expiresInDays = 30) => {
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  const token     = generatePortalToken(
    workspaceId.toString(),
    projectId.toString(),
    expiresInDays
  );
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  project.portalEnabled        = true;
  project.portalToken          = token;
  project.portalTokenExpiresAt = expiresAt;
  await project.save();

  const portalUrl = `${process.env.CLIENT_URL}/portal/${projectId}?token=${token}`;

  logger.info({ projectId, workspaceId, expiresAt }, 'Portal access generated');

  return {
    portalUrl,
    token,
    expiresAt,
    message: `Portal link valid for ${expiresInDays} days`
  };
};


const revokePortalAccess = async (projectId, workspaceId) => {
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  project.portalEnabled        = false;
  project.portalToken          = null;
  project.portalTokenExpiresAt = null;
  await project.save();

  logger.info({ projectId, workspaceId }, 'Portal access revoked');
  return { message: 'Portal access revoked. The link is immediately invalid.' };
};


const validatePortalToken = (token, projectId) => {
  if (!token) throw new AppError(401, 'NO_PORTAL_TOKEN', 'Portal token required');

  try {
    const decoded = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString()
    );

    verifyPortalToken(token, decoded.workspaceId, projectId.toString());

    return decoded;
  } catch (err) {
    throw new AppError(403, 'INVALID_PORTAL_TOKEN', `Portal access denied: ${err.message}`);
  }
};


const getPortalView = async (projectId, workspaceId) => {
  const project = await Project.findOne({
    _id:          projectId,
    workspace:    workspaceId,
    isDeleted:    false,
    portalEnabled: true,
  })
  .populate('client', 'name company email')
  .lean();

  if (!project) {
    throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found or portal not enabled');
  }

  const milestones = await Milestone.find({
    project:   projectId,
    workspace: workspaceId,
  })
  .sort({ order: 1 })
  .lean();

  const deliverables = await Deliverable.find({
    project:         projectId,
    workspace:       workspaceId,
    isCurrent:       true,
    isClientVisible: true,
  })
  .lean();

  const deliverablesByMilestone = deliverables.reduce((acc, d) => {
    const key = d.milestone.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const milestonesWithDeliverables = milestones.map(m => ({
    ...m,
    deliverables: deliverablesByMilestone[m._id.toString()] || []
  }));

  const invoices = await Invoice.find({
    project:   projectId,
    workspace: workspaceId,
    status:    { $in: ['sent', 'viewed', 'paid', 'overdue', 'payment_failed'] }
  })
  .select('invoiceNumber status grandTotal dueDate paidAt razorpayLinkUrl issueDate')
  .lean();

  return {
    project: {
      _id:         project._id,
      title:       project.title,
      description: project.description,
      status:      project.status,
      startDate:   project.startDate,
      endDate:     project.endDate,
      client:      project.client,
    },
    milestones:  milestonesWithDeliverables,
    invoices,
    generatedAt: new Date(),
  };
};


const markInvoiceViewed = async (invoiceId, projectId, workspaceId) => {
  const invoice = await Invoice.findOne({
    _id:       invoiceId,
    project:   projectId,
    workspace: workspaceId,
    status:    'sent', 
  });

  if (!invoice) {
    return { alreadyTracked: true };
  }

  invoice.status   = 'viewed';
  invoice.viewedAt = new Date();
  await invoice.save();

  try {
    const { transporter } = require('../config/nodemailer');
    const User = require('../models/user.model');

    const freelancer = await User.findOne({
      defaultWorkspace: workspaceId,
      isActive:         true
    });

    if (freelancer) {
      await transporter.sendMail({
        from:    `"Postfolio" <${process.env.SMTP_USER}>`,
        to:      freelancer.email,
        subject: `Invoice ${invoice.invoiceNumber} was viewed by your client`,
        html:    `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#1A56DB;">Invoice Viewed</h2>
            <p>Your client opened invoice <strong>${invoice.invoiceNumber}</strong>
            for <strong>₹${invoice.grandTotal.toLocaleString('en-IN')}</strong>.</p>
            <p style="color:#6b7280;font-size:13px;">Viewed at: ${new Date().toLocaleString('en-IN')}</p>
          </div>
        `
      });
    }
  } catch (err) {
    logger.warn({ err: err.message, invoiceId }, 'Invoice viewed notification failed');
  }

  logger.info({ invoiceId, projectId }, 'Invoice marked as viewed');
  return { viewed: true, viewedAt: invoice.viewedAt };
};


const submitApprovalComment = async (milestoneId, projectId, workspaceId, comment) => {
  const milestone = await Milestone.findOne({
    _id:       milestoneId,
    project:   projectId,
    workspace: workspaceId,
  });

  if (!milestone) throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');

  milestone.clientNote = comment;
  await milestone.save();

  logger.info({ milestoneId, projectId }, 'Approval comment submitted');
  return { message: 'Comment submitted', clientNote: milestone.clientNote };
};

module.exports = {
  generatePortalAccess,
  revokePortalAccess,
  validatePortalToken,
  getPortalView,
  markInvoiceViewed,
  submitApprovalComment,
};
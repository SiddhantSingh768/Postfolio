const Deliverable = require('../models/deliverable.model');
const Milestone   = require('../models/milestone.model');
const Project     = require('../models/project.model');
const AppError    = require('../utils/AppError');
const logger      = require('../config/logger');
const archiver    = require('archiver');
const { buildWorkspaceQuery } = require('../utils/queryHelpers');
const { deleteFile, generateSignedUrl, fetchFileBuffer } = require('./storage.service');

// ─── Get upload signature ─────────────────────────────────────────────────────
//
// Called BEFORE the actual upload happens.
// Validates that the milestone exists and belongs to the workspace,
// then returns signed parameters the frontend uses for the Cloudinary upload.

const getUploadSignature = async (milestoneId, workspaceId) => {
  const milestone = await Milestone.findOne(
    buildWorkspaceQuery({ _id: milestoneId }, workspaceId)
  ).populate('project');

  if (!milestone) {
    throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');
  }

  // Cannot upload to a completed or cancelled project
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: milestone.project }, workspaceId)
  );

  if (['completed', 'cancelled'].includes(project?.status)) {
    throw new AppError(
      409,
      'PROJECT_NOT_EDITABLE',
      `Cannot upload deliverables to a ${project.status} project`
    );
  }

  const { generateSignedUploadParams } = require('./storage.service');

  return generateSignedUploadParams(
    workspaceId.toString(),
    milestone.project._id?.toString() || milestone.project.toString(),
    milestoneId.toString()
  );
};

// ─── Create deliverable record after upload ───────────────────────────────────
//
// Called AFTER the frontend has uploaded the file to Cloudinary.
// The frontend sends back the Cloudinary response fields.
// This creates the DB record and handles versioning.

const createDeliverable = async (milestoneId, workspaceId, userId, data) => {
  // Validate milestone belongs to workspace
  const milestone = await Milestone.findOne(
    buildWorkspaceQuery({ _id: milestoneId }, workspaceId)
  );
  if (!milestone) {
    throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');
  }

  // Validate project is editable
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: milestone.project }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  if (['completed', 'cancelled'].includes(project.status)) {
    throw new AppError(409, 'PROJECT_NOT_EDITABLE',
      `Cannot add deliverables to a ${project.status} project`
    );
  }

  // Validate MIME type
  const allowedTypes = Deliverable.getAllowedMimeTypes();
  if (data.mimeType && !allowedTypes.includes(data.mimeType)) {
    throw new AppError(400, 'INVALID_FILE_TYPE',
      `File type not allowed. Allowed types: pdf, png, jpg, zip, docx, mp4`
    );
  }

  // Validate file size (100MB)
  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 104857600;
  if (data.fileSize && data.fileSize > maxSize) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'File exceeds the 100MB limit');
  }

  // ─── Versioning logic ───────────────────────────────────────────────────────
  //
  // Find existing current deliverables for this milestone with the same filename.
  // If found, supersede them (isCurrent: false) and increment version number.
  // If not found, this is version 1.
  //
  // Why match on filename?
  //   A milestone can have multiple different files (design.pdf, spec.docx).
  //   We version each file independently.
  //   Uploading design_v2.pdf doesn't supersede spec.docx.

  const existingCurrent = await Deliverable.findOne({
    milestone: milestoneId,
    workspace: workspaceId,
    filename:  data.filename,
    isCurrent: true,
  });

  let version = 1;

  if (existingCurrent) {
    // Supersede the current version
    // We use findByIdAndUpdate not .save() to avoid triggering
    // any pre-save hooks that might interfere
    await Deliverable.findByIdAndUpdate(
      existingCurrent._id,
      { $set: { isCurrent: false } }
    );
    version = existingCurrent.version + 1;
    logger.info(
      { milestoneId, filename: data.filename, oldVersion: existingCurrent.version, newVersion: version },
      'Deliverable versioned'
    );
  }

  // Create the new deliverable record
  const deliverable = await Deliverable.create({
    workspace:       workspaceId,
    project:         milestone.project,
    milestone:       milestoneId,
    filename:        data.filename,
    publicId:        data.publicId,   // From Cloudinary response
    fileUrl:         data.fileUrl,    // From Cloudinary response
    fileSize:        data.fileSize    || null,
    mimeType:        data.mimeType    || null,
    version,
    isCurrent:       true,
    changeNotes:     data.changeNotes || null,
    isClientVisible: data.isClientVisible !== undefined ? data.isClientVisible : true,
    uploadedBy:      userId,
  });

  // Add to milestone's deliverables array (only current versions are tracked here)
  await Milestone.findByIdAndUpdate(milestoneId, {
    $addToSet: { deliverables: deliverable._id }
  });

  logger.info({ deliverableId: deliverable._id, milestoneId, version }, 'Deliverable created');
  return deliverable;
};

// ─── List deliverables for a milestone ───────────────────────────────────────

const listDeliverables = async (milestoneId, workspaceId, opts = {}) => {
  const filter = buildWorkspaceQuery(
    { milestone: milestoneId },
    workspaceId
  );

  // By default, only return current versions.
  // Pass showAll: true to get the full version history.
  if (!opts.showAll) {
    filter.isCurrent = true;
  }

  // In the client portal, only show client-visible files
  if (opts.clientPortal) {
    filter.isClientVisible = true;
    filter.isCurrent       = true;
  }

  const deliverables = await Deliverable.find(filter)
    .sort({ filename: 1, version: -1 })
    .populate('uploadedBy', 'name')
    .lean();

  // Generate fresh signed URLs for each deliverable
  // Signed URLs expire — never store them in the DB
  return deliverables.map(d => ({
    ...d,
    signedUrl: generateSignedUrl(d.publicId),
  }));
};

// ─── Get version history for a specific file ──────────────────────────────────

const getVersionHistory = async (milestoneId, workspaceId, filename) => {
  const deliverables = await Deliverable.find(
    buildWorkspaceQuery({ milestone: milestoneId, filename }, workspaceId)
  )
  .sort({ version: -1 }) // Newest first
  .populate('uploadedBy', 'name')
  .lean();

  return deliverables.map(d => ({
    ...d,
    signedUrl: generateSignedUrl(d.publicId),
  }));
};

// ─── Update deliverable metadata ──────────────────────────────────────────────

const updateDeliverable = async (deliverableId, workspaceId, updates) => {
  // Only allow updating metadata fields — never fileUrl or publicId
  const allowed = ['isClientVisible', 'changeNotes'];
  const sanitised = {};
  allowed.forEach(f => {
    if (updates[f] !== undefined) sanitised[f] = updates[f];
  });

  const deliverable = await Deliverable.findOneAndUpdate(
    buildWorkspaceQuery({ _id: deliverableId }, workspaceId),
    { $set: sanitised },
    { new: true }
  );

  if (!deliverable) throw new AppError(404, 'DELIVERABLE_NOT_FOUND', 'Deliverable not found');

  logger.info({ deliverableId, workspaceId }, 'Deliverable updated');
  return deliverable;
};

// ─── Delete deliverable ───────────────────────────────────────────────────────
//
// Deletes a specific version of a deliverable.
// If the deleted version was current, the previous version (if any)
// is restored as current.

const deleteDeliverable = async (deliverableId, workspaceId) => {
  const deliverable = await Deliverable.findOne(
    buildWorkspaceQuery({ _id: deliverableId }, workspaceId)
  );
  if (!deliverable) throw new AppError(404, 'DELIVERABLE_NOT_FOUND', 'Deliverable not found');

  // If deleting the current version, restore the previous version
  if (deliverable.isCurrent && deliverable.version > 1) {
    const previousVersion = await Deliverable.findOneAndUpdate(
      {
        milestone: deliverable.milestone,
        workspace: workspaceId,
        filename:  deliverable.filename,
        version:   deliverable.version - 1,
      },
      { $set: { isCurrent: true } },
      { new: true }
    );

    if (previousVersion) {
      // Add the restored version to milestone's deliverables array
      await Milestone.findByIdAndUpdate(deliverable.milestone, {
        $addToSet: { deliverables: previousVersion._id }
      });
    }
  }

  // Remove from milestone's deliverables array
  await Milestone.findByIdAndUpdate(deliverable.milestone, {
    $pull: { deliverables: deliverableId }
  });

  // Delete from Cloudinary
  await deleteFile(deliverable.publicId);

  // Delete from DB
  await Deliverable.findByIdAndDelete(deliverableId);

  logger.info({ deliverableId, workspaceId }, 'Deliverable deleted');
  return { message: 'Deliverable deleted' };
};

// ─── Bulk ZIP download ────────────────────────────────────────────────────────
//
// Streams all current-version deliverables for a project as a ZIP file.
// The ZIP is never fully built in memory — it streams directly to the response.
// This means the client starts receiving data immediately, even for large files.
//
// Usage: pass the Express `res` object directly — this function writes to it.

const streamProjectZip = async (projectId, workspaceId, res) => {
  // Verify project belongs to workspace
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  // Find all current, client-visible deliverables for this project
  const deliverables = await Deliverable.find({
    project:   projectId,
    workspace: workspaceId,
    isCurrent: true,
  }).lean();

  if (deliverables.length === 0) {
    throw new AppError(404, 'NO_DELIVERABLES', 'No deliverables found for this project');
  }

  // Set response headers for ZIP download
  const zipFilename = `${project.title.replace(/[^a-z0-9]/gi, '_')}_deliverables.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  // Create archiver instance — 'zip' format, level 0 = no compression
  // Level 0 is faster for already-compressed files (PDFs, images, videos)
  const archive = archiver('zip', { zlib: { level: 0 } });

  // Pipe archive output directly to the HTTP response
  archive.pipe(res);

  // Handle archiver errors
  archive.on('error', (err) => {
    logger.error({ err, projectId }, 'ZIP streaming error');
    // Can't send error response after headers are sent — just end the pipe
    res.end();
  });

  // Fetch and append each file
  for (const deliverable of deliverables) {
    try {
      const resourceType = deliverable.mimeType?.startsWith('video/') ? 'video' : 'raw';
      const buffer = await fetchFileBuffer(deliverable.publicId, resourceType);

      // Add buffer to ZIP with the original filename
      // If two files have the same name, archiver handles it automatically
      archive.append(buffer, { name: deliverable.filename });

      logger.info({ deliverableId: deliverable._id }, 'Added to ZIP');
    } catch (err) {
      // Skip files that fail to fetch — don't abort the entire ZIP
      logger.warn({ err: err.message, deliverableId: deliverable._id }, 'Skipped file in ZIP');
    }
  }

  // Finalise — flushes remaining data and closes the ZIP stream
  await archive.finalize();

  logger.info({ projectId, fileCount: deliverables.length }, 'ZIP download complete');
};

module.exports = {
  getUploadSignature,
  createDeliverable,
  listDeliverables,
  getVersionHistory,
  updateDeliverable,
  deleteDeliverable,
  streamProjectZip,
};
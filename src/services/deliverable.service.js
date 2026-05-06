const Deliverable = require('../models/deliverable.model');
const Milestone   = require('../models/milestone.model');
const Project     = require('../models/project.model');
const AppError    = require('../utils/AppError');
const logger      = require('../config/logger');
const archiver    = require('archiver');
const { buildWorkspaceQuery } = require('../utils/queryHelpers');
const { deleteFile, generateSignedUrl, fetchFileBuffer } = require('./storage.service');


const getUploadSignature = async (milestoneId, workspaceId) => {
  const milestone = await Milestone.findOne(
    buildWorkspaceQuery({ _id: milestoneId }, workspaceId)
  ).populate('project');

  if (!milestone) {
    throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');
  }

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


const createDeliverable = async (milestoneId, workspaceId, userId, data) => {
  const milestone = await Milestone.findOne(
    buildWorkspaceQuery({ _id: milestoneId }, workspaceId)
  );
  if (!milestone) {
    throw new AppError(404, 'MILESTONE_NOT_FOUND', 'Milestone not found');
  }

  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: milestone.project }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
  if (['completed', 'cancelled'].includes(project.status)) {
    throw new AppError(409, 'PROJECT_NOT_EDITABLE',
      `Cannot add deliverables to a ${project.status} project`
    );
  }

  const allowedTypes = Deliverable.getAllowedMimeTypes();
  if (data.mimeType && !allowedTypes.includes(data.mimeType)) {
    throw new AppError(400, 'INVALID_FILE_TYPE',
      `File type not allowed. Allowed types: pdf, png, jpg, zip, docx, mp4`
    );
  }

  const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 104857600;
  if (data.fileSize && data.fileSize > maxSize) {
    throw new AppError(400, 'FILE_TOO_LARGE', 'File exceeds the 100MB limit');
  }


  const existingCurrent = await Deliverable.findOne({
    milestone: milestoneId,
    workspace: workspaceId,
    filename:  data.filename,
    isCurrent: true,
  });

  let version = 1;

  if (existingCurrent) {
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

  await Milestone.findByIdAndUpdate(milestoneId, {
    $addToSet: { deliverables: deliverable._id }
  });

  logger.info({ deliverableId: deliverable._id, milestoneId, version }, 'Deliverable created');
  return deliverable;
};


const listDeliverables = async (milestoneId, workspaceId, opts = {}) => {
  const filter = buildWorkspaceQuery(
    { milestone: milestoneId },
    workspaceId
  );

  if (!opts.showAll) {
    filter.isCurrent = true;
  }

  if (opts.clientPortal) {
    filter.isClientVisible = true;
    filter.isCurrent       = true;
  }

  const deliverables = await Deliverable.find(filter)
    .sort({ filename: 1, version: -1 })
    .populate('uploadedBy', 'name')
    .lean();

  return deliverables.map(d => ({
    ...d,
    signedUrl: generateSignedUrl(d.publicId),
  }));
};


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


const updateDeliverable = async (deliverableId, workspaceId, updates) => {
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


const deleteDeliverable = async (deliverableId, workspaceId) => {
  const deliverable = await Deliverable.findOne(
    buildWorkspaceQuery({ _id: deliverableId }, workspaceId)
  );
  if (!deliverable) throw new AppError(404, 'DELIVERABLE_NOT_FOUND', 'Deliverable not found');

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
      await Milestone.findByIdAndUpdate(deliverable.milestone, {
        $addToSet: { deliverables: previousVersion._id }
      });
    }
  }

  await Milestone.findByIdAndUpdate(deliverable.milestone, {
    $pull: { deliverables: deliverableId }
  });

  await deleteFile(deliverable.publicId);

  await Deliverable.findByIdAndDelete(deliverableId);

  logger.info({ deliverableId, workspaceId }, 'Deliverable deleted');
  return { message: 'Deliverable deleted' };
};


const streamProjectZip = async (projectId, workspaceId, res) => {
  const project = await Project.findOne(
    buildWorkspaceQuery({ _id: projectId, isDeleted: false }, workspaceId)
  );
  if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

  const deliverables = await Deliverable.find({
    project:   projectId,
    workspace: workspaceId,
    isCurrent: true,
  }).lean();

  if (deliverables.length === 0) {
    throw new AppError(404, 'NO_DELIVERABLES', 'No deliverables found for this project');
  }

  const zipFilename = `${project.title.replace(/[^a-z0-9]/gi, '_')}_deliverables.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

  const archive = archiver('zip', { zlib: { level: 0 } });

  archive.pipe(res);

  archive.on('error', (err) => {
    logger.error({ err, projectId }, 'ZIP streaming error');
    res.end();
  });

  for (const deliverable of deliverables) {
    try {
      const resourceType = deliverable.mimeType?.startsWith('video/') ? 'video' : 'raw';
      const buffer = await fetchFileBuffer(deliverable.publicId, resourceType);

      archive.append(buffer, { name: deliverable.filename });

      logger.info({ deliverableId: deliverable._id }, 'Added to ZIP');
    } catch (err) {
      logger.warn({ err: err.message, deliverableId: deliverable._id }, 'Skipped file in ZIP');
    }
  }

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
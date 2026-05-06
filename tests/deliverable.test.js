const request   = require('supertest');
const app       = require('../app');
const Milestone = require('../src/models/milestone.model');
const Project   = require('../src/models/project.model');
const Client    = require('../src/models/client.model');
const Deliverable = require('../src/models/deliverable.model');
const { createVerifiedUser } = require('./helpers');

// Mock the storage service so ZIP tests don't make real Cloudinary calls
jest.mock('../src/services/storage.service', () => ({
  // Keep the real implementations of everything except fetchFileBuffer
  ...jest.requireActual('../src/services/storage.service'),

  generateSignedUploadParams: jest.fn(() => ({
    signature:    'test_signature',
    timestamp:    Math.round(Date.now() / 1000),
    folder:       'postfolio/test',
    apiKey:       'test_key',
    cloudName:    'test_cloud',
    uploadPreset: 'test_preset',
  })),

  generateSignedUrl: jest.fn((publicId) =>
    `https://res.cloudinary.com/test/image/upload/${publicId}`
  ),

  // Return a minimal valid PDF buffer for ZIP tests
  // Real Cloudinary fetch is not needed in tests
  fetchFileBuffer: jest.fn(async () => {
    // Minimal PDF magic bytes — enough for the ZIP to contain a real file entry
    return Buffer.from('%PDF-1.4 test content');
  }),

  deleteFile: jest.fn(async () => {}), // No-op in tests
}));

// ─── Test helpers ─────────────────────────────────────────────────────────────

const createTestProject = async (token, workspaceId) => {
  const client = await Client.create({
    workspace: workspaceId,
    name:      'Test Client',
    email:     'testclient@example.com',
  });

  const project = await Project.create({
    workspace: workspaceId,
    client:    client._id,
    title:     'Test Project',
    status:    'active',
  });

  const milestone = await Milestone.create({
    workspace: workspaceId,
    project:   project._id,
    title:     'Test Milestone',
    status:    'in_progress',
    order:     1,
  });

  return { client, project, milestone };
};

// Simulate what the frontend sends after a Cloudinary upload
const fakeCloudinaryResponse = (filename = 'design.pdf', version = 1) => ({
  filename,
  publicId:  `postfolio/test/${filename.replace('.', '_')}_v${version}`,
  fileUrl:   `https://res.cloudinary.com/demo/image/upload/${filename}`,
  fileSize:  102400, // 100KB
  mimeType:  'application/pdf',
  changeNotes: version > 1 ? `Updated version ${version}` : null,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Deliverable — upload signature', () => {
  let token, workspaceId, milestone;

  beforeEach(async () => {
    const u = await createVerifiedUser('deliver@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
    const data  = await createTestProject(token, workspaceId);
    milestone   = data.milestone;
  });

  it('returns signed upload params for a valid milestone', async () => {
    const res = await request(app)
      .get(`/api/v1/milestones/${milestone._id}/deliverables/sign`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('signature');
    expect(res.body.data).toHaveProperty('timestamp');
    expect(res.body.data).toHaveProperty('apiKey');
    expect(res.body.data).toHaveProperty('cloudName');
  });

  it('returns 404 for a milestone in a different workspace', async () => {
    const otherUser = await createVerifiedUser('other@test.com');
    const res = await request(app)
      .get(`/api/v1/milestones/${milestone._id}/deliverables/sign`)
      .set('Authorization', `Bearer ${otherUser.token}`);
    expect(res.status).toBe(404);
  });
});

describe('Deliverable — create and versioning', () => {
  let token, workspaceId, milestone;

  beforeEach(async () => {
    const u = await createVerifiedUser('version@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
    const data  = await createTestProject(token, workspaceId);
    milestone   = data.milestone;
  });

  it('creates a deliverable at version 1', async () => {
    const res = await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('design.pdf', 1));

    expect(res.status).toBe(201);
    expect(res.body.data.deliverable.version).toBe(1);
    expect(res.body.data.deliverable.isCurrent).toBe(true);
    expect(res.body.data.deliverable.filename).toBe('design.pdf');
  });

  it('creates version 2 and marks version 1 as not current', async () => {
    // Upload version 1
    await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('design.pdf', 1));

    // Upload version 2 (same filename)
    const res = await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('design.pdf', 2));

    expect(res.status).toBe(201);
    expect(res.body.data.deliverable.version).toBe(2);
    expect(res.body.data.deliverable.isCurrent).toBe(true);

    // Verify version 1 is now not current in the database
    const v1 = await Deliverable.findOne({
      milestone: milestone._id,
      filename:  'design.pdf',
      version:   1,
    });
    expect(v1.isCurrent).toBe(false);
  });

  it('treats different filenames as independent files (no version conflict)', async () => {
    await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('design.pdf', 1));

    // Different filename — should be version 1, not version 2
    const res = await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('spec.docx', 1));

    expect(res.status).toBe(201);
    expect(res.body.data.deliverable.version).toBe(1);

    // Both should be current — they are different files
    const all = await Deliverable.find({ milestone: milestone._id, isCurrent: true });
    expect(all.length).toBe(2);
  });

  it('rejects file size over 100MB', async () => {
    const res = await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...fakeCloudinaryResponse('big.pdf'), fileSize: 200 * 1024 * 1024 });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects invalid MIME type', async () => {
    const res = await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...fakeCloudinaryResponse('virus.exe'), mimeType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE_TYPE');
  });
});

describe('Deliverable — list and visibility', () => {
  let token, workspaceId, milestone;

  beforeEach(async () => {
    const u = await createVerifiedUser('list@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
    const data  = await createTestProject(token, workspaceId);
    milestone   = data.milestone;

    // Upload v1 and v2 of design.pdf
    await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('design.pdf', 1));

    await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('design.pdf', 2));
  });

  it('lists only current versions by default', async () => {
    const res = await request(app)
      .get(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deliverables.length).toBe(1);
    expect(res.body.data.deliverables[0].version).toBe(2);
    expect(res.body.data.deliverables[0].isCurrent).toBe(true);
  });

  it('lists all versions when showAll=true', async () => {
    const res = await request(app)
      .get(`/api/v1/milestones/${milestone._id}/deliverables?showAll=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.deliverables.length).toBe(2);
  });

  it('returns version history for a specific filename', async () => {
    const res = await request(app)
      .get(`/api/v1/milestones/${milestone._id}/deliverables/history?filename=design.pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.history.length).toBe(2);
    // Newest first
    expect(res.body.data.history[0].version).toBe(2);
    expect(res.body.data.history[1].version).toBe(1);
  });
});

describe('Deliverable — update and delete', () => {
  let token, workspaceId, milestone, deliverableId;

  beforeEach(async () => {
    const u = await createVerifiedUser('update@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
    const data  = await createTestProject(token, workspaceId);
    milestone   = data.milestone;

    const upload = await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('test.pdf'));
    deliverableId = upload.body.data.deliverable._id;
  });

  it('updates visibility flag', async () => {
    const res = await request(app)
      .patch(`/api/v1/${deliverableId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isClientVisible: false });

    expect(res.status).toBe(200);
    expect(res.body.data.deliverable.isClientVisible).toBe(false);
  });

  it('deletes a deliverable', async () => {
    const res = await request(app)
      .delete(`/api/v1/${deliverableId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify it's gone from DB
    const gone = await Deliverable.findById(deliverableId);
    expect(gone).toBeNull();
  });

  it('restores v1 as current when v2 is deleted', async () => {
    // Upload v2
    const v2 = await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send(fakeCloudinaryResponse('test.pdf', 2));

    const v2Id = v2.body.data.deliverable._id;

    // Delete v2
    await request(app)
      .delete(`/api/v1/${v2Id}`)
      .set('Authorization', `Bearer ${token}`);

    // v1 should now be current
    const v1 = await Deliverable.findById(deliverableId);
    expect(v1.isCurrent).toBe(true);
  });
});

describe('Deliverable — workspace isolation', () => {
  it('cannot access deliverables from another workspace', async () => {
    const userA = await createVerifiedUser('a@deliver.com');
    const userB = await createVerifiedUser('b@deliver.com');

    const dataA = await createTestProject(userA.token, userA.workspaceId);

    const upload = await request(app)
      .post(`/api/v1/milestones/${dataA.milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send(fakeCloudinaryResponse('secret.pdf'));

    const deliverableId = upload.body.data.deliverable._id;

    // User B tries to update user A's deliverable
    const res = await request(app)
      .patch(`/api/v1/${deliverableId}`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ isClientVisible: false });

    expect(res.status).toBe(404);
  });
});

describe('Deliverable — ZIP download', () => {
  let token, workspaceId, projectId, milestone;

  beforeEach(async () => {
    const u = await createVerifiedUser('zip@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
    const data  = await createTestProject(token, workspaceId);
    projectId   = data.project._id.toString();
    milestone   = data.milestone;
  });

  it('returns 404 NO_DELIVERABLES for a project with no files', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/deliverables/zip`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NO_DELIVERABLES');
  });

  it('streams a ZIP file when deliverables exist', async () => {
    // Upload a deliverable first
    await request(app)
      .post(`/api/v1/milestones/${milestone._id}/deliverables`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        filename:  'report.pdf',
        publicId:  'postfolio/test/report_pdf',
        fileUrl:   'https://res.cloudinary.com/demo/image/upload/report.pdf',
        fileSize:  51200,
        mimeType:  'application/pdf',
      });

    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/deliverables/zip`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)          // Tell supertest to buffer the binary response
      .parse((response, callback) => {
        // Custom parser for binary ZIP data
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end',  ()    => callback(null, Buffer.concat(chunks)));
      });

    // ZIP files always start with the magic bytes PK (0x50 0x4B)
    // This confirms the response is actually a ZIP stream
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain('.zip');

    // Check ZIP magic bytes in the response buffer
    // PK signature = bytes 50 4B 03 04
    expect(res.body[0]).toBe(0x50); // P
    expect(res.body[1]).toBe(0x4B); // K
  });
});
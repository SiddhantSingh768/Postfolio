const request   = require('supertest');
const mongoose  = require('mongoose');
const app       = require('../app');
const User      = require('../src/models/user.model');
const Workspace = require('../src/models/workspace.model');

const { createVerifiedUser } = require('./helpers');

const createClient = async (token) => {
  const res = await request(app)
    .post('/api/v1/clients')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Test Client', email: 'client@test.com' });
  return res.body.data.client;
};

// ─── State machine tests ──────────────────────────────────────────────────────

describe('Project state machine', () => {
  let token, client;

  beforeEach(async () => {
    const u = await createVerifiedUser();
    token  = u.token;
    client = await createClient(token);
  });

  const createProject = async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, title: 'Test Project' });
    return res.body.data.project;
  };

  it('creates project in draft status', async () => {
    const project = await createProject();
    expect(project.status).toBe('draft');
  });

  it('transitions draft → active', async () => {
    const project = await createProject();
    const res = await request(app)
      .patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.data.project.status).toBe('active');
  });

  it('rejects draft → completed (must go through active)', async () => {
    const project = await createProject();
    const res = await request(app)
      .patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('rejects cancelled → active', async () => {
    const project = await createProject();

    // draft → active → on_hold → cancelled
    await request(app).patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'active' });
    await request(app).patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'on_hold' });
    await request(app).patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'cancelled' });

    // Now try cancelled → active — must fail
    const res = await request(app)
      .patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('rejects deleting a non-draft project', async () => {
    const project = await createProject();

    await request(app).patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'active' });

    const res = await request(app)
      .delete(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PROJECT_NOT_DELETABLE');
  });

  it('allows soft-deleting a draft project', async () => {
    const project = await createProject();
    const res = await request(app)
      .delete(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('Project — milestone management', () => {
  let token, client, project;

  beforeEach(async () => {
    const u = await createVerifiedUser();
    token   = u.token;
    client  = await createClient(token);

    const res = await request(app)
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: client._id, title: 'Milestone Test Project' });
    project = res.body.data.project;
  });

  it('adds a milestone to a project', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${project._id}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Design phase', dueDate: '2026-05-01' });

    expect(res.status).toBe(201);
    expect(res.body.data.milestone.title).toBe('Design phase');
    expect(res.body.data.milestone.status).toBe('pending');
  });

  it('rejects adding milestone to completed project', async () => {
    // Transition to completed via active
    await request(app).patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'active' });
    await request(app).patch(`/api/v1/projects/${project._id}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'completed' });

    const res = await request(app)
      .post(`/api/v1/projects/${project._id}/milestones`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Late addition' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PROJECT_NOT_EDITABLE');
  });
});
const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../app');
const User     = require('../src/models/user.model');
const Workspace = require('../src/models/workspace.model');
const RefreshToken = require('../src/models/refreshToken.model');

// ─── Test helpers ─────────────────────────────────────────────────────────────

const { createVerifiedUser } = require('./helpers');

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Client — create', () => {
  let token, workspaceId;

  beforeEach(async () => {
    const result = await createVerifiedUser();
    token       = result.token;
    workspaceId = result.workspace._id;
  });

  it('creates a client and returns 201', async () => {
    const res = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme Corp', email: 'acme@example.com', company: 'Acme' });

    expect(res.status).toBe(201);
    expect(res.body.data.client.name).toBe('Acme Corp');
    expect(res.body.data.client.workspace).toBe(workspaceId.toString());
  });

  it('rejects duplicate active email with 409', async () => {
    await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Client A', email: 'dup@example.com' });

    const res = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Client B', email: 'dup@example.com' });

    expect(res.status).toBe(409);
  });

  it('allows re-adding an archived client email', async () => {
    // Create client
    const create = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Client', email: 'reuse@example.com' });

    // Archive client
    await request(app)
      .delete(`/api/v1/clients/${create.body.data.client._id}`)
      .set('Authorization', `Bearer ${token}`);

    // Re-add same email — should work because archived client is
    // excluded from the partial index
    const res = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Client', email: 'reuse@example.com' });

    expect(res.status).toBe(201);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/v1/clients')
      .send({ name: 'Test', email: 'test@example.com' });
    expect(res.status).toBe(401);
  });
});

describe('Client — workspace isolation', () => {
  it('cannot access another workspace\'s clients', async () => {
    const userA = await createVerifiedUser('a@test.com');
    const userB = await createVerifiedUser('b@test.com');

    // Create client in workspace A
    const create = await request(app)
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ name: 'A\'s Client', email: 'client@a.com' });

    const clientId = create.body.data.client._id;

    // Try to access it from workspace B
    const res = await request(app)
      .get(`/api/v1/clients/${clientId}`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(res.status).toBe(404); // Not found — workspace scope hides it
  });
});
const request = require('supertest');
const app     = require('../app');
const User    = require('../src/models/user.model');
const { createVerifiedUser } = require('./helpers');

// Mock invoice service to avoid $inc side effects in seeding
jest.mock('../src/services/invoice.service', () => ({
  ...jest.requireActual('../src/services/invoice.service'),
  generateInvoiceNumber: jest.fn(async () => 'INV-DEMO-001'),
}));

describe('Onboarding — status', () => {
  let token, userId;

  beforeEach(async () => {
    const u = await createVerifiedUser('onboard@test.com');
    token  = u.token;
    userId = u.user._id;
  });

  it('returns initial onboarding status for new user', async () => {
    const res = await request(app)
      .get('/api/v1/onboarding/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { steps, completedCount, isDismissed } = res.body.data;

    expect(steps).toHaveLength(3);
    expect(completedCount).toBe(0);
    expect(isDismissed).toBe(false);

    // All steps should be incomplete
    steps.forEach(step => {
      expect(step.completed).toBe(false);
    });
  });

  it('dismisses onboarding checklist', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/dismiss')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify dismissed in DB
    const user = await User.findById(userId);
    expect(user.onboarding.isDismissed).toBe(true);
  });

  it('status shows dismissed after dismiss', async () => {
    await request(app)
      .post('/api/v1/onboarding/dismiss')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/v1/onboarding/status')
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.data.isDismissed).toBe(true);
  });
});

describe('Onboarding — demo seed', () => {
  let token, workspaceId;

  beforeEach(async () => {
    const u = await createVerifiedUser('seed@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
  });

  it('seeds demo data and returns summary', async () => {
    const res = await request(app)
      .post('/api/v1/onboarding/seed')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(201);
    const { data } = res.body.data;

    expect(data.client.name).toBe('Acme Technologies (Demo)');
    expect(data.milestones).toBe(3);
    expect(data.invoice.number).toBe('INV-DEMO-001');
  });

  it('rejects seeding twice', async () => {
    await request(app)
      .post('/api/v1/onboarding/seed')
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/v1/onboarding/seed')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DEMO_ALREADY_SEEDED');
  });
});
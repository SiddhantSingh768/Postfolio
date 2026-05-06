const request  = require('supertest');
const app      = require('../app');
const Invoice  = require('../src/models/invoice.model');
const Client   = require('../src/models/client.model');
const Project  = require('../src/models/project.model');
const { createVerifiedUser } = require('./helpers');

// Mock cache so tests don't depend on Redis
jest.mock('../src/services/cache.service', () => ({
  get:        jest.fn(async () => null),   // Always cache miss in tests
  set:        jest.fn(async () => true),
  del:        jest.fn(async () => true),
  delPattern: jest.fn(async () => true),
  keys: {
    dashboard: (id) => `dashboard:${id}`,
    revenue:   (id, m) => `revenue:${id}:${m}`,
  }
}));

const createTestData = async (workspaceId, clientId) => {
  const project = await Project.create({
    workspace: workspaceId,
    client:    clientId,
    title:     'Analytics Test Project',
    status:    'active',
  });

  // Create mix of paid and unpaid invoices
  await Invoice.create([
    {
      workspace:     workspaceId,
      client:        clientId,
      project:       project._id,
      invoiceNumber: 'INV-A001',
      status:        'paid',
      dueDate:       new Date('2026-06-30'),
      paidAt:        new Date(),
      paidAmount:    11800,
      lineItems:     [{ description: 'A', qty: 1, unitPrice: 10000, gstRate: 18, amount: 10000 }],
      subtotal:      10000,
      totalGst:      1800,
      grandTotal:    11800,
    },
    {
      workspace:     workspaceId,
      client:        clientId,
      project:       project._id,
      invoiceNumber: 'INV-A002',
      status:        'sent',
      dueDate:       new Date('2026-07-31'),
      lineItems:     [{ description: 'B', qty: 1, unitPrice: 5000, gstRate: 18, amount: 5000 }],
      subtotal:      5000,
      totalGst:      900,
      grandTotal:    5900,
    },
    {
      workspace:     workspaceId,
      client:        clientId,
      project:       project._id,
      invoiceNumber: 'INV-A003',
      status:        'draft',
      dueDate:       new Date('2026-08-31'),
      lineItems:     [{ description: 'C', qty: 1, unitPrice: 3000, gstRate: 18, amount: 3000 }],
      subtotal:      3000,
      totalGst:      540,
      grandTotal:    3540,
    },
  ]);

  return project;
};

describe('Analytics — dashboard stats', () => {
  let token, workspaceId, clientId;

  beforeEach(async () => {
    const u  = await createVerifiedUser('analytics@test.com');
    token      = u.token;
    workspaceId = u.workspaceId;

    const client = await Client.create({
      workspace: workspaceId,
      name:      'Analytics Client',
      email:     'analytics@client.com',
    });
    clientId = client._id;

    await createTestData(workspaceId, clientId);
  });

  it('returns dashboard stats with correct revenue', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { revenue, projects, invoiceBreakdown } = res.body.data;

    // Only paid invoices count as revenue
    expect(revenue.allTime.total).toBe(11800);
    expect(revenue.allTime.count).toBe(1);

    // Outstanding = sent invoices
    expect(revenue.outstanding.total).toBe(5900);
    expect(revenue.outstanding.count).toBe(1);
  });

  it('returns invoice breakdown by status', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { invoiceBreakdown } = res.body.data;

    const statuses = invoiceBreakdown.map(i => i.status);
    expect(statuses).toContain('paid');
    expect(statuses).toContain('sent');
    expect(statuses).toContain('draft');
  });

  it('returns project stats', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.projects.active).toBe(1);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/dashboard');
    expect(res.status).toBe(401);
  });
});

describe('Analytics — monthly revenue trend', () => {
  let token, workspaceId;

  beforeEach(async () => {
    const u = await createVerifiedUser('revenue@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
  });

  it('returns 12 months of data by default', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(12);
  });

  it('returns correct number of months when specified', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?months=6')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(6);
  });

  it('caps months at 24', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?months=99')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data.length).toBeLessThanOrEqual(24);
  });

  it('fills missing months with 0 revenue', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/revenue?months=12')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // All months should have revenue field (0 if no invoices)
    res.body.data.data.forEach(month => {
      expect(month).toHaveProperty('revenue');
      expect(month).toHaveProperty('label');
      expect(typeof month.revenue).toBe('number');
    });
  });
});
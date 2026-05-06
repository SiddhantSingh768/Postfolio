const request  = require('supertest');
const app      = require('../app');
const Invoice  = require('../src/models/invoice.model');
const Client   = require('../src/models/client.model');
const Project  = require('../src/models/project.model');
const User     = require('../src/models/user.model');
const { createVerifiedUser } = require('./helpers');

// Mock PDF generation — Puppeteer should not run during tests
jest.mock('../src/services/pdf.service', () => ({
  generateAndUploadPDF: jest.fn(async () => ({
    publicId:  'postfolio/test/invoice_INV-0001',
    secureUrl: 'https://res.cloudinary.com/test/raw/upload/invoice.pdf',
  }))
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createTestClient = async (workspaceId) =>
  Client.create({
    workspace: workspaceId,
    name:      'Invoice Test Client',
    email:     'invoiceclient@test.com',
  });

const validLineItems = [
  { description: 'UI Design',      qty: 1,  unitPrice: 25000, gstRate: 18 },
  { description: 'Development',    qty: 40, unitPrice: 1500,  gstRate: 18 },
  { description: 'Hosting setup',  qty: 1,  unitPrice: 5000,  gstRate: 18 },
];

// ─── GST computation tests ────────────────────────────────────────────────────

describe('Invoice — GST pre-save hook', () => {
  let token, workspaceId, clientId;

  beforeEach(async () => {
    const u   = await createVerifiedUser('gst@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
    const c   = await createTestClient(workspaceId);
    clientId  = c._id;
  });

  it('computes correct totals for 18% GST', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-06-30',
        lineItems: [
          { description: 'Design', qty: 1, unitPrice: 10000, gstRate: 18 }
        ]
      });

    expect(res.status).toBe(201);
    const { invoice } = res.body.data;

    // qty(1) * unitPrice(10000) = 10000 subtotal
    expect(invoice.subtotal).toBe(10000);
    // 10000 * 18% = 1800 GST
    expect(invoice.totalGst).toBe(1800);
    // 10000 + 1800 = 11800 grandTotal
    expect(invoice.grandTotal).toBe(11800);
  });

  it('computes correct totals for 0% GST', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-06-30',
        lineItems: [
          { description: 'Export service', qty: 2, unitPrice: 5000, gstRate: 0 }
        ]
      });

    expect(res.status).toBe(201);
    const { invoice } = res.body.data;

    expect(invoice.subtotal).toBe(10000);
    expect(invoice.totalGst).toBe(0);
    expect(invoice.grandTotal).toBe(10000);
  });

  it('computes mixed GST rates correctly', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-06-30',
        lineItems: [
          { description: 'Software', qty: 1, unitPrice: 10000, gstRate: 18 },
          { description: 'Hardware', qty: 1, unitPrice: 5000,  gstRate: 28 },
        ]
      });

    expect(res.status).toBe(201);
    const { invoice } = res.body.data;

    // subtotal: 10000 + 5000 = 15000
    expect(invoice.subtotal).toBe(15000);
    // GST: (10000 * 18%) + (5000 * 28%) = 1800 + 1400 = 3200
    expect(invoice.totalGst).toBe(3200);
    // grandTotal: 15000 + 3200 = 18200
    expect(invoice.grandTotal).toBe(18200);
  });

  it('recomputes totals when line items are updated', async () => {
    // Create invoice
    const createRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-06-30',
        lineItems: [{ description: 'A', qty: 1, unitPrice: 1000, gstRate: 18 }]
      });

    const invoiceId = createRes.body.data.invoice._id;

    // Update with different line items
    const updateRes = await request(app)
      .patch(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        lineItems: [{ description: 'B', qty: 2, unitPrice: 5000, gstRate: 5 }]
      });

    expect(updateRes.status).toBe(200);
    const { invoice } = updateRes.body.data;

    // qty(2) * unitPrice(5000) = 10000
    expect(invoice.subtotal).toBe(10000);
    // 10000 * 5% = 500
    expect(invoice.totalGst).toBe(500);
    // 10000 + 500 = 10500
    expect(invoice.grandTotal).toBe(10500);
  });
});

// ─── Edit lock tests ──────────────────────────────────────────────────────────

describe('Invoice — edit lock', () => {
  let token, workspaceId, clientId;

  beforeEach(async () => {
    const u  = await createVerifiedUser('editlock@test.com');
    token      = u.token;
    workspaceId = u.workspaceId;
    const c  = await createTestClient(workspaceId);
    clientId = c._id;
  });

  const createDraftInvoice = async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-06-30',
        lineItems: [{ description: 'Test', qty: 1, unitPrice: 1000, gstRate: 18 }]
      });
    return res.body.data.invoice;
  };

  it('allows editing a draft invoice', async () => {
    const invoice = await createDraftInvoice();

    const res = await request(app)
      .patch(`/api/v1/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Updated notes' });

    expect(res.status).toBe(200);
  });

  it('blocks editing a sent invoice with 409 INVOICE_NOT_EDITABLE', async () => {
    const invoice = await createDraftInvoice();

    // Manually set status to sent in DB
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'sent' });

    const res = await request(app)
      .patch(`/api/v1/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Try to edit' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_NOT_EDITABLE');
  });

  it('blocks editing a paid invoice', async () => {
    const invoice = await createDraftInvoice();
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'paid' });

    const res = await request(app)
      .patch(`/api/v1/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Try to edit paid' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_NOT_EDITABLE');
  });

  it('blocks editing a cancelled invoice', async () => {
    const invoice = await createDraftInvoice();
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'cancelled' });

    const res = await request(app)
      .patch(`/api/v1/invoices/${invoice._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Try to edit cancelled' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_NOT_EDITABLE');
  });

  it('allows cancelling a sent invoice', async () => {
    const invoice = await createDraftInvoice();
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'sent' });

    const res = await request(app)
      .post(`/api/v1/invoices/${invoice._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.status).toBe('cancelled');
  });

  it('blocks cancelling a paid invoice', async () => {
    const invoice = await createDraftInvoice();
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'paid' });

    const res = await request(app)
      .post(`/api/v1/invoices/${invoice._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_ALREADY_PAID');
  });
});

// ─── Invoice number race condition test ───────────────────────────────────────

describe('Invoice — atomic number generation', () => {
  let token, workspaceId, clientId;

  beforeEach(async () => {
    const u  = await createVerifiedUser('atomic@test.com');
    token      = u.token;
    workspaceId = u.workspaceId;
    const c  = await createTestClient(workspaceId);
    clientId = c._id;
  });

  it('generates unique invoice numbers under concurrent requests', async () => {
    const payload = {
      clientId,
      dueDate:   '2026-06-30',
      lineItems: [{ description: 'Test', qty: 1, unitPrice: 1000, gstRate: 18 }]
    };

    // Fire 5 concurrent requests
    const results = await Promise.all([
      request(app).post('/api/v1/invoices').set('Authorization', `Bearer ${token}`).send(payload),
      request(app).post('/api/v1/invoices').set('Authorization', `Bearer ${token}`).send(payload),
      request(app).post('/api/v1/invoices').set('Authorization', `Bearer ${token}`).send(payload),
      request(app).post('/api/v1/invoices').set('Authorization', `Bearer ${token}`).send(payload),
      request(app).post('/api/v1/invoices').set('Authorization', `Bearer ${token}`).send(payload),
    ]);

    // All should succeed
    results.forEach(r => expect(r.status).toBe(201));

    // Extract invoice numbers
    const numbers = results.map(r => r.body.data.invoice.invoiceNumber);

    // All numbers must be unique — Set size equals array length
    const unique = new Set(numbers);
    expect(unique.size).toBe(5);

    // All should follow INV-XXXX format
    numbers.forEach(n => expect(n).toMatch(/^INV-\d{4}$/));
  });
});

// ─── Validation tests ─────────────────────────────────────────────────────────

describe('Invoice — validation', () => {
  let token, workspaceId, clientId;

  beforeEach(async () => {
    const u  = await createVerifiedUser('validation@test.com');
    token      = u.token;
    workspaceId = u.workspaceId;
    const c  = await createTestClient(workspaceId);
    clientId = c._id;
  });

  it('rejects invoice with no line items', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId, dueDate: '2026-06-30', lineItems: [] });

    expect(res.status).toBe(400);
  });

  it('rejects invalid GST rate', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-06-30',
        lineItems: [{ description: 'A', qty: 1, unitPrice: 1000, gstRate: 15 }]
      });

    expect(res.status).toBe(400);
  });

  it('rejects negative unit price', async () => {
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-06-30',
        lineItems: [{ description: 'A', qty: 1, unitPrice: -100, gstRate: 18 }]
      });

    expect(res.status).toBe(400);
  });

  it('rejects client from different workspace', async () => {
    const otherUser = await createVerifiedUser('other@test.com');
    const otherClient = await createTestClient(otherUser.workspaceId);

    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId:  otherClient._id,
        dueDate:   '2026-06-30',
        lineItems: [{ description: 'A', qty: 1, unitPrice: 1000, gstRate: 18 }]
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('CLIENT_NOT_FOUND');
  });
});

// ─── PDF generation test ──────────────────────────────────────────────────────

describe('Invoice — PDF generation', () => {
  let token, workspaceId, clientId;

  beforeEach(async () => {
    const u  = await createVerifiedUser('pdf@test.com');
    token      = u.token;
    workspaceId = u.workspaceId;
    const c  = await createTestClient(workspaceId);
    clientId = c._id;
  });

  it('generates PDF for draft invoice and returns URL', async () => {
    const createRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-06-30',
        lineItems: [{ description: 'Design', qty: 1, unitPrice: 10000, gstRate: 18 }]
      });

    const invoiceId = createRes.body.data.invoice._id;

    const pdfRes = await request(app)
      .post(`/api/v1/invoices/${invoiceId}/generate-pdf`)
      .set('Authorization', `Bearer ${token}`);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.body.data).toHaveProperty('pdfUrl');
    expect(pdfRes.body.data.pdfUrl).toContain('cloudinary');
  });
});
describe('Invoice — workspace isolation', () => {
  it('cannot access invoice from another workspace', async () => {
    const userA = await createVerifiedUser('invoiceA@test.com');
    const userB = await createVerifiedUser('invoiceB@test.com');

    const clientA = await createTestClient(userA.workspaceId);

    const createRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        clientId:  clientA._id,
        dueDate:   '2026-07-31',
        lineItems: [{ description: 'Test', qty: 1, unitPrice: 1000, gstRate: 18 }]
      });

    const invoiceId = createRes.body.data.invoice._id;

    // User B tries to access User A's invoice
    const res = await request(app)
      .get(`/api/v1/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INVOICE_NOT_FOUND');
  });
});

describe('Invoice — list and filter', () => {
  let token, workspaceId, clientId;

  beforeEach(async () => {
    const u = await createVerifiedUser('listinv@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
    const c = await createTestClient(workspaceId);
    clientId = c._id;
  });

  it('returns paginated invoice list', async () => {
    // Create 3 invoices
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId,
          dueDate:   '2026-07-31',
          lineItems: [{ description: `Service ${i}`, qty: 1, unitPrice: 1000, gstRate: 18 }]
        });
    }

    const res = await request(app)
      .get('/api/v1/invoices?limit=2&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invoices).toHaveLength(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.pages).toBe(2);
  });

  it('filters invoices by status', async () => {
    const createRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        dueDate:   '2026-07-31',
        lineItems: [{ description: 'Test', qty: 1, unitPrice: 1000, gstRate: 18 }]
      });

    const invoiceId = createRes.body.data.invoice._id;
    await Invoice.findByIdAndUpdate(invoiceId, { status: 'sent' });

    const res = await request(app)
      .get('/api/v1/invoices?status=sent')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invoices.every(i => i.status === 'sent')).toBe(true);
  });
});
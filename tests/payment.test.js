const request  = require('supertest');
const crypto   = require('crypto');
const app      = require('../app');
const Invoice  = require('../src/models/invoice.model');
const Client   = require('../src/models/client.model');
const ProcessedEvent = require('../src/models/processedEvent.model');
const { createVerifiedUser } = require('./helpers');

// Mock Razorpay SDK
jest.mock('../src/config/razorpay', () => ({
  getRazorpay: jest.fn(() => ({
    paymentLink: {
      create: jest.fn(async () => ({
        id:        'plink_test_123',
        short_url: 'https://rzp.io/i/test123',
      }))
    }
  }))
}));

// Mock PDF service
jest.mock('../src/services/pdf.service', () => ({
  generateAndUploadPDF: jest.fn(async () => ({
    publicId:  'postfolio/test/invoice_test',
    secureUrl: 'https://res.cloudinary.com/test/raw/upload/invoice.pdf',
  }))
}));

// Mock email service
jest.mock('../src/services/email.service', () => ({
  sendOTPEmail:               jest.fn(async () => {}),
  sendPasswordResetEmail:     jest.fn(async () => {}),
  sendInvoiceEmail:           jest.fn(async () => {}),
  sendPaymentConfirmationEmail: jest.fn(async () => {}),
  sendPaymentMismatchAlert:   jest.fn(async () => {}),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createTestClient = async (workspaceId) =>
  Client.create({
    workspace: workspaceId,
    name:      'Payment Test Client',
    email:     'paymentclient@test.com',
  });

const createDraftInvoice = async (token, workspaceId) => {
  const client = await createTestClient(workspaceId);
  const res = await request(app)
    .post('/api/v1/invoices')
    .set('Authorization', `Bearer ${token}`)
    .send({
      clientId:  client._id,
      dueDate:   '2026-07-31',
      lineItems: [{ description: 'Test service', qty: 1, unitPrice: 10000, gstRate: 18 }]
    });
  return res.body.data.invoice;
};

// Helper to generate a valid Razorpay webhook signature
const generateWebhookSignature = (body) =>
  crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret')
    .update(typeof body === 'string' ? body : JSON.stringify(body))
    .digest('hex');

// ─── Send invoice tests ───────────────────────────────────────────────────────

describe('Payment — send invoice', () => {
  let token, workspaceId;

  beforeEach(async () => {
    const u = await createVerifiedUser('send@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
  });

  it('sends a draft invoice and returns sent status', async () => {
    const invoice = await createDraftInvoice(token, workspaceId);

    const res = await request(app)
      .post(`/api/v1/invoices/${invoice._id}/send`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.status).toBe('sent');
    expect(res.body.data.invoice.razorpayLinkId).toBe('plink_test_123');
    expect(res.body.data.invoice.razorpayLinkUrl).toBe('https://rzp.io/i/test123');
  });

  it('rejects sending an already sent invoice', async () => {
    const invoice = await createDraftInvoice(token, workspaceId);

    // Send once
    await request(app)
      .post(`/api/v1/invoices/${invoice._id}/send`)
      .set('Authorization', `Bearer ${token}`);

    // Send again — must fail
    const res = await request(app)
      .post(`/api/v1/invoices/${invoice._id}/send`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_NOT_DRAFT');
  });

  it('rejects sending a cancelled invoice', async () => {
    const invoice = await createDraftInvoice(token, workspaceId);
    await Invoice.findByIdAndUpdate(invoice._id, { status: 'cancelled' });

    const res = await request(app)
      .post(`/api/v1/invoices/${invoice._id}/send`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_NOT_DRAFT');
  });
});

// ─── Webhook tests ────────────────────────────────────────────────────────────

describe('Payment — webhook handler', () => {
  let token, workspaceId, invoice;

  beforeEach(async () => {
    const u = await createVerifiedUser('webhook@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;

    // Create and send invoice
    const draft = await createDraftInvoice(token, workspaceId);
    await request(app)
      .post(`/api/v1/invoices/${draft._id}/send`)
      .set('Authorization', `Bearer ${token}`);

    invoice = await Invoice.findById(draft._id);
  });

  it('rejects webhook with missing signature', async () => {
    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ event: 'payment_link.paid' }));

    expect(res.status).toBe(400);
  });

  it('rejects webhook with invalid signature', async () => {
    const body = JSON.stringify({ id: 'evt_fake', event: 'payment_link.paid' });

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'invalid_signature_here')
      .send(body);

    expect(res.status).toBe(401);
  });

  it('marks invoice as paid on valid payment_link.paid event', async () => {
    const eventBody = {
      id:    'evt_test_paid_001',
      event: 'payment_link.paid',
      payload: {
        payment_link: {
          entity: {
            id:          'plink_test_123',
            amount_paid: invoice.grandTotal * 100, // Razorpay sends paise
            notes: {
              invoiceId:     invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
            }
          }
        }
      }
    };

    const bodyString = JSON.stringify(eventBody);
    const signature  = generateWebhookSignature(bodyString);

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(bodyString);

    expect(res.status).toBe(200);

    // Verify invoice was marked as paid in DB
    const updated = await Invoice.findById(invoice._id);
    expect(updated.status).toBe('paid');
    expect(updated.paidAmount).toBe(invoice.grandTotal);
  });

  it('ignores duplicate webhook events (idempotency)', async () => {
    const eventBody = {
      id:    'evt_test_duplicate_001',
      event: 'payment_link.paid',
      payload: {
        payment_link: {
          entity: {
            id:          'plink_test_123',
            amount_paid: invoice.grandTotal * 100,
            notes: {
              invoiceId:     invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
            }
          }
        }
      }
    };

    const bodyString = JSON.stringify(eventBody);
    const signature  = generateWebhookSignature(bodyString);

    // Send same event twice
    await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(bodyString);

    const secondRes = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(bodyString);

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.result.status).toBe('duplicate');

    // Invoice should be paid exactly once
    const updated = await Invoice.findById(invoice._id);
    expect(updated.status).toBe('paid');
    expect(updated.paidAmount).toBe(invoice.grandTotal);
  });

  it('does NOT mark invoice as paid when amounts mismatch', async () => {
    const eventBody = {
      id:    'evt_test_mismatch_001',
      event: 'payment_link.paid',
      payload: {
        payment_link: {
          entity: {
            id:          'plink_test_123',
            amount_paid: (invoice.grandTotal - 500) * 100, // ₹500 short
            notes: {
              invoiceId:     invoice._id.toString(),
              invoiceNumber: invoice.invoiceNumber,
            }
          }
        }
      }
    };

    const bodyString = JSON.stringify(eventBody);
    const signature  = generateWebhookSignature(bodyString);

    const res = await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(bodyString);

    expect(res.status).toBe(200); // Webhook still returns 200

    // Invoice must NOT be paid
    const updated = await Invoice.findById(invoice._id);
    expect(updated.status).toBe('sent'); // Still sent, not paid
  });
});

// ─── Manual mark paid tests ───────────────────────────────────────────────────

describe('Payment — manual mark paid', () => {
  let token, workspaceId;

  beforeEach(async () => {
    const u = await createVerifiedUser('manual@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;
  });

  it('marks a sent invoice as paid manually', async () => {
    const draft = await createDraftInvoice(token, workspaceId);
    await Invoice.findByIdAndUpdate(draft._id, { status: 'sent' });

    const res = await request(app)
      .post(`/api/v1/invoices/${draft._id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({ razorpayPaymentId: 'pay_manual_test_123' });

    expect(res.status).toBe(200);
    expect(res.body.data.invoice.status).toBe('paid');
    expect(res.body.data.invoice.manualPaymentNote).toBe('pay_manual_test_123');
  });

  it('rejects marking an already paid invoice', async () => {
    const draft = await createDraftInvoice(token, workspaceId);
    await Invoice.findByIdAndUpdate(draft._id, { status: 'paid' });

    const res = await request(app)
      .post(`/api/v1/invoices/${draft._id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_ALREADY_PAID');
  });

  it('rejects marking a draft invoice as paid', async () => {
    const draft = await createDraftInvoice(token, workspaceId);

    const res = await request(app)
      .post(`/api/v1/invoices/${draft._id}/mark-paid`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVOICE_CANNOT_BE_PAID');
  });
});

describe('Payment — payment failed webhook', () => {
  let token, workspaceId, invoice;

  beforeEach(async () => {
    const u = await createVerifiedUser('failed@test.com');
    token       = u.token;
    workspaceId = u.workspaceId;

    const draft = await createDraftInvoice(token, workspaceId);
    await request(app)
      .post(`/api/v1/invoices/${draft._id}/send`)
      .set('Authorization', `Bearer ${token}`);

    invoice = await Invoice.findById(draft._id);
  });

  it('marks invoice as payment_failed on failed payment event', async () => {
    const eventBody = {
      id:    'evt_test_failed_001',
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id:                'pay_test_failed',
            amount:            invoice.grandTotal * 100,
            error_code:        'BAD_REQUEST_ERROR',
            error_description: 'Card declined',
            notes: {
              invoiceId: invoice._id.toString(),
            }
          }
        }
      }
    };

    const bodyString = JSON.stringify(eventBody);
    const signature  = generateWebhookSignature(bodyString);

    await request(app)
      .post('/api/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(bodyString);

    const updated = await Invoice.findById(invoice._id);
    expect(updated.status).toBe('payment_failed');
  });
});
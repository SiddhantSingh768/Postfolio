const User      = require('../models/user.model');
const Client    = require('../models/client.model');
const Project   = require('../models/project.model');
const Milestone = require('../models/milestone.model');
const Invoice   = require('../models/invoice.model');
const AppError  = require('../utils/AppError');
const logger    = require('../config/logger');

// ─── Get onboarding status ────────────────────────────────────────────────────

const getOnboardingStatus = async (userId, workspaceId) => {
  const user = await User.findById(userId);
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

  const onboarding = user.onboarding || {};

  // Compute checklist status
  const steps = [
    {
      id:        'add_client',
      label:     'Add your first client',
      completed: onboarding.hasAddedClient || false,
      action:    '/clients/new',
    },
    {
      id:        'create_project',
      label:     'Create a project',
      completed: onboarding.hasCreatedProject || false,
      action:    '/projects/new',
    },
    {
      id:        'send_invoice',
      label:     'Send your first invoice',
      completed: onboarding.hasSentInvoice || false,
      action:    '/invoices/new',
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const allComplete    = completedCount === steps.length;

  // Auto-complete onboarding if all steps done
  if (allComplete && !onboarding.completedAt) {
    await User.findByIdAndUpdate(userId, {
      'onboarding.completedAt': new Date(),
      'onboarding.isDismissed': true,
    });
  }

  return {
    steps,
    completedCount,
    totalSteps:  steps.length,
    allComplete,
    isDismissed: onboarding.isDismissed || allComplete,
    completedAt: onboarding.completedAt || null,
  };
};

// ─── Mark onboarding step complete ───────────────────────────────────────────
//
// Called from other services when the corresponding action is taken.
// Safe to call multiple times — subsequent calls are no-ops.

const markStepComplete = async (userId, step) => {
  const fieldMap = {
    add_client:     'onboarding.hasAddedClient',
    create_project: 'onboarding.hasCreatedProject',
    send_invoice:   'onboarding.hasSentInvoice',
  };

  const field = fieldMap[step];
  if (!field) return;

  await User.findByIdAndUpdate(userId, { $set: { [field]: true } });
};

// ─── Dismiss onboarding checklist ────────────────────────────────────────────

const dismissOnboarding = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    $set: {
      'onboarding.isDismissed': true,
    }
  });
  return { message: 'Onboarding checklist dismissed' };
};

// ─── Seed demo workspace ──────────────────────────────────────────────────────
//
// Creates realistic sample data so a new user can explore
// the product immediately without manually creating everything.
//
// Creates:
//   1 client (Acme Technologies)
//   1 project (Website Redesign) in active status
//   3 milestones (Discovery, Design, Development)
//   1 draft invoice
//
// Safe to call only once — checks if demo data already exists.

const seedDemoWorkspace = async (userId, workspaceId) => {
  // Check if demo data already exists
  const existingClient = await Client.findOne({
    workspace: workspaceId,
    name:      'Acme Technologies (Demo)',
  });

  if (existingClient) {
    throw new AppError(
      409,
      'DEMO_ALREADY_SEEDED',
      'Demo data has already been loaded for this workspace'
    );
  }

  logger.info({ workspaceId }, 'Seeding demo workspace');

  // Create demo client
  const client = await Client.create({
    workspace: workspaceId,
    name:      'Acme Technologies (Demo)',
    company:   'Acme Technologies Pvt. Ltd.',
    email:     'contact@acmedemo.com',
    phone:     '9876543210',
    country:   'IN',
    gstin:     '27AAPFU0939F1ZV',
    notes:     'This is demo data. You can delete it anytime.',
  });

  // Create demo project
  const project = await Project.create({
    workspace:   workspaceId,
    client:      client._id,
    title:       'Website Redesign (Demo)',
    description: 'Complete redesign of the Acme Technologies website including UX research, design, and development.',
    status:      'active',
    startDate:   new Date(),
    endDate:     new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
    budget:      150000,
    tags:        ['web', 'design', 'development'],
  });

  // Create demo milestones
  const milestoneData = [
    {
      title:       'Discovery & Research',
      description: 'User interviews, competitor analysis, and requirements gathering',
      status:      'completed',
      dueDate:     new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      order:       1,
    },
    {
      title:       'UI/UX Design',
      description: 'Wireframes, mockups, and design system creation',
      status:      'in_progress',
      dueDate:     new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      order:       2,
    },
    {
      title:       'Frontend Development',
      description: 'React implementation of approved designs',
      status:      'pending',
      dueDate:     new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      order:       3,
    },
  ];

  const milestones = await Promise.all(
    milestoneData.map(m => Milestone.create({
      workspace: workspaceId,
      project:   project._id,
      ...m,
    }))
  );

  // Update project with milestone references
  await Project.findByIdAndUpdate(project._id, {
    milestones: milestones.map(m => m._id)
  });

  // Get user for invoice number generation
  const {
    generateInvoiceNumber
  } = require('./invoice.service');

  const invoiceNumber = await generateInvoiceNumber(userId);

  // Create demo invoice
  const invoice = await Invoice.create({
    workspace:     workspaceId,
    client:        client._id,
    project:       project._id,
    invoiceNumber,
    status:        'draft',
    dueDate:       new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lineItems: [
      { description: 'Discovery & Research', qty: 1,  unitPrice: 25000, gstRate: 18, amount: 25000 },
      { description: 'UI/UX Design',         qty: 1,  unitPrice: 45000, gstRate: 18, amount: 45000 },
      { description: 'Frontend Development', qty: 80, unitPrice: 1500,  gstRate: 18, amount: 120000 },
    ],
    notes: 'This is a demo invoice. Delete it before creating real invoices.',
  });

  // Mark onboarding steps complete since demo data exists
  await markStepComplete(userId, 'add_client');
  await markStepComplete(userId, 'create_project');

  logger.info({ workspaceId, clientId: client._id, projectId: project._id }, 'Demo workspace seeded');

  return {
    message: 'Demo data loaded successfully',
    data: {
      client:    { id: client._id,  name: client.name },
      project:   { id: project._id, title: project.title },
      milestones: milestones.length,
      invoice:   { id: invoice._id, number: invoice.invoiceNumber },
    }
  };
};

module.exports = {
  getOnboardingStatus,
  markStepComplete,
  dismissOnboarding,
  seedDemoWorkspace,
};
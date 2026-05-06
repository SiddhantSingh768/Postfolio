const request = require("supertest");
const app = require("../app");
const Project = require("../src/models/project.model");
const Client = require("../src/models/client.model");
const Milestone = require("../src/models/milestone.model");
const Invoice = require("../src/models/invoice.model");
const { createVerifiedUser } = require("./helpers");
const { generatePortalToken } = require("../src/utils/tokenUtils");

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _emailCounter = 0;
const createTestProject = async (workspaceId) => {
  const client = await Client.create({
    workspace: workspaceId,
    name: "Portal Test Client",
    email: `portalclient${++_emailCounter}@test.com`,
  });

  const project = await Project.create({
    workspace: workspaceId,
    client: client._id,
    title: "Portal Test Project",
    status: "active",
  });

  const milestone = await Milestone.create({
    workspace: workspaceId,
    project: project._id,
    title: "Test Milestone",
    status: "in_progress",
    order: 1,
  });

  return { client, project, milestone };
};

// ─── Portal token generation tests ───────────────────────────────────────────

describe("Portal — generate and revoke access", () => {
  let token, workspaceId, project;

  beforeEach(async () => {
    const u = await createVerifiedUser("portal@test.com");
    token = u.token;
    workspaceId = u.workspaceId;
    const data = await createTestProject(workspaceId);
    project = data.project;
  });

  it("generates a portal link for a valid project", async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${project._id}/portal`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expiresInDays: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("portalUrl");
    expect(res.body.data).toHaveProperty("token");
    expect(res.body.data).toHaveProperty("expiresAt");
    expect(res.body.data.portalUrl).toContain("/portal/");
  });

  it("revokes portal access", async () => {
    // First generate
    await request(app)
      .post(`/api/v1/projects/${project._id}/portal`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    // Then revoke
    const res = await request(app)
      .delete(`/api/v1/projects/${project._id}/portal`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    // Verify project has no portal token in DB
    const updated = await Project.findById(project._id);
    expect(updated.portalEnabled).toBe(false);
    expect(updated.portalToken).toBeNull();
  });
});

// ─── Portal access tests ──────────────────────────────────────────────────────

describe("Portal — access control", () => {
  let token, workspaceId, project, validPortalToken;

  beforeEach(async () => {
    const u = await createVerifiedUser("portalaccess@test.com");
    token = u.token;
    workspaceId = u.workspaceId;
    const data = await createTestProject(workspaceId);
    project = data.project;

    // Generate portal access
    const res = await request(app)
      .post(`/api/v1/projects/${project._id}/portal`)
      .set("Authorization", `Bearer ${token}`)
      .send({ expiresInDays: 30 });

    validPortalToken = res.body.data.token;
  });

  it("allows access with valid portal token", async () => {
    const res = await request(app).get(
      `/api/v1/portal/${project._id}?token=${validPortalToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("project");
    expect(res.body.data).toHaveProperty("milestones");
    expect(res.body.data).toHaveProperty("invoices");
  });

  it("rejects access with no token", async () => {
    const res = await request(app).get(`/api/v1/portal/${project._id}`);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("NO_PORTAL_TOKEN");
  });

  it("rejects access with invalid token", async () => {
    const res = await request(app).get(
      `/api/v1/portal/${project._id}?token=invalid_token_here`,
    );

    expect(res.status).toBe(403);
  });

  it("rejects access after token is revoked", async () => {
    // Revoke the token
    await request(app)
      .delete(`/api/v1/projects/${project._id}/portal`)
      .set("Authorization", `Bearer ${token}`);

    // Try to access portal with the now-revoked token
    const res = await request(app).get(
      `/api/v1/portal/${project._id}?token=${validPortalToken}`,
    );

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PORTAL_ACCESS_DENIED");
  });

  it("rejects token for a different project", async () => {
    // Create another project
    const otherData = await createTestProject(workspaceId);

    // Try to use token from project 1 to access project 2
    const res = await request(app).get(
      `/api/v1/portal/${otherData.project._id}?token=${validPortalToken}`,
    );

    expect(res.status).toBe(403);
  });
});

// ─── Portal content tests ─────────────────────────────────────────────────────

describe("Portal — content visibility", () => {
  let token, workspaceId, project, milestone, portalToken;

  beforeEach(async () => {
    const u = await createVerifiedUser("portalcontent@test.com");
    token = u.token;
    workspaceId = u.workspaceId;
    const data = await createTestProject(workspaceId);
    project = data.project;
    milestone = data.milestone;

    const res = await request(app)
      .post(`/api/v1/projects/${project._id}/portal`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    portalToken = res.body.data.token;
  });

  it("returns project milestones in order", async () => {
    const res = await request(app).get(
      `/api/v1/portal/${project._id}?token=${portalToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.milestones).toHaveLength(1);
    expect(res.body.data.milestones[0].title).toBe("Test Milestone");
  });

  it("allows client to submit approval comment", async () => {
    const res = await request(app)
      .post(
        `/api/v1/portal/${project._id}/milestones/${milestone._id}/approve?token=${portalToken}`,
      )
      .send({ comment: "Looks great! Approved." });

    expect(res.status).toBe(200);
    expect(res.body.data.clientNote).toBe("Looks great! Approved.");

    // Verify stored in DB
    const updated = await Milestone.findById(milestone._id);
    expect(updated.clientNote).toBe("Looks great! Approved.");
  });

  it("rejects empty approval comment", async () => {
    const res = await request(app)
      .post(
        `/api/v1/portal/${project._id}/milestones/${milestone._id}/approve?token=${portalToken}`,
      )
      .send({ comment: "" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("COMMENT_REQUIRED");
  });
});

// ─── Invoice viewed tracking tests ───────────────────────────────────────────

describe("Portal — invoice viewed tracking", () => {
  let token, workspaceId, project, invoice, portalToken;

  beforeEach(async () => {
    const u = await createVerifiedUser("portalinvoice@test.com");
    token = u.token;
    workspaceId = u.workspaceId;
    const data = await createTestProject(workspaceId);
    project = data.project;

    // Create a sent invoice for this project
    invoice = await Invoice.create({
      workspace: workspaceId,
      client: data.client._id,
      project: project._id,
      invoiceNumber: "INV-TEST-001",
      status: "sent",
      dueDate: new Date("2026-07-31"),
      lineItems: [
        {
          description: "Test",
          qty: 1,
          unitPrice: 5000,
          gstRate: 18,
          amount: 5000,
        },
      ],
      subtotal: 5000,
      totalGst: 900,
      grandTotal: 5900,
    });

    const res = await request(app)
      .post(`/api/v1/projects/${project._id}/portal`)
      .set("Authorization", `Bearer ${token}`)
      .send({});

    portalToken = res.body.data.token;
  });

  it("marks invoice as viewed when client opens it", async () => {
    const res = await request(app).get(
      `/api/v1/portal/${project._id}/invoice/${invoice._id}/view?token=${portalToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.viewed).toBe(true);

    // Verify in DB
    const updated = await Invoice.findById(invoice._id);
    expect(updated.status).toBe("viewed");
    expect(updated.viewedAt).toBeTruthy();
  });

  it("does not error if invoice already viewed", async () => {
    await Invoice.findByIdAndUpdate(invoice._id, {
      status: "viewed",
      viewedAt: new Date(),
    });

    const res = await request(app).get(
      `/api/v1/portal/${project._id}/invoice/${invoice._id}/view?token=${portalToken}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.alreadyTracked).toBe(true);
  });
});

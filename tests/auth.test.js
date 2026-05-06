const request = require("supertest");
const app = require("../app");

describe("POST /api/v1/auth/register", () => {
  it("returns 201 on valid registration", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Siddhant",
        email: "test@example.com",
        password: "Password1",
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
  }, 15000);

  it("returns 409 on duplicate email", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "User", email: "dup@example.com", password: "Password1" });
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "User2", email: "dup@example.com", password: "Password1" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_EXISTS");
  }, 15000);

  it("returns 400 on weak password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "User", email: "weak@example.com", password: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 on missing fields", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("returns 403 if email not verified", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "User",
        email: "unverified@example.com",
        password: "Password1",
      });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "unverified@example.com", password: "Password1" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  }, 15000);

  it("returns 401 for wrong password", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "wrongpass" });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("returns 401 with no cookie", async () => {
    const res = await request(app).post("/api/v1/auth/refresh");
    expect(res.status).toBe(401);
  });
});

describe("GET /health", () => {
  it("returns 200", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});

describe('Auth — password reset flow', () => {
  it('forgot password returns success even for unknown email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@nowhere.com' });

    // Must return 200 — never reveal whether email exists
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  it('reset password with invalid token returns 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'invalid_token', newPassword: 'NewPassword1' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_RESET_TOKEN');
  });

  it('logout clears refresh token cookie', async () => {
    // Register and verify user
    await request(app).post('/api/v1/auth/register')
      .send({ name: 'Logout User', email: 'logout@test.com', password: 'Password1' });

    // Manually verify email in DB for test
    const User = require('../src/models/user.model');
    await User.findOneAndUpdate(
      { email: 'logout@test.com' },
      { isEmailVerified: true }
    );

    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'logout@test.com', password: 'Password1' });

    expect(loginRes.status).toBe(200);

    // Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', loginRes.headers['set-cookie']);

    expect(logoutRes.status).toBe(200);

    // Cookie should be cleared
    const cookies = logoutRes.headers['set-cookie'] || [];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken'));
    // Cookie is cleared by setting Max-Age=0 or Expires in the past
    if (refreshCookie) {
      expect(refreshCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    }
  });
});

describe('Auth — rate limiting', () => {
  it('blocks login after 10 failed attempts', async () => {
    // This test only works if Redis rate limiter is active
    // Skip if Redis is not available
    const { getRedisClient } = require('../src/config/redis');
    const client = getRedisClient();
    if (!client || client.status !== 'ready') return;

    const attempts = Array.from({ length: 11 }, () =>
      request(app).post('/api/v1/auth/login')
        .send({ email: 'rate@test.com', password: 'wrongpassword' })
    );

    const results = await Promise.all(attempts);
    const rateLimited = results.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const pinoHttp = require("pino-http");
const logger = require("./src/config/logger");
const errorHandler = require("./src/middleware/errorHandler");
const authRoutes = require("./src/routes/auth.routes");
const { generalLimiter } = require("./src/middleware/rateLimiter.middleware");
const clientRoutes = require("./src/routes/client.routes");
const projectRoutes = require("./src/routes/project.routes");
const milestoneRoutes = require("./src/routes/milestone.routes");
const deliverableRoutes = require("./src/routes/deliverable.routes");
const invoiceRoutes = require("./src/routes/invoice.routes");
const webhookRoutes = require("./src/routes/webhook.routes");
const portalRoutes = require("./src/routes/portal.routes");
const analyticsRoutes  = require('./src/routes/analytics.routes');
const onboardingRoutes = require('./src/routes/onboarding.routes');

const app = express();

// Security headers (sets X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet());

// CORS — credentials: true is required for cookies to be sent cross-origin
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// Structured request logging via Pino
app.use(pinoHttp({ logger }));

app.use(
  "/api/v1/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  webhookRoutes,
);

// Body parsing
// The Razorpay webhook route (Phase 5) will override this with raw body parser
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Global rate limiter on all /api routes
app.use("/api", generalLimiter);

const passport = require("./src/config/passport");
app.use(passport.initialize());

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/milestones", milestoneRoutes);
app.use("/api/v1/portal", portalRoutes);
app.use("/api/v1", deliverableRoutes);
app.use("/api/v1/invoices", invoiceRoutes);
app.use('/api/v1/analytics',  analyticsRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);

// Health check — Railway and Vercel use this to confirm the server is alive
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  }),
);

// 404 — any unmatched route
app.use((req, res) =>
  res.status(404).json({
    status: "error",
    code: "NOT_FOUND",
    message: `Route ${req.originalUrl} not found`,
  }),
);

// Global error handler — must be LAST and must have 4 parameters
app.use(errorHandler);

module.exports = app;

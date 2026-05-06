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

app.use(helmet());

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(pinoHttp({ logger }));

app.use(
  "/api/v1/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  webhookRoutes,
);

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api", generalLimiter);

const passport = require("./src/config/passport");
app.use(passport.initialize());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1/projects", projectRoutes);
app.use("/api/v1/milestones", milestoneRoutes);
app.use("/api/v1/portal", portalRoutes);
app.use("/api/v1", deliverableRoutes);
app.use("/api/v1/invoices", invoiceRoutes);
app.use('/api/v1/analytics',  analyticsRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);

app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  }),
);

app.use((req, res) =>
  res.status(404).json({
    status: "error",
    code: "NOT_FOUND",
    message: `Route ${req.originalUrl} not found`,
  }),
);

app.use(errorHandler);

module.exports = app;

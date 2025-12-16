// src/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import compression from "compression";
import rateLimit from "express-rate-limit";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import path from "path";

// Routes
import authRoutes from "./routes/auth.routes.js";
import templateRoutes from "./routes/template.routes.js";
import resumeRoutes from "./routes/resume.routes.js";
import fileRoutes from "./routes/file.routes.js";
import atsRoutes from "./routes/ats.routes.js";
import billingRoutes from "./routes/billing.routes.js";
import notifyRoutes from "./routes/notify.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import exportRoutes from "./routes/export.routes.js";
import newsletterRoutes from "./routes/newsletter.routes.js";

import ApiError from "./utils/ApiError.js";
import ApiResponse from "./utils/ApiResponse.js";
import { stripeWebhook } from "./controllers/billing.controller.js";

const app = express();

// --- Security & perf ---
app.use(helmet());
const corsOptions = {
  origin: (origin, callback) => {
    // Allow all origins, but handle credentials properly
    callback(null, true);
  },
  credentials: true, // Allow credentials (cookies, authorization headers)
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
};
app.use(cors(corsOptions));
// Ensure preflight OPTIONS always receives CORS headers
app.options("*", cors(corsOptions));
app.use(compression());
// Rate limiting - more lenient for development
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 200 : 1000, // 200 in prod, 1000 in dev
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
};
app.use(rateLimit(rateLimitConfig));
app.use(mongoSanitize());
app.use(xss());

// Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy can break postMessage across origins.
// Only set a permissive COOP/COEP if explicitly requested via env.
if (process.env.COOP_HEADER) {
  app.use((req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", process.env.COOP_HEADER);
    if (process.env.COEP_HEADER)
      res.setHeader("Cross-Origin-Embedder-Policy", process.env.COEP_HEADER);
    next();
  });
}

// Serve static assets (thumbnails/previews) if you decide to host images locally
app.use("/static", express.static(path.resolve("public"), { maxAge: "1d" }));

// ⚠️ Stripe webhook needs RAW body and must be defined BEFORE express.json()
app.post(
  "/api/v1/billing/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

// Normal parsers after webhook
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// Health
app.get("/health", (req, res) =>
  res.json(new ApiResponse(200, { status: "ok" }, "healthy"))
);

// More lenient rate limiting for resume operations (development)
const resumeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 500, // 100 in prod, 500 in dev
  message: "Too many resume requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

// Mount routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/templates", templateRoutes);
app.use("/api/v1/resumes", resumeRateLimit, resumeRoutes); // Apply specific rate limit to resumes
app.use("/api/v1/files", fileRoutes);
app.use("/api/v1/ats", atsRoutes);
app.use("/api/v1/billing", billingRoutes);
app.use("/api/v1/notify", notifyRoutes);
app.use("/api/v1/ai", aiRoutes);
app.use("/api/v1/export", exportRoutes);
app.use("/api/v1/newsletter", newsletterRoutes);

// 404
app.all("*", (req, res, next) => next(new ApiError(404, "Route not found")));

// Error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const message = err.message || "Something went wrong";
  const details = err.errors || undefined;
  if (process.env.NODE_ENV !== "production") console.error(err);
  res.status(status).json({ success: false, message, details });
});

export default app;

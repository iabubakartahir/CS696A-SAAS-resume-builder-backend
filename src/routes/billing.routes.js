import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import {
  createBillingSession,
  getSubscriptionStatus,
  syncSubscription,
  updateUserSubscription,
  cancelUserSubscription,
  stripeWebhook,
} from "../controllers/billing.controller.js";

const router = Router();

// Webhook must be before express.json() middleware (handled in app.js)
// This route is already defined in app.js, so we don't need it here

// Protected routes
router.post("/checkout", protect, createBillingSession);
router.get("/subscription", protect, getSubscriptionStatus);
router.post("/sync", protect, syncSubscription);
router.put("/subscription", protect, updateUserSubscription);
router.post("/cancel", protect, cancelUserSubscription);

export default router;

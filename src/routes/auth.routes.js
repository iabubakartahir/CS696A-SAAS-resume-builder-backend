import { Router } from "express";
import {
  login,
  signup,
  me,
  refresh,
  logout,
  google,
  linkedin,
  sendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  deleteAccount,
  restoreAccount,
} from "../controllers/auth.controller.js";
import {
  signupValidator,
  loginValidator,
  googleValidator,
  linkedinValidator,
  validate,
} from "../middlewares/validate.js";
import { protect } from "../middlewares/auth.js";

const router = Router();

router.post("/signup", signupValidator, validate, signup);
router.post("/login", loginValidator, validate, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", protect, me);
router.post("/send-verification", protect, sendVerification);
router.get("/verify", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.delete("/delete", protect, deleteAccount);
// Admin / backend-only restore endpoint (uses shared secret in body)
router.post("/restore", restoreAccount);
router.post("/google", googleValidator, validate, google);
router.post("/linkedin", linkedinValidator, validate, linkedin);

export default router;

import { Router } from "express";
import { checkATSScore } from "../controllers/ats.controller.js";

const router = Router();

// ATS check endpoint - supports both resumeId (from database) and resumeText (from file upload)
router.post("/check", checkATSScore);

export default router;

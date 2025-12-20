import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import { emailResume } from "../controllers/notify.controller.js";
const r = Router();
r.post("/email/:resumeId", protect, emailResume);
export default r;

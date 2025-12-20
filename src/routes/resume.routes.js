
import { Router } from "express";
import { protect } from "../middlewares/auth.js";
import { requirePlan } from "../middlewares/requirePlan.js";
import {
createResume,
getMyResumes,
getResume,
patchResume,
previewHTML,
exportTxt,
exportPDF,
exportDOCX,
deleteResume,
duplicateResume,
importFromLinkedIn,
} from "../controllers/resume.controller.js";

const r = Router();
r.use(protect);
r.post("/", createResume);
r.post("/import/linkedin", importFromLinkedIn);
r.get("/", getMyResumes);
r.get("/:id", getResume);
r.patch("/:id", patchResume);
r.delete("/:id", deleteResume);
r.post("/:id/duplicate", duplicateResume);
r.get("/:id/preview", previewHTML);
// Export routes require at least Professional plan (free users cannot download)
r.get("/:id/export/txt", requirePlan("professional"), exportTxt);
r.get("/:id/export/pdf", requirePlan("professional"), exportPDF);
r.get("/:id/export/docx", requirePlan("professional"), exportDOCX);
export default r;
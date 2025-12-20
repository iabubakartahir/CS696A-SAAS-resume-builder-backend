import { Router } from "express";
import multer from "multer";
import {
  parseFile,
  parseAndCreateResume,
} from "../controllers/file.controller.js";
import { protect } from "../middlewares/auth.js";

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx", ".doc"];
    const ext = file.originalname
      .toLowerCase()
      .slice(file.originalname.lastIndexOf("."));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed"));
    }
  },
});

const router = Router();

// Parse only (returns structured data, doesn't create resume)
router.post("/parse", upload.single("file"), parseFile);

// Parse AND create resume in one step (requires auth)
router.post("/import", protect, upload.single("file"), parseAndCreateResume);

export default router;

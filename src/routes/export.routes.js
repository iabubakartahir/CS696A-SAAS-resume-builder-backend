import { Router } from "express";
import { exportPDF, exportDOCX } from "../services/export.service.js";

const router = Router();

router.post("/pdf", async (req, res) => {
  const buffer = await exportPDF(req.body.html);
  res.setHeader("Content-Type", "application/pdf");
  res.send(buffer);
});

router.post("/docx", async (req, res) => {
  const buffer = await exportDOCX(req.body.resume);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  res.send(buffer);
});

export default router;

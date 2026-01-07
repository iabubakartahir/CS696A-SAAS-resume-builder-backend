import catchAsync from "../utils/catchAsync.js";
import ApiError from "../utils/ApiError.js";
import { exportPDF, exportDOCX } from "../services/export.service.js";

export const exportResumePDF = catchAsync(async (req, res, next) => {
  const { html } = req.body;
  if (!html) return next(new ApiError(400, "html is required"));
  const buffer = await exportPDF(html);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=resume.pdf");
  res.send(buffer);
});

export const exportResumeDOCX = catchAsync(async (req, res, next) => {
  const { resume } = req.body;
  if (!resume) return next(new ApiError(400, "resume object is required"));
  const buffer = await exportDOCX(resume);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  res.setHeader("Content-Disposition", "attachment; filename=resume.docx");
  res.send(buffer);
});

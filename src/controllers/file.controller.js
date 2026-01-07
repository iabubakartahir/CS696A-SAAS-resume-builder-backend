// src/controllers/file.controller.js
import fs from "fs/promises";
import path from "path";
import catchAsync from "../utils/catchAsync.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { parseResumeFile } from "../services/parse.service.js";
import Resume from "../models/Resume.js";
import Template from "../models/Template.js";

export const parseFile = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new ApiError(400, "File missing"));
  const tempPath = req.file.path;
  const originalName = req.file.originalname || "upload";
  const ext = path.extname(originalName).replace(".", "").toLowerCase();

  try {
    const parsed = await parseResumeFile(tempPath, ext);
    res.json(new ApiResponse(200, parsed, "File parsed successfully"));
  } finally {
    // Always clean the temp file
    try {
      await fs.unlink(tempPath);
    } catch {}
  }
});

export const parseAndCreateResume = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new ApiError(400, "File missing"));
  const tempPath = req.file.path;
  const originalName = req.file.originalname || "upload";
  const ext = path.extname(originalName).replace(".", "").toLowerCase();
  const { templateSlug } = req.body;

  try {
    // Parse the uploaded resume
    const parsed = await parseResumeFile(tempPath, ext);

    // Get template (default to first free template if not provided)
    let template;
    if (templateSlug) {
      template = await Template.findOne({ slug: templateSlug, isActive: true });
    }
    if (!template) {
      template = await Template.findOne({ category: "free", isActive: true });
    }
    if (!template) {
      return next(new ApiError(404, "No template available"));
    }

    // Check resume limit (5 resumes max)
    const resumeCount = await Resume.countDocuments({ owner: req.user._id });
    if (resumeCount >= 5) {
      return next(
        new ApiError(
          400,
          "You have reached the maximum limit of 5 resumes. Please delete an old resume to import a new one."
        )
      );
    }

    // ✅ Clean up parsed data - remove null strings and invalid dates
    const cleanExperience = (parsed.experience || []).map((e) => ({
      ...e,
      startDate: e.startDate && e.startDate !== "null" ? e.startDate : undefined,
      endDate: e.endDate && e.endDate !== "null" && !e.current ? e.endDate : undefined,
    }));

    const cleanEducation = (parsed.education || []).map((e) => ({
      ...e,
      location: e.location || "", // required by schema; ensure not undefined
      startDate: e.startDate && e.startDate !== "null" ? e.startDate : undefined,
      endDate: e.endDate && e.endDate !== "null" ? e.endDate : undefined,
    }));

    // Create resume with parsed data
    const resume = await Resume.create({
      owner: req.user._id,
      title: `${parsed.contact?.fullName || "Imported"} Resume`,
      template: template._id,
      planRequired:
        template.category === "premium" || template.category === "industry"
          ? "premium"
          : "free",
      contact: parsed.contact || {},
      experience: cleanExperience,
      education: cleanEducation,
      skills: parsed.skills || [],
      projects: parsed.projects || [],
      awards: parsed.awards || [],
      hobbies: parsed.hobbies || [],
      extras: { rawText: parsed.rawText },
    });

    res.status(201).json(
      new ApiResponse(
        201,
        {
          resumeId: resume._id,
          resume,
          parsed,
        },
        "Resume imported and created successfully"
      )
    );
  } finally {
    // Always clean the temp file
    try {
      await fs.unlink(tempPath);
    } catch {}
  }
});

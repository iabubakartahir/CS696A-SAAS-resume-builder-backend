import catchAsync from "../utils/catchAsync.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { analyzeATS } from "../services/ats.service.js";
import Resume from "../models/Resume.js";

export const checkATSScore = catchAsync(async (req, res, next) => {
  const { resumeText, jobDescription, resumeId } = req.body;

  let resumeData = null;
  let textContent = resumeText || "";

  // If resumeId is provided, fetch resume from database
  if (resumeId) {
    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return next(new ApiError(404, "Resume not found"));
    }

    // Check if user owns this resume (if authenticated)
    // If not authenticated, allow access (for public ATS checking)
    if (req.user && resume.owner.toString() !== req.user._id.toString()) {
      return next(new ApiError(403, "You don't have access to this resume"));
    }

    resumeData = resume.toObject();

    // If no resumeText provided, we'll extract it from resumeData in the service
    if (!textContent) {
      textContent = "";
    }
  }

  // If neither resumeId nor resumeText is provided, return error
  if (!resumeId && !textContent) {
    return next(
      new ApiError(400, "Either resumeId or resumeText must be provided")
    );
  }

  // Perform ATS analysis
  const result = await analyzeATS(
    textContent,
    jobDescription || "",
    resumeData
  );

  // Optionally save ATS score to resume if resumeId was provided
  if (resumeId && resumeData) {
    await Resume.findByIdAndUpdate(resumeId, {
      atsScore: result.overallScore,
    });
  }

  res.json(new ApiResponse(200, result, "ATS analysis complete"));
});

import catchAsync from "../utils/catchAsync.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import { suggestAIContent } from "../services/ai.service.js";

export const generateAISuggestion = catchAsync(async (req, res, next) => {
  const { field, jobDescription } = req.body;
  if (!field || !jobDescription)
    return next(new ApiError(400, "Missing field or jobDescription"));
  const suggestion = await suggestAIContent(field, jobDescription);
  res.json(new ApiResponse(200, { suggestion }, "AI suggestion generated"));
});

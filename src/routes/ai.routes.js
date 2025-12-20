import { Router } from "express";
import { suggestAIContent } from "../services/ai.service.js";
import ApiResponse from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";

const router = Router();

router.post(
  "/suggest",
  catchAsync(async (req, res) => {
    const { field, jobDescription } = req.body;
    const suggestion = await suggestAIContent(field, jobDescription);
    res.json(new ApiResponse(200, { suggestion }, "AI suggestion generated"));
  })
);

export default router;

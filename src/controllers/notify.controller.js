import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import catchAsync from "../utils/catchAsync.js";
import Resume from "../models/Resume.js";
import { sendResumeEmail } from "../services/mail.service.js";
import { renderResumeHTML } from "../services/render.service.js";

const isEmail = (s = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export const emailResume = catchAsync(async (req, res, next) => {
  const { to, message } = req.body;
  if (!isEmail(to)) return next(new ApiError(400, "Valid 'to' email required"));

  const r = await Resume.findOne({
    _id: req.params.resumeId,
    owner: req.user._id,
  }).populate("template", "slug");
  if (!r) return next(new ApiError(404, "Resume not found"));

  const htmlResume = await renderResumeHTML(r.template.slug, {
    title: r.title,
    contact: r.contact,
    experience: r.experience,
    education: r.education,
    skills: r.skills,
    extras: r.extras,
  });

  const subject = `Resume: ${r.title}`;
  const html = `<p>${
    message || "Please find my resume below."
  }</p>${htmlResume}`;

  const sent = await sendResumeEmail({ to, subject, html });
  res.json(
    new ApiResponse(
      200,
      { id: sent.id || sent.data?.id || sent.messageId },
      "Email sent"
    )
  );
});

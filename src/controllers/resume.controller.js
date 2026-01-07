// import ApiError from "../utils/ApiError.js";
// import ApiResponse from "../utils/ApiResponse.js";
// import catchAsync from "../utils/catchAsync.js";
// import Resume from "../models/Resume.js";
// import Template from "../models/Template.js";
// import User from "../models/User.js";
// import Stripe from "stripe";
// import { handleSubscriptionUpdate } from "../services/stripe.service.js";
// import { renderResumeHTML } from "../services/render.service.js";
// import {
//   exportPDF as generatePDF,
//   exportDOCX as generateDOCX,
//   exportWordDOC as generateWordDOC,
// } from "../services/export.service.js";
// import { exchangeLinkedInCode, fetchLinkedInUserInfo } from "../services/oauth.service.js";
// import { fetchLinkedInProfileData } from "../services/linkedin-profile.service.js";

// export const createResume = catchAsync(async (req, res, next) => {
//   const { title, templateSlug } = req.body;
//   if (!templateSlug) return next(new ApiError(400, "templateSlug is required"));

//   const t = await Template.findOne({ slug: templateSlug, isActive: true });
//   if (!t) return next(new ApiError(404, "Template not found"));

//   // Check premium template access
//   if (t.category === "premium" || t.category === "industry") {
//     let user = await User.findById(req.user._id);

//     // If user has a subscription ID, check if it's active, otherwise find active subscription
//     if (user.stripeSubscriptionId || user.stripeCustomerId) {
//       try {
//         const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
//         let subscription = null;
//         let foundActiveSubscription = false;

//         // First, try to retrieve the stored subscription
//         if (user.stripeSubscriptionId) {
//           try {
//             subscription = await stripe.subscriptions.retrieve(
//               user.stripeSubscriptionId
//             );

//             // If subscription is active, use it
//             if (
//               subscription.status === "active" ||
//               subscription.status === "trialing"
//             ) {
//               foundActiveSubscription = true;
//             }
//           } catch (err) {
//             // Subscription not found or error, will search by customer
//             console.log(
//               `Subscription ${user.stripeSubscriptionId} not found or error, searching by customer`
//             );
//           }
//         }

//         // If stored subscription is not active, search for active subscription by customer
//         if (!foundActiveSubscription && user.stripeCustomerId) {
//           try {
//             const subscriptions = await stripe.subscriptions.list({
//               customer: user.stripeCustomerId,
//               status: "all",
//               limit: 10,
//             });

//             // Find the most recent active subscription
//             const activeSubscription = subscriptions.data.find(
//               (sub) =>
//                 (sub.status === "active" || sub.status === "trialing") &&
//                 sub.metadata?.userId === req.user._id.toString()
//             );

//             if (activeSubscription) {
//               subscription = activeSubscription;
//               foundActiveSubscription = true;
//               console.log(
//                 `✅ Found active subscription ${activeSubscription.id} for user ${req.user._id}`
//               );
//             }
//           } catch (err) {
//             console.error(
//               "Error searching subscriptions by customer:",
//               err.message
//             );
//           }
//         }

//         // Update user plan if we found an active subscription
//         if (foundActiveSubscription && subscription) {
//           await handleSubscriptionUpdate(subscription);
//           // Reload user after update
//           user = await User.findById(req.user._id);
//           console.log(
//             `✅ Synced subscription for user ${req.user._id}, plan: ${user.plan}, status: ${user.subscriptionStatus}`
//           );
//         }
//       } catch (err) {
//         console.error("Error syncing subscription:", err.message);
//         // Continue with existing plan check
//       }
//     }

//     const hasActiveSubscription =
//       user.subscriptionStatus === "active" ||
//       user.subscriptionStatus === "trialing";

//     // Both professional and premium plans can access premium templates
//     // (since both are paid subscriptions)
//     const hasPremiumAccess =
//       hasActiveSubscription &&
//       (user.plan === "premium" || user.plan === "professional");

//     if (!hasPremiumAccess) {
//       // Provide helpful error with current status
//       const statusMsg = user.stripeSubscriptionId
//         ? `Subscription ID: ${user.stripeSubscriptionId}, Status: ${
//             user.subscriptionStatus || "unknown"
//           }, Plan: ${user.plan || "free"}`
//         : "No active subscription found";

//       return next(
//         new ApiError(
//           402,
//           `Premium or Professional plan required for this template. ${statusMsg}. Please upgrade to a paid plan to access premium templates.`
//         )
//       );
//     }
//   }

//   // Check resume limit (5 resumes max)
//   const resumeCount = await Resume.countDocuments({ owner: req.user._id });
//   if (resumeCount >= 5) {
//     return next(
//       new ApiError(
//         400,
//         "You have reached the maximum limit of 5 resumes. Please delete an old resume to create a new one."
//       )
//     );
//   }

//   // Check if user already has a resume with this exact title and template to prevent duplicates
//   const existing = await Resume.findOne({
//     owner: req.user._id,
//     title: title || "Untitled Resume",
//     template: t._id,
//   });

//   if (existing) {
//     return res
//       .status(200)
//       .json(
//         new ApiResponse(
//           200,
//           { resumeId: existing._id, resume: existing },
//           "Resume already exists"
//         )
//       );
//   }

//   const r = await Resume.create({
//     owner: req.user._id,
//     title: title || "Untitled Resume",
//     template: t._id,
//     // Treat both premium and industry templates as requiring a paid plan
//     planRequired:
//       t.category === "premium" || t.category === "industry" ? "premium" : "free",
//   });

//   res
//     .status(201)
//     .json(
//       new ApiResponse(201, { resumeId: r._id, resume: r }, "Resume created")
//     );
// });

// export const getMyResumes = catchAsync(async (req, res) => {
//   const items = await Resume.find({ owner: req.user._id })
//     .populate("template", "name slug category thumbnailUrl")
//     .sort({ updatedAt: -1 })
//     .limit(5); // Limit to prevent overload

//   // Format items with template info
//   const formatted = items.map((r) => ({
//     _id: r._id,
//     title: r.title,
//     templateName: r.template?.name || "No Template",
//     templateSlug: r.template?.slug || "",
//     thumbnailUrl: r.template?.thumbnailUrl || "",
//     updatedAt: r.updatedAt,
//   }));

//   res.json(new ApiResponse(200, { items: formatted, count: formatted.length }));
// });

// export const duplicateResume = catchAsync(async (req, res, next) => {
//   const { id } = req.params;
//   const { title } = req.body;

//   // Get the original resume
//   const original = await Resume.findOne({
//     _id: id,
//     owner: req.user._id,
//   }).populate("template");

//   if (!original) {
//     return next(new ApiError(404, "Resume not found"));
//   }

//   // Check resume limit (5 resumes max)
//   const resumeCount = await Resume.countDocuments({ owner: req.user._id });
//   if (resumeCount >= 5) {
//     return next(
//       new ApiError(
//         400,
//         "Resume limit reached. You can create up to 5 resumes. Please delete some resumes to create new ones."
//       )
//     );
//   }

//   // Create duplicate with new title
//   const duplicateTitle = title || `${original.title} (Copy)`;
//   const duplicate = await Resume.create({
//     owner: req.user._id,
//     title: duplicateTitle,
//     template: original.template?._id || original.template,
//     planRequired: original.planRequired || "free",
//     contact: original.contact || {},
//     experience: original.experience || [],
//     education: original.education || [],
//     skills: original.skills || [],
//     projects: original.projects || [],
//     hobbies: original.hobbies || [],
//     awards: original.awards || [],
//     extras: original.extras || {},
//     steps: original.steps || {},
//   });

//   // Populate template before returning
//   const populatedDuplicate = await Resume.findById(duplicate._id)
//     .populate("template", "name slug category thumbnailUrl");

//   // Format response to match getMyResumes format for frontend consistency
//   const formattedDuplicate = {
//     _id: populatedDuplicate._id,
//     id: populatedDuplicate._id,
//     title: populatedDuplicate.title,
//     templateName: populatedDuplicate.template?.name || "Unknown",
//     templateSlug: populatedDuplicate.template?.slug || "",
//     thumbnailUrl: populatedDuplicate.template?.thumbnailUrl || "",
//     updatedAt: populatedDuplicate.updatedAt,
//     template: populatedDuplicate.template, // Keep full template object for compatibility
//   };

//   res
//     .status(201)
//     .json(
//       new ApiResponse(201, { resumeId: populatedDuplicate._id, resume: formattedDuplicate }, "Resume duplicated successfully")
//     );
// });

// export const getResume = catchAsync(async (req, res, next) => {
//   const r = await Resume.findOne({
//     _id: req.params.id,
//     owner: req.user._id,
//   }).populate(
//     "template",
//     "name slug category previewUrl atsOptimized thumbnailUrl"
//   );
//   if (!r) return next(new ApiError(404, "Resume not found"));

//   // Return template slug at top level for easier frontend access
//   const response = {
//     resume: r,
//     templateSlug: r.template?.slug || "",
//   };
//   res.json(new ApiResponse(200, response));
// });

// export const importFromLinkedIn = catchAsync(async (req, res, next) => {
//   const { code, redirectUri, templateSlug } = req.body;
  
//   if (!code || !redirectUri) {
//     return next(new ApiError(400, "LinkedIn authorization code and redirect URI are required"));
//   }

//   // Exchange code for access token
//   const accessToken = await exchangeLinkedInCode(code, redirectUri);
  
//   // Fetch LinkedIn profile data
//   const linkedInData = await fetchLinkedInProfileData(accessToken);
  
//   // Get template (default to first free template if not provided)
//   let template;
//   if (templateSlug) {
//     template = await Template.findOne({ slug: templateSlug, isActive: true });
//   }
//   if (!template) {
//     template = await Template.findOne({ category: "free", isActive: true });
//   }
//   if (!template) {
//     return next(new ApiError(404, "No template available"));
//   }

//   // Check resume limit
//   const resumeCount = await Resume.countDocuments({ owner: req.user._id });
//   if (resumeCount >= 5) {
//     return next(
//       new ApiError(
//         400,
//         "You have reached the maximum limit of 5 resumes. Please delete an old resume to create a new one."
//       )
//     );
//   }

//   // Create resume from LinkedIn data
//   const resume = await Resume.create({
//     owner: req.user._id,
//     title: `${linkedInData.contact.fullName || "LinkedIn"} Resume`,
//     template: template._id,
//     planRequired: template.category === "premium" || template.category === "industry" ? "premium" : "free",
//     contact: linkedInData.contact || {},
//     experience: linkedInData.experience || [],
//     education: linkedInData.education || [],
//     skills: linkedInData.skills || [],
//   });

//   res.status(201).json(
//     new ApiResponse(
//       201,
//       { resumeId: resume._id, resume },
//       "Resume imported from LinkedIn successfully"
//     )
//   );
// });

// export const patchResume = catchAsync(async (req, res, next) => {
//   const allowed = [
//     "contact",
//     "experience",
//     "education",
//     "skills",
//     "projects",
//     "hobbies",
//     "awards",
//     "extras",
//     "steps",
//     "title",
//     "templateSlug",
//   ];
//   const update = {};

//   // Clean up arrays - only include if they have valid entries
//   for (const k of allowed) {
//     if (k in req.body) {
//       if (k === "experience") {
//         const validExp = (req.body[k] || [])
//           .filter((e) => e.title || e.company)
//           .map((e) => ({
//             ...e,
//             // ✅ Fix: Convert "null" strings to actual null/undefined
//             startDate:
//               e.startDate === "null" || e.startDate === ""
//                 ? undefined
//                 : e.startDate,
//             endDate:
//               e.endDate === "null" || e.endDate === "" || e.current
//                 ? undefined
//                 : e.endDate,
//           }));
//         if (validExp.length > 0) update[k] = validExp;
//       } else if (k === "education") {
//         const validEdu = (req.body[k] || [])
//           .filter((e) => e.degree || e.school)
//           .map((e) => ({
//             ...e,
//             // ✅ Fix: Convert "null" strings to actual null/undefined
//             startDate:
//               e.startDate === "null" || e.startDate === ""
//                 ? undefined
//                 : e.startDate,
//             endDate:
//               e.endDate === "null" || e.endDate === "" ? undefined : e.endDate,
//           }));
//         if (validEdu.length > 0) update[k] = validEdu;
//       } else if (k === "skills") {
//         const validSkills = (req.body[k] || []).filter((s) => s.name || s);
//         if (validSkills.length > 0) update[k] = validSkills;
//       } else if (k === "projects") {
//         const validProjects = (req.body[k] || []).filter(
//           (p) => p.name || p.description
//         );
//         if (validProjects.length > 0) update[k] = validProjects;
//       } else if (k === "hobbies") {
//         const validHobbies = (req.body[k] || []).filter((h) => h.name);
//         if (validHobbies.length > 0) update[k] = validHobbies;
//       } else if (k === "awards") {
//         const validAwards = (req.body[k] || []).filter((a) => a.title);
//         if (validAwards.length > 0) update[k] = validAwards;
//       } else {
//         update[k] = req.body[k];
//       }
//     }
//   }

//   // Map frontend flat fields to structured arrays if present
//   const {
//     jobTitle,
//     company,
//     location,
//     start1,
//     end1,
//     start2,
//     end2,
//     experienceText,
//     educationLine,
//     skillsText,
//   } = req.body;

//   // Build experience array from flat fields
//   if (jobTitle || company || experienceText) {
//     const bullets = (experienceText || "")
//       .split("\n")
//       .map((s) => s.trim().replace(/^[-•\u2022]\s*/, ""))
//       .filter(Boolean);

//     const exp = [];
//     if (jobTitle || company) {
//       exp.push({
//         title: jobTitle || "",
//         company: company || "",
//         location: location || "",
//         startDate: start1 || null,
//         endDate: end1 || null,
//         current: !end1,
//         bullets: bullets.slice(0, Math.ceil(bullets.length / 2)),
//       });
//     }
//     if (start2 || end2) {
//       exp.push({
//         title: jobTitle || "",
//         company: company || "",
//         location: location || "",
//         startDate: start2 || null,
//         endDate: end2 || null,
//         current: !end2,
//         bullets: bullets.slice(Math.ceil(bullets.length / 2)),
//       });
//     }
//     if (exp.length) update.experience = exp;
//   }

//   // Build education array
//   if (educationLine || start1 || end1) {
//     update.education = [
//       {
//         degree: educationLine || "",
//         school: "",
//         location: location || "",
//         startDate: start1 || null,
//         endDate: end1 || null,
//         details: [],
//       },
//     ];
//   }

//   // Handle template change
//   if (req.body.templateSlug) {
//     const t = await Template.findOne({
//       slug: req.body.templateSlug,
//       isActive: true,
//     });
//     if (t) {
//       update.template = t._id;
//       update.planRequired = t.category === "premium" ? "premium" : "free";
//     }
//     delete update.templateSlug;
//   }

//   try {
//     const r = await Resume.findOneAndUpdate(
//       { _id: req.params.id, owner: req.user._id },
//       { $set: update },
//       { new: true, runValidators: true }
//     ).populate("template", "slug");
//     if (!r) return next(new ApiError(404, "Resume not found"));
//     res.json(new ApiResponse(200, { resume: r }, "Saved"));
//   } catch (err) {
//     console.error("Resume update error:", err);
//     if (err.name === "ValidationError") {
//       return next(new ApiError(400, `Validation error: ${err.message}`));
//     }
//     throw err;
//   }
// });

// // ✅ Shared helper: Transform resume document to clean data object for rendering
// // This ensures preview and exports use EXACTLY the same data transformation
// const prepareResumeDataForRendering = (r) => {
//   return {
//     title: r.title,
//     contact: {
//       ...r.contact,
//       // Ensure all contact fields are included
//       fullName: r.contact?.fullName || "",
//       email: r.contact?.email || "",
//       phone: r.contact?.phone || "",
//       address: r.contact?.address || "",
//       location: r.contact?.location || r.contact?.address || "",
//       website: r.contact?.website || "",
//       github: r.contact?.github || "",
//       linkedin: r.contact?.linkedin || "",
//       portfolioLink: r.contact?.portfolioLink || "",
//       headline: r.contact?.headline || "",
//       summary: r.contact?.summary || "",
//       professionalSummary:
//         r.contact?.professionalSummary || r.contact?.summary || "",
//     },
//     experience: r.experience || [],
//     education: r.education || [],
//     skills: r.skills || [],
//     projects: r.projects || [],
//     hobbies: r.hobbies || [],
//     awards: r.awards || [],
//     extras: r.extras || {},
//   };
// };

// export const previewHTML = catchAsync(async (req, res, next) => {
//   const resumeId = req.params.id;

//   // Validate resume ID format
//   if (!resumeId || resumeId.length !== 24) {
//     return next(new ApiError(400, "Invalid resume ID format"));
//   }

//   const r = await Resume.findOne({
//     _id: resumeId,
//     owner: req.user._id,
//   }).populate("template", "slug npmPackageName");

//   if (!r) {
//     // Check if resume exists but belongs to another user
//     const exists = await Resume.findById(resumeId);
//     if (exists) {
//       return next(
//         new ApiError(403, "You don't have permission to view this resume")
//       );
//     }
//     return next(new ApiError(404, "Resume not found"));
//   }

//   // Check if template exists
//   if (!r.template || !r.template.slug) {
//     return next(new ApiError(404, "Template not found for this resume"));
//   }

//   // ✅ Use shared data transformation - ensures preview = export
//   const resumeData = prepareResumeDataForRendering(r);
//   const html = await renderResumeHTML(r.template.slug, resumeData);

//   // Set headers to allow iframe embedding and fix CSP issues
//   // Allow Gravatar images (both HTTP and HTTPS), external stylesheets, fonts
//   res.setHeader("X-Frame-Options", "ALLOWALL");
//   res.setHeader(
//     "Content-Security-Policy",
//     "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; img-src 'self' data: blob: http: https:; style-src 'self' 'unsafe-inline' http: https:; style-src-elem 'self' 'unsafe-inline' http: https:; font-src 'self' data: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; connect-src 'self' http: https:; frame-ancestors *;"
//   );

//   res.json(new ApiResponse(200, { html }));
// });

// export const exportTxt = catchAsync(async (req, res, next) => {
//   const r = await Resume.findOne({ _id: req.params.id, owner: req.user._id });
//   if (!r) return next(new ApiError(404, "Resume not found"));

//   const lines = [];
//   lines.push(`# ${r.contact?.fullName || ""}`);
//   lines.push(`${r.contact?.email || ""} | ${r.contact?.phone || ""}`);
//   lines.push(`\nSummary:\n${r.contact?.summary || ""}`);
//   if (r.experience?.length) {
//     lines.push(`\nExperience:`);
//     r.experience.forEach((e) => {
//       lines.push(`- ${e.title} @ ${e.company}`);
//       (e.bullets || []).forEach((b) => lines.push(` • ${b}`));
//     });
//   }
//   if (r.skills?.length)
//     lines.push(`\nSkills: ${r.skills.map((s) => s.name).join(", ")}`);

//   res.setHeader("Content-Type", "text/plain; charset=utf-8");
//   res.setHeader(
//     "Content-Disposition",
//     `attachment; filename="resume-${r._id}.txt"`
//   );
//   res.send(lines.join("\n"));
// });

// export const exportPDF = catchAsync(async (req, res, next) => {
//   const r = await Resume.findOne({
//     _id: req.params.id,
//     owner: req.user._id,
//   }).populate("template");
//   if (!r) return next(new ApiError(404, "Resume not found"));

//   try {
//     // ✅ Use same data transformation as preview - ensures preview = export
//     const resumeData = prepareResumeDataForRendering(r);
//     const html = await renderResumeHTML(r.template.slug, resumeData);
//     const buffer = await generatePDF(html);

//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename="resume-${r._id}.pdf"`
//     );
//     res.send(buffer);
//   } catch (error) {
//     console.error("PDF generation error:", error);
//     return next(new ApiError(500, "Failed to generate PDF: " + error.message));
//   }
// });

// export const exportDOC = catchAsync(async (req, res, next) => {
//   const r = await Resume.findOne({
//     _id: req.params.id,
//     owner: req.user._id,
//   }).populate("template");
//   if (!r) return next(new ApiError(404, "Resume not found"));

//   try {
//     // ✅ Use same data transformation as preview - ensures preview = export
//     const resumeData = prepareResumeDataForRendering(r);
//     const html = await renderResumeHTML(r.template.slug, resumeData);
//     const buffer = await generateWordDOC(html);

//     res.setHeader("Content-Type", "application/msword");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename="resume-${r._id}.doc"`
//     );
//     res.send(buffer);
//   } catch (error) {
//     console.error("Word DOC generation error:", error);
//     return next(new ApiError(500, "Failed to generate Word DOC: " + error.message));
//   }
// });

// export const exportDOCX = catchAsync(async (req, res, next) => {
//   const r = await Resume.findOne({
//     _id: req.params.id,
//     owner: req.user._id,
//   }).populate("template");
//   if (!r) return next(new ApiError(404, "Resume not found"));

//   const buffer = await generateDOCX(r);

//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
//   );
//   res.setHeader(
//     "Content-Disposition",
//     `attachment; filename="resume-${r._id}.docx"`
//   );
//   res.send(buffer);
// });

// export const deleteResume = catchAsync(async (req, res, next) => {
//   const r = await Resume.findOneAndDelete({
//     _id: req.params.id,
//     owner: req.user._id,
//   });
//   if (!r) return next(new ApiError(404, "Resume not found"));
//   res.json(new ApiResponse(200, {}, "Resume deleted"));
// });








import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import Resume from "../models/Resume.js";
import Template from "../models/Template.js";
import User from "../models/User.js";
import Stripe from "stripe";
import { handleSubscriptionUpdate } from "../services/stripe.service.js";
import { renderResumeHTML } from "../services/render.service.js";
import {
  exportPDF as generatePDF,
  exportDOCX as generateDOCX,
  exportWordDOC as generateWordDOC,
} from "../services/export.service.js";
import { exchangeLinkedInCode, fetchLinkedInUserInfo } from "../services/oauth.service.js";
import { fetchLinkedInProfileData } from "../services/linkedin-profile.service.js";


// Add this helper function (anywhere after the imports, before the controllers)
const assertCanDownload = (user, resume) => {
  const isPremiumTemplate =
    resume.template?.category === "premium" ||
    resume.template?.category === "industry";

  if (!isPremiumTemplate) return; // Free templates → always allowed

  // Check if user has a paid plan (professional or premium with active subscription)
  const hasPaidPlan =
    user.subscriptionStatus === "active" &&
    (user.plan === "premium" || user.plan === "professional");

  // Trial users (trialing status with free plan) are NOT allowed to download premium templates
  const isTrialUser =
    user.subscriptionStatus === "trialing" &&
    (!user.plan || user.plan === "free");

  if (!hasPaidPlan || isTrialUser) {
    throw new ApiError(
      403,
      "This is a premium template. Upgrade to a paid plan to download your resume."
    );
  }
};

export const createResume = catchAsync(async (req, res, next) => {
  const { title, templateSlug } = req.body;
  if (!templateSlug) return next(new ApiError(400, "templateSlug is required"));

  const t = await Template.findOne({ slug: templateSlug, isActive: true });
  if (!t) return next(new ApiError(404, "Template not found"));

  // Check premium template access
  // if (t.category === "premium" || t.category === "industry") {
  //   let user = await User.findById(req.user._id);

  //   // If user has a subscription ID, check if it's active, otherwise find active subscription
  //   if (user.stripeSubscriptionId || user.stripeCustomerId) {
  //     try {
  //       const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  //       let subscription = null;
  //       let foundActiveSubscription = false;

  //       // First, try to retrieve the stored subscription
  //       if (user.stripeSubscriptionId) {
  //         try {
  //           subscription = await stripe.subscriptions.retrieve(
  //             user.stripeSubscriptionId
  //           );

  //           // If subscription is active, use it
  //           if (
  //             subscription.status === "active" ||
  //             subscription.status === "trialing"
  //           ) {
  //             foundActiveSubscription = true;
  //           }
  //         } catch (err) {
  //           // Subscription not found or error, will search by customer
  //           console.log(
  //             `Subscription ${user.stripeSubscriptionId} not found or error, searching by customer`
  //           );
  //         }
  //       }

  //       // If stored subscription is not active, search for active subscription by customer
  //       if (!foundActiveSubscription && user.stripeCustomerId) {
  //         try {
  //           const subscriptions = await stripe.subscriptions.list({
  //             customer: user.stripeCustomerId,
  //             status: "all",
  //             limit: 10,
  //           });

  //           // Find the most recent active subscription
  //           const activeSubscription = subscriptions.data.find(
  //             (sub) =>
  //               (sub.status === "active" || sub.status === "trialing") &&
  //               sub.metadata?.userId === req.user._id.toString()
  //           );

  //           if (activeSubscription) {
  //             subscription = activeSubscription;
  //             foundActiveSubscription = true;
  //             console.log(
  //               `✅ Found active subscription ${activeSubscription.id} for user ${req.user._id}`
  //             );
  //           }
  //         } catch (err) {
  //           console.error(
  //             "Error searching subscriptions by customer:",
  //             err.message
  //           );
  //         }
  //       }

  //       // Update user plan if we found an active subscription
  //       if (foundActiveSubscription && subscription) {
  //         await handleSubscriptionUpdate(subscription);
  //         // Reload user after update
  //         user = await User.findById(req.user._id);
  //         console.log(
  //           `✅ Synced subscription for user ${req.user._id}, plan: ${user.plan}, status: ${user.subscriptionStatus}`
  //         );
  //       }
  //     } catch (err) {
  //       console.error("Error syncing subscription:", err.message);
  //       // Continue with existing plan check
  //     }
  //   }

  //   const hasActiveSubscription =
  //     user.subscriptionStatus === "active" ||
  //     user.subscriptionStatus === "trialing";

  //   // Both professional and premium plans can access premium templates
  //   // (since both are paid subscriptions)
  //   const hasPremiumAccess =
  //     hasActiveSubscription &&
  //     (user.plan === "premium" || user.plan === "professional");

  //   if (!hasPremiumAccess) {
  //     // Provide helpful error with current status
  //     const statusMsg = user.stripeSubscriptionId
  //       ? `Subscription ID: ${user.stripeSubscriptionId}, Status: ${
  //           user.subscriptionStatus || "unknown"
  //         }, Plan: ${user.plan || "free"}`
  //       : "No active subscription found";

  //     return next(
  //       new ApiError(
  //         402,
  //         `Premium or Professional plan required for this template. ${statusMsg}. Please upgrade to a paid plan to access premium templates.`
  //       )
  //     );
  //   }
  // }

  // Check resume limit (5 resumes max)
  const resumeCount = await Resume.countDocuments({ owner: req.user._id });
  if (resumeCount >= 5) {
    return next(
      new ApiError(
        400,
        "You have reached the maximum limit of 5 resumes. Please delete an old resume to create a new one."
      )
    );
  }

  // Check if user already has a resume with this exact title and template to prevent duplicates
  const existing = await Resume.findOne({
    owner: req.user._id,
    title: title || "Untitled Resume",
    template: t._id,
  });

  if (existing) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { resumeId: existing._id, resume: existing },
          "Resume already exists"
        )
      );
  }

  const r = await Resume.create({
    owner: req.user._id,
    title: title || "Untitled Resume",
    template: t._id,
    // Treat both premium and industry templates as requiring a paid plan
    planRequired:
      t.category === "premium" || t.category === "industry" ? "premium" : "free",
  });

  res
    .status(201)
    .json(
      new ApiResponse(201, { resumeId: r._id, resume: r }, "Resume created")
    );
});

export const getMyResumes = catchAsync(async (req, res) => {
  const items = await Resume.find({ owner: req.user._id })
    .populate("template", "name slug category thumbnailUrl")
    .sort({ updatedAt: -1 })
    .limit(5); // Limit to prevent overload

  // Format items with template info
  const formatted = items.map((r) => ({
    _id: r._id,
    title: r.title,
    templateName: r.template?.name || "No Template",
    templateSlug: r.template?.slug || "",
    thumbnailUrl: r.template?.thumbnailUrl || "",
    updatedAt: r.updatedAt,
  }));

  res.json(new ApiResponse(200, { items: formatted, count: formatted.length }));
});

export const duplicateResume = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title } = req.body;

  // Get the original resume
  const original = await Resume.findOne({
    _id: id,
    owner: req.user._id,
  }).populate("template");

  if (!original) {
    return next(new ApiError(404, "Resume not found"));
  }

  // Check resume limit (5 resumes max)
  const resumeCount = await Resume.countDocuments({ owner: req.user._id });
  if (resumeCount >= 5) {
    return next(
      new ApiError(
        400,
        "Resume limit reached. You can create up to 5 resumes. Please delete some resumes to create new ones."
      )
    );
  }

  // Create duplicate with new title
  const duplicateTitle = title || `${original.title} (Copy)`;
  const duplicate = await Resume.create({
    owner: req.user._id,
    title: duplicateTitle,
    template: original.template?._id || original.template,
    planRequired: original.planRequired || "free",
    contact: original.contact || {},
    experience: original.experience || [],
    education: original.education || [],
    skills: original.skills || [],
    projects: original.projects || [],
    hobbies: original.hobbies || [],
    awards: original.awards || [],
    extras: original.extras || {},
    steps: original.steps || {},
  });

  // Populate template before returning
  const populatedDuplicate = await Resume.findById(duplicate._id)
    .populate("template", "name slug category thumbnailUrl");

  // Format response to match getMyResumes format for frontend consistency
  const formattedDuplicate = {
    _id: populatedDuplicate._id,
    id: populatedDuplicate._id,
    title: populatedDuplicate.title,
    templateName: populatedDuplicate.template?.name || "Unknown",
    templateSlug: populatedDuplicate.template?.slug || "",
    thumbnailUrl: populatedDuplicate.template?.thumbnailUrl || "",
    updatedAt: populatedDuplicate.updatedAt,
    template: populatedDuplicate.template, // Keep full template object for compatibility
  };

  res
    .status(201)
    .json(
      new ApiResponse(201, { resumeId: populatedDuplicate._id, resume: formattedDuplicate }, "Resume duplicated successfully")
    );
});

export const getResume = catchAsync(async (req, res, next) => {
  const r = await Resume.findOne({
    _id: req.params.id,
    owner: req.user._id,
  }).populate(
    "template",
    "name slug category previewUrl atsOptimized thumbnailUrl"
  );
  if (!r) return next(new ApiError(404, "Resume not found"));

  // Return template slug at top level for easier frontend access
  const response = {
    resume: r,
    templateSlug: r.template?.slug || "",
  };
  res.json(new ApiResponse(200, response));
});

export const importFromLinkedIn = catchAsync(async (req, res, next) => {
  const { code, redirectUri, templateSlug } = req.body;
  
  if (!code || !redirectUri) {
    return next(new ApiError(400, "LinkedIn authorization code and redirect URI are required"));
  }

  // Exchange code for access token
  const accessToken = await exchangeLinkedInCode(code, redirectUri);
  
  // Fetch LinkedIn profile data
  const linkedInData = await fetchLinkedInProfileData(accessToken);
  
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

  // Check resume limit
  const resumeCount = await Resume.countDocuments({ owner: req.user._id });
  if (resumeCount >= 5) {
    return next(
      new ApiError(
        400,
        "You have reached the maximum limit of 5 resumes. Please delete an old resume to create a new one."
      )
    );
  }

  // Create resume from LinkedIn data
  const resume = await Resume.create({
    owner: req.user._id,
    title: `${linkedInData.contact.fullName || "LinkedIn"} Resume`,
    template: template._id,
    planRequired: template.category === "premium" || template.category === "industry" ? "premium" : "free",
    contact: linkedInData.contact || {},
    experience: linkedInData.experience || [],
    education: linkedInData.education || [],
    skills: linkedInData.skills || [],
  });

  res.status(201).json(
    new ApiResponse(
      201,
      { resumeId: resume._id, resume },
      "Resume imported from LinkedIn successfully"
    )
  );
});

export const patchResume = catchAsync(async (req, res, next) => {
  const allowed = [
    "contact",
    "experience",
    "education",
    "skills",
    "projects",
    "hobbies",
    "awards",
    "extras",
    "steps",
    "title",
    "templateSlug",
  ];
  const update = {};

  // Clean up arrays - only include if they have valid entries
  for (const k of allowed) {
    if (k in req.body) {
      if (k === "experience") {
        const validExp = (req.body[k] || [])
          .filter((e) => e.title || e.company)
          .map((e) => ({
            ...e,
            // ✅ Fix: Convert "null" strings to actual null/undefined
            startDate:
              e.startDate === "null" || e.startDate === ""
                ? undefined
                : e.startDate,
            endDate:
              e.endDate === "null" || e.endDate === "" || e.current
                ? undefined
                : e.endDate,
          }));
        if (validExp.length > 0) update[k] = validExp;
      } else if (k === "education") {
        const validEdu = (req.body[k] || [])
          .filter((e) => e.degree || e.school)
          .map((e) => ({
            ...e,
            // ✅ Fix: Convert "null" strings to actual null/undefined
            startDate:
              e.startDate === "null" || e.startDate === ""
                ? undefined
                : e.startDate,
            endDate:
              e.endDate === "null" || e.endDate === "" ? undefined : e.endDate,
          }));
        if (validEdu.length > 0) update[k] = validEdu;
      } else if (k === "skills") {
        const validSkills = (req.body[k] || []).filter((s) => s.name || s);
        if (validSkills.length > 0) update[k] = validSkills;
      } else if (k === "projects") {
        const validProjects = (req.body[k] || []).filter(
          (p) => p.name || p.description
        );
        if (validProjects.length > 0) update[k] = validProjects;
      } else if (k === "hobbies") {
        const validHobbies = (req.body[k] || []).filter((h) => h.name);
        if (validHobbies.length > 0) update[k] = validHobbies;
      } else if (k === "awards") {
        const validAwards = (req.body[k] || []).filter((a) => a.title);
        if (validAwards.length > 0) update[k] = validAwards;
      } else {
        update[k] = req.body[k];
      }
    }
  }

  // Map frontend flat fields to structured arrays if present
  const {
    jobTitle,
    company,
    location,
    start1,
    end1,
    start2,
    end2,
    experienceText,
    educationLine,
    skillsText,
  } = req.body;

  // Build experience array from flat fields
  if (jobTitle || company || experienceText) {
    const bullets = (experienceText || "")
      .split("\n")
      .map((s) => s.trim().replace(/^[-•\u2022]\s*/, ""))
      .filter(Boolean);

    const exp = [];
    if (jobTitle || company) {
      exp.push({
        title: jobTitle || "",
        company: company || "",
        location: location || "",
        startDate: start1 || null,
        endDate: end1 || null,
        current: !end1,
        bullets: bullets.slice(0, Math.ceil(bullets.length / 2)),
      });
    }
    if (start2 || end2) {
      exp.push({
        title: jobTitle || "",
        company: company || "",
        location: location || "",
        startDate: start2 || null,
        endDate: end2 || null,
        current: !end2,
        bullets: bullets.slice(Math.ceil(bullets.length / 2)),
      });
    }
    if (exp.length) update.experience = exp;
  }

  // Build education array
  if (educationLine || start1 || end1) {
    update.education = [
      {
        degree: educationLine || "",
        school: "",
        location: location || "",
        startDate: start1 || null,
        endDate: end1 || null,
        details: [],
      },
    ];
  }

  // Handle template change
  if (req.body.templateSlug) {
    const t = await Template.findOne({
      slug: req.body.templateSlug,
      isActive: true,
    });
    if (t) {
      update.template = t._id;
      update.planRequired = t.category === "premium" ? "premium" : "free";
    }
    delete update.templateSlug;
  }

  try {
    const r = await Resume.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { $set: update },
      { new: true, runValidators: true }
    ).populate("template", "slug");
    if (!r) return next(new ApiError(404, "Resume not found"));
    res.json(new ApiResponse(200, { resume: r }, "Saved"));
  } catch (err) {
    console.error("Resume update error:", err);
    if (err.name === "ValidationError") {
      return next(new ApiError(400, `Validation error: ${err.message}`));
    }
    throw err;
  }
});

// ✅ Shared helper: Transform resume document to clean data object for rendering
// This ensures preview and exports use EXACTLY the same data transformation
const prepareResumeDataForRendering = (r) => {
  return {
    title: r.title,
    contact: {
      ...r.contact,
      // Ensure all contact fields are included
      fullName: r.contact?.fullName || "",
      email: r.contact?.email || "",
      phone: r.contact?.phone || "",
      address: r.contact?.address || "",
      location: r.contact?.location || r.contact?.address || "",
      website: r.contact?.website || "",
      github: r.contact?.github || "",
      linkedin: r.contact?.linkedin || "",
      portfolioLink: r.contact?.portfolioLink || "",
      headline: r.contact?.headline || "",
      summary: r.contact?.summary || "",
      professionalSummary:
        r.contact?.professionalSummary || r.contact?.summary || "",
    },
    experience: r.experience || [],
    education: r.education || [],
    skills: r.skills || [],
    projects: r.projects || [],
    hobbies: r.hobbies || [],
    awards: r.awards || [],
    extras: r.extras || {},
  };
};

export const previewHTML = catchAsync(async (req, res, next) => {
  const resumeId = req.params.id;

  // Validate resume ID format
  if (!resumeId || resumeId.length !== 24) {
    return next(new ApiError(400, "Invalid resume ID format"));
  }

  const r = await Resume.findOne({
    _id: resumeId,
    owner: req.user._id,
  }).populate("template", "slug npmPackageName");

  if (!r) {
    // Check if resume exists but belongs to another user
    const exists = await Resume.findById(resumeId);
    if (exists) {
      return next(
        new ApiError(403, "You don't have permission to view this resume")
      );
    }
    return next(new ApiError(404, "Resume not found"));
  }

  // Check if template exists
  if (!r.template || !r.template.slug) {
    return next(new ApiError(404, "Template not found for this resume"));
  }

  // ✅ Use shared data transformation - ensures preview = export
  const resumeData = prepareResumeDataForRendering(r);
  const html = await renderResumeHTML(r.template.slug, resumeData);

  // Set headers to allow iframe embedding and fix CSP issues
  // Allow Gravatar images (both HTTP and HTTPS), external stylesheets, fonts
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https:; img-src 'self' data: blob: http: https:; style-src 'self' 'unsafe-inline' http: https:; style-src-elem 'self' 'unsafe-inline' http: https:; font-src 'self' data: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; connect-src 'self' http: https:; frame-ancestors *;"
  );

  res.json(new ApiResponse(200, { html }));
});

export const exportTxt = catchAsync(async (req, res, next) => {
  const r = await Resume.findOne({ _id: req.params.id, owner: req.user._id });
  if (!r) return next(new ApiError(404, "Resume not found"));

  const lines = [];
  lines.push(`# ${r.contact?.fullName || ""}`);
  lines.push(`${r.contact?.email || ""} | ${r.contact?.phone || ""}`);
  lines.push(`\nSummary:\n${r.contact?.summary || ""}`);
  if (r.experience?.length) {
    lines.push(`\nExperience:`);
    r.experience.forEach((e) => {
      lines.push(`- ${e.title} @ ${e.company}`);
      (e.bullets || []).forEach((b) => lines.push(` • ${b}`));
    });
  }
  if (r.skills?.length)
    lines.push(`\nSkills: ${r.skills.map((s) => s.name).join(", ")}`);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="resume-${r._id}.txt"`
  );
  res.send(lines.join("\n"));
});

export const exportPDF = catchAsync(async (req, res, next) => {
  const r = await Resume.findOne({
    _id: req.params.id,
    owner: req.user._id,
  }).populate("template");
  if (!r) return next(new ApiError(404, "Resume not found"));

  assertCanDownload(req.user, r);

  try {
    // ✅ Use same data transformation as preview - ensures preview = export
    const resumeData = prepareResumeDataForRendering(r);
    const html = await renderResumeHTML(r.template.slug, resumeData);
    const buffer = await generatePDF(html);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="resume-${r._id}.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    return next(new ApiError(500, "Failed to generate PDF: " + error.message));
  }
});

export const exportDOC = catchAsync(async (req, res, next) => {
  const r = await Resume.findOne({
    _id: req.params.id,
    owner: req.user._id,
  }).populate("template");
  if (!r) return next(new ApiError(404, "Resume not found"));

  assertCanDownload(req.user, r);

  try {
    // ✅ Use same data transformation as preview - ensures preview = export
    const resumeData = prepareResumeDataForRendering(r);
    const html = await renderResumeHTML(r.template.slug, resumeData);
    const buffer = await generateWordDOC(html);

    res.setHeader("Content-Type", "application/msword");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="resume-${r._id}.doc"`
    );
    res.send(buffer);
  } catch (error) {
    console.error("Word DOC generation error:", error);
    return next(new ApiError(500, "Failed to generate Word DOC: " + error.message));
  }
});

export const exportDOCX = catchAsync(async (req, res, next) => {
  const r = await Resume.findOne({
    _id: req.params.id,
    owner: req.user._id,
  }).populate("template");
  if (!r) return next(new ApiError(404, "Resume not found"));

  assertCanDownload(req.user, r);

  const buffer = await generateDOCX(r);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="resume-${r._id}.docx"`
  );
  res.send(buffer);
});

export const deleteResume = catchAsync(async (req, res, next) => {
  const r = await Resume.findOneAndDelete({
    _id: req.params.id,
    owner: req.user._id,
  });
  if (!r) return next(new ApiError(404, "Resume not found"));
  res.json(new ApiResponse(200, {}, "Resume deleted"));
});

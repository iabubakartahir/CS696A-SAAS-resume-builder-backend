import { Router } from "express";
import {
listTemplates,
getTemplate,
listTemplatesGrouped,
getTemplatePreview,
getTemplateThumbnail,
} from "../controllers/template.controller.js";
import { protect } from "../middlewares/auth.js";

const r = Router();

// Public routes for previews (no auth required)
r.get("/:slug/preview", getTemplatePreview);
r.get("/:slug/thumbnail", getTemplateThumbnail);
r.get("/public", listTemplates); // Public route for template listing
r.get("/public/grouped", listTemplatesGrouped); // Public route for grouped templates

// Protected routes
r.get("/", protect, listTemplates);
r.get("/grouped/all", protect, listTemplatesGrouped);
r.get("/:slug", protect, getTemplate);

export default r;
import { Router } from "express";
import { subscribeNewsletter } from "../controllers/newsletter.controller.js";
import { newsletterValidator, validate } from "../middlewares/validate.js";

const router = Router();

router.post("/subscribe", newsletterValidator, validate, subscribeNewsletter);

export default router;


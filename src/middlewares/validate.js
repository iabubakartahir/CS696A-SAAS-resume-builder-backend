import { body, validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

export const signupValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").isLength({ min: 6 }).withMessage("Min 6 chars"),
  body("dob").optional().isISO8601().toDate(),
];

export const loginValidator = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

export const googleValidator = [
  body("idToken")
    .isString()
    .notEmpty()
    .withMessage("Google idToken is required"),
];

export const linkedinValidator = [
  body("code").isString().notEmpty().withMessage("LinkedIn code is required"),
  body("redirectUri")
    .isString()
    .notEmpty()
    .withMessage("redirectUri is required"),
];

export const newsletterValidator = [
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
];

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(400, "Validation failed", errors.array()));
  }
  next();
};

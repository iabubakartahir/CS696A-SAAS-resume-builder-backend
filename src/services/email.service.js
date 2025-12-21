import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";

dotenv.config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "munirmuaaz@gmail.com";
const APP_NAME = process.env.APP_NAME || "AI Resume Builder";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn("⚠️ SENDGRID_API_KEY is not set. Emails will not be sent.");
}

export const sendEmail = async ({ to, subject, html, text }) => {
  if (!SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY missing, skipping email send.");
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error(`Invalid recipient email: ${to}`);
  }
  if (!emailRegex.test(FROM_EMAIL)) {
    throw new Error(`Invalid sender email: ${FROM_EMAIL}`);
  }

  const msg = {
    to,
    from: FROM_EMAIL,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email sent successfully to ${to}`);
  } catch (error) {
    // Log detailed error information
    console.error("❌ SendGrid error details:", {
      code: error.code,
      message: error.message,
      response: error.response?.body,
      errors: error.response?.body?.errors,
    });
    throw error;
  }
};

export const buildVerifyEmail = (token) => {
  const verifyLink = `${FRONTEND_URL}/auth/verify?token=${encodeURIComponent(
    token
  )}`;
  return {
    subject: `${APP_NAME} - Verify your email`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#0f172a; line-height:1.6;">
        <h2 style="margin:0 0 12px 0;">Verify your email</h2>
        <p>Thanks for signing up for ${APP_NAME}. Click the button below to verify your email address.</p>
        <p style="margin:16px 0;">
          <a href="${verifyLink}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:600;">
            Verify Email
          </a>
        </p>
        <p>If the button doesn’t work, copy and paste this link:</p>
        <p style="word-break:break-all;">${verifyLink}</p>
        <p style="color:#64748b;">If you didn’t create an account, you can safely ignore this email.</p>
      </div>
    `,
  };
};

export const buildResetEmail = (token) => {
  const resetLink = `${FRONTEND_URL}/auth/reset-password?token=${encodeURIComponent(
    token
  )}`;
  return {
    subject: `${APP_NAME} - Reset your password`,
    html: `
      <div style="font-family: Arial, sans-serif; color:#0f172a; line-height:1.6;">
        <h2 style="margin:0 0 12px 0;">Reset your password</h2>
        <p>We received a request to reset your password. Click the button below to choose a new password.</p>
        <p style="margin:16px 0;">
          <a href="${resetLink}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:600;">
            Reset Password
          </a>
        </p>
        <p>If you didn’t request this, you can ignore this email.</p>
        <p style="word-break:break-all;">${resetLink}</p>
      </div>
    `,
  };
};



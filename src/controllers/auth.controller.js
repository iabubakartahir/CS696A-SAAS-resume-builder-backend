import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import catchAsync from "../utils/catchAsync.js";
import User from "../models/User.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signVerifyToken,
  verifyVerifyToken,
  signResetToken,
  verifyResetToken,
  cookieOptions,
} from "../services/token.service.js";
import {
  verifyGoogleIdToken,
  exchangeLinkedInCode,
  fetchLinkedInUserInfo,
} from "../services/oauth.service.js";
import { sendEmail, buildVerifyEmail, buildResetEmail } from "../services/email.service.js";

const setRefreshCookie = (res, token) => {
  res.cookie("rt", token, cookieOptions());
};

const authPayload = (user) => ({
  id: user._id.toString(),
  tv: user.tokenVersion,
});

const sendVerificationEmail = async (user) => {
  try {
    const token = signVerifyToken(authPayload(user));
    const email = buildVerifyEmail(token);
    await sendEmail({
      to: user.email,
      subject: email.subject,
      html: email.html,
    });
  } catch (error) {
    // Re-throw with more context
    console.error(`Failed to send verification email to ${user.email}:`, error);
    throw error;
  }
};

// Helper: account deletion grace period (ms), default 30 days
const ACCOUNT_DELETE_GRACE_MS =
  (Number(process.env.ACCOUNT_DELETE_GRACE_DAYS || 30) || 30) *
  24 *
  60 *
  60 *
  1000;

export const signup = catchAsync(async (req, res) => {
  const { name, email, password, dob } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, "Email already in use");

  const user = await User.create({ name, email, password, dob });

  // Send verification email (non-blocking)
  sendVerificationEmail(user).catch((err) =>
    console.error("Verification email send failed:", err)
  );

  const access = signAccessToken(authPayload(user));
  const refresh = signRefreshToken(authPayload(user));
  setRefreshCookie(res, refresh);

  res.status(201).json(
    new ApiResponse(
      201,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          provider: user.provider,
          isVerified: user.isVerified,
        },
        token: access,
      },
      "Account created. Please verify your email."
    )
  );
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid email or password");
  }

  // Handle soft-deleted accounts
  if (user.isDeleted) {
    // If grace period has passed, hard delete on first access
    if (user.deletedAt && Date.now() - user.deletedAt.getTime() > ACCOUNT_DELETE_GRACE_MS) {
      await User.deleteOne({ _id: user._id });
      throw new ApiError(404, "User not found");
    }
    throw new ApiError(
      403,
      "This account has been deleted. Contact support if you need it restored within 30 days."
    );
  }

  const access = signAccessToken(authPayload(user));
  const refresh = signRefreshToken(authPayload(user));
  setRefreshCookie(res, refresh);

  res.json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          provider: user.provider,
          isVerified: user.isVerified,
        },
        token: access,
      },
      "Logged in"
    )
  );
});

export const refresh = catchAsync(async (req, res) => {
  const token = req.cookies?.rt;
  if (!token) {
    // No refresh token - user is not logged in, return 401 without throwing error
    return res.status(401).json({
      success: false,
      message: "No refresh token found",
    });
  }

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
      if (user.isDeleted) {
        // Optionally hard-delete after grace period
        if (user.deletedAt && Date.now() - user.deletedAt.getTime() > ACCOUNT_DELETE_GRACE_MS) {
          await User.deleteOne({ _id: user._id });
        }
        return res.status(401).json({
          success: false,
          message: "Account has been deleted",
        });
      }
    if (decoded.tv !== user.tokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Token invalidated",
      });
    }

    const newAccess = signAccessToken(authPayload(user));
    const newRefresh = signRefreshToken(authPayload(user));
    setRefreshCookie(res, newRefresh);

    res.json(new ApiResponse(200, { token: newAccess }, "Token refreshed"));
  } catch (error) {
    // Invalid or expired refresh token
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
});

export const sendVerification = catchAsync(async (req, res) => {
  if (!req.user) return res.status(401).json(new ApiResponse(401, null, "Not authenticated"));
  if (req.user.isVerified) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Email already verified"));
  }
  try {
    await sendVerificationEmail(req.user);
    res
      .status(200)
      .json(new ApiResponse(200, null, "Verification email sent"));
  } catch (error) {
    console.error("Send verification email error:", error);
    const errorMessage = error.response?.body?.errors?.[0]?.message || error.message || "Failed to send verification email";
    // Check if it's a sender verification issue
    if (errorMessage.includes("sender") || errorMessage.includes("from") || error.code === 400) {
      return res.status(400).json(
        new ApiResponse(400, null, `Email sending failed: The sender email address must be verified in SendGrid. Please verify ${process.env.SENDGRID_FROM_EMAIL || "your sender email"} in your SendGrid account.`)
      );
    }
    return res.status(500).json(
      new ApiResponse(500, null, `Failed to send verification email: ${errorMessage}`)
    );
  }
});

export const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json(new ApiResponse(400, null, "Token missing"));
  let decoded;
  try {
    decoded = verifyVerifyToken(token);
  } catch {
    return res.status(400).json(new ApiResponse(400, null, "Invalid or expired token"));
  }

  const user = await User.findById(decoded.id);
  if (!user) return res.status(404).json(new ApiResponse(404, null, "User not found"));

  if (decoded.tv !== user.tokenVersion) {
    return res.status(400).json(new ApiResponse(400, null, "Token no longer valid"));
  }

  user.isVerified = true;
  await user.save();

  const access = signAccessToken(authPayload(user));
  const refresh = signRefreshToken(authPayload(user));
  setRefreshCookie(res, refresh);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          provider: user.provider,
          isVerified: user.isVerified,
        },
        token: access,
      },
      "Email verified"
    )
  );
});

export const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new ApiError(400, "Email is required");

  const user = await User.findOne({ email });
  if (!user) {
    // Don't reveal if email exists or not (security best practice)
    return res
      .status(200)
      .json(new ApiResponse(200, null, "If the email exists, a reset link was sent"));
  }

  try {
    const token = signResetToken(authPayload(user));
    const emailContent = buildResetEmail(token);
    await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
    res
      .status(200)
      .json(new ApiResponse(200, null, "If the email exists, a reset link was sent"));
  } catch (error) {
    console.error("Send reset password email error:", error);
    const errorMessage = error.response?.body?.errors?.[0]?.message || error.message || "Failed to send reset email";
    if (errorMessage.includes("sender") || errorMessage.includes("from") || error.code === 400) {
      return res.status(400).json(
        new ApiResponse(400, null, `Email sending failed: The sender email address must be verified in SendGrid. Please verify ${process.env.SENDGRID_FROM_EMAIL || "your sender email"} in your SendGrid account.`)
      );
    }
    return res.status(500).json(
      new ApiResponse(500, null, `Failed to send reset email: ${errorMessage}`)
    );
  }
});

export const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new ApiError(400, "Token and password are required");

  let decoded;
  try {
    decoded = verifyResetToken(token);
  } catch {
    throw new ApiError(400, "Invalid or expired token");
  }

  const user = await User.findById(decoded.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");
  if (decoded.tv !== user.tokenVersion) throw new ApiError(400, "Token no longer valid");

  user.password = password;
  user.tokenVersion += 1;
  await user.save();

  res
    .status(200)
    .json(new ApiResponse(200, null, "Password reset successful"));
});

export const logout = catchAsync(async (req, res) => {
  const token = req.cookies?.rt;
  if (token) {
    try {
      const decoded = verifyRefreshToken(token);
      await User.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });
    } catch {
      /* ignore */
    }
  }
  res.clearCookie("rt", { ...cookieOptions(), maxAge: 0 });
  res.json(new ApiResponse(200, {}, "Logged out"));
});

export const deleteAccount = catchAsync(async (req, res) => {
  if (!req.user) throw new ApiError(401, "Not authenticated");

  const now = new Date();

  // Soft delete: mark account as deleted and record timestamp.
  // Tokens are invalidated via tokenVersion bump; user is logged out.
  await User.findByIdAndUpdate(
    req.user._id,
    {
      isDeleted: true,
      deletedAt: now,
      $inc: { tokenVersion: 1 },
    },
    { new: true }
  );

  res.clearCookie("rt", { ...cookieOptions(), maxAge: 0 });
  res.json(
    new ApiResponse(
      200,
      null,
      "Your account has been deleted. Your data will be retained for up to 30 days, after which it may be permanently removed."
    )
  );
});

// Self-service restore endpoint for soft-deleted accounts within grace period
export const restoreAccount = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(400, "Invalid email or password");
  }

  if (!user.isDeleted) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "Account is not deleted"));
  }

  if (
    user.deletedAt &&
    Date.now() - user.deletedAt.getTime() > ACCOUNT_DELETE_GRACE_MS
  ) {
    throw new ApiError(
      400,
      "The 30-day deletion grace period has expired. The account can no longer be restored."
    );
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    throw new ApiError(400, "Invalid email or password");
  }

  user.isDeleted = false;
  user.deletedAt = null;
  user.tokenVersion += 1; // Invalidate old tokens
  await user.save();

  const access = signAccessToken(authPayload(user));
  const refresh = signRefreshToken(authPayload(user));
  setRefreshCookie(res, refresh);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          provider: user.provider,
          isVerified: user.isVerified,
        },
        token: access,
      },
      "Account restored successfully"
    )
  );
});

export const me = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json(new ApiResponse(200, { user }, "Current user"));
});

export const google = catchAsync(async (req, res) => {
  const { idToken } = req.body;
  const profile = await verifyGoogleIdToken(idToken);
  if (!profile.email) throw new ApiError(400, "Google account has no email");

  let user = await User.findOne({ email: profile.email });
  if (user && user.isDeleted) {
    if (user.deletedAt && Date.now() - user.deletedAt.getTime() > ACCOUNT_DELETE_GRACE_MS) {
      await User.deleteOne({ _id: user._id });
      user = null;
    } else {
      throw new ApiError(
        403,
        "This account has been deleted. Contact support if you need it restored within 30 days."
      );
    }
  }

  if (!user) {
    user = await User.create({
      name: profile.name || "Google User",
      email: profile.email,
      password: cryptoRandomPassword(),
      provider: "google",
      isVerified: profile.emailVerified ?? false,
    });
  }

  const access = signAccessToken(authPayload(user));
  const refresh = signRefreshToken(authPayload(user));
  setRefreshCookie(res, refresh);
  res.json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          provider: user.provider,
          isVerified: user.isVerified,
        },
        token: access,
      },
      "Logged in"
    )
  );
});

export const linkedin = catchAsync(async (req, res) => {
  const { code, redirectUri } = req.body;
  const accessToken = await exchangeLinkedInCode(code, redirectUri);
  const info = await fetchLinkedInUserInfo(accessToken);
  if (!info.email) throw new ApiError(400, "LinkedIn user has no email");

  let user = await User.findOne({ email: info.email });
  if (user && user.isDeleted) {
    if (user.deletedAt && Date.now() - user.deletedAt.getTime() > ACCOUNT_DELETE_GRACE_MS) {
      await User.deleteOne({ _id: user._id });
      user = null;
    } else {
      throw new ApiError(
        403,
        "This account has been deleted. Contact support if you need it restored within 30 days."
      );
    }
  }

  if (!user) {
    user = await User.create({
      name: info.name || "LinkedIn User",
      email: info.email,
      password: cryptoRandomPassword(),
      provider: "linkedin",
      isVerified: info.emailVerified ?? true,
    });
  }

  const access = signAccessToken(authPayload(user));
  const refresh = signRefreshToken(authPayload(user));
  setRefreshCookie(res, refresh);
  res.json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          provider: user.provider,
          isVerified: user.isVerified,
        },
        token: access,
      },
      "Logged in"
    )
  );
});

const cryptoRandomPassword = () =>
  Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

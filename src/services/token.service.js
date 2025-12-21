import jwt from "jsonwebtoken";

export const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_TTL || "15m",
  });

export const signVerifyToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "30m",
  });

export const verifyVerifyToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

export const signResetToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "30m",
  });

export const verifyResetToken = (token) =>
  jwt.verify(token, process.env.JWT_ACCESS_SECRET);

export const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_TTL || "1d",
  });

export const verifyRefreshToken = (token) =>
  jwt.verify(token, process.env.JWT_REFRESH_SECRET);

export const cookieOptions = () => {
  const ttl = process.env.JWT_REFRESH_TTL || "1d";
  const maxAge = ttl.endsWith("d")
    ? Number(ttl.slice(0, -1)) * 24 * 3600 * 1000
    : ttl.endsWith("h")
    ? Number(ttl.slice(0, -1)) * 3600 * 1000
    : ttl.endsWith("m")
    ? Number(ttl.slice(0, -1)) * 60 * 1000
    : 24 * 3600 * 1000;

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // In cross-site deployments (frontend domain != API domain), set COOKIE_SAMESITE=none
    sameSite: process.env.COOKIE_SAMESITE || "lax",
    domain: process.env.COOKIE_DOMAIN || "localhost",
    path: "/",
    maxAge,
  };
};

// src/services/oauth.service.js
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const verifyGoogleIdToken = async (idToken) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
  };
};

export const exchangeLinkedInCode = async (code, redirectUri) => {
  const params = new URLSearchParams();
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", redirectUri);
  params.append("client_id", process.env.LINKEDIN_CLIENT_ID || "");
  params.append("client_secret", process.env.LINKEDIN_CLIENT_SECRET || "");

  const resp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LinkedIn token exchange failed: ${resp.status} ${text}`);
  }
  const json = await resp.json();
  return json.access_token;
};

export const fetchLinkedInUserInfo = async (accessToken) => {
  // Prefer OpenID Connect userinfo endpoint when scopes include: openid profile email
  const resp = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LinkedIn userinfo failed: ${resp.status} ${text}`);
  }
  const info = await resp.json();
  return {
    sub: info.sub,
    email: info.email,
    emailVerified: true,
    name:
      info.name || `${info.given_name || ""} ${info.family_name || ""}`.trim(),
    picture: info.picture,
  };
};


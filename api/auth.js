import { timingSafeEqual } from "node:crypto";
import {
  clearSessionCookie,
  createSession,
  sessionCookie,
  verifySession,
} from "./_session.js";

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  const aa = Buffer.from(a);
  const bb = Buffer.from(b);

  if (aa.length !== bb.length) {
    return false;
  }

  return timingSafeEqual(aa, bb);
}

function bodyOf(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

function loginConfiguration() {
  return {
    username: String(process.env.WALLET_LOGIN_USER || "").trim(),
    password: String(process.env.WALLET_LOGIN_PASSWORD || ""),
    sessionSecret: String(process.env.WALLET_SESSION_SECRET || "").trim(),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    try {
      const session = verifySession(req);

      return res.status(200).json({
        authenticated: Boolean(session),
        username: session?.username || null,
      });
    } catch (error) {
      console.error("Session validation failed:", error);
      return res.status(500).json({
        authenticated: false,
        error: "Login configuration is incomplete.",
      });
    }
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearSessionCookie());

    return res.status(200).json({
      success: true,
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({
      error: "Method not allowed.",
    });
  }

  const config = loginConfiguration();

  if (!config.username || !config.password || !config.sessionSecret) {
    console.error(
      "Wallet login is not fully configured. Required: WALLET_LOGIN_USER, WALLET_LOGIN_PASSWORD, WALLET_SESSION_SECRET."
    );

    return res.status(500).json({
      error: "Wallet login is not configured on the server.",
    });
  }

  const { username, password } = bodyOf(req);
  const submittedUser = typeof username === "string" ? username.trim() : "";
  const submittedPassword = typeof password === "string" ? password : "";

  if (
    !safeEqual(submittedUser, config.username) ||
    !safeEqual(submittedPassword, config.password)
  ) {
    return res.status(401).json({
      error: "Invalid username or password.",
    });
  }

  try {
    const token = createSession(config.username);
    res.setHeader("Set-Cookie", sessionCookie(token));

    return res.status(200).json({
      success: true,
      username: config.username,
    });
  } catch (error) {
    console.error("Session creation failed:", error);
    return res.status(500).json({
      error: "Could not create the login session.",
    });
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "wallet_session";
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getSessionSecret() {
  const value = String(process.env.WALLET_SESSION_SECRET || "").trim();

  if (!value) {
    throw new Error("WALLET_SESSION_SECRET is not configured.");
  }

  return value;
}

function sign(value) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createSession(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expires: Date.now() + SESSION_LIFETIME_MS,
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function readCookies(req) {
  const cookieHeader = String(req.headers?.cookie || "");
  const cookies = {};

  for (const part of cookieHeader.split(";")) {
    const value = part.trim();
    if (!value) continue;

    const separator = value.indexOf("=");
    if (separator <= 0) continue;

    const name = value.slice(0, separator).trim();
    const content = value.slice(separator + 1);
    cookies[name] = content;
  }

  return cookies;
}

export function verifySession(req) {
  const token = readCookies(req)[COOKIE_NAME];

  if (!token) {
    return null;
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) {
    return null;
  }

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = sign(payload);

  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (!data?.username || !data?.expires || Date.now() > data.expires) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  return [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/wallets",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ].join("; ");
}

export function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/wallets",
    "Max-Age=0",
  ].join("; ");
}

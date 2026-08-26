import { randomUUID } from "node:crypto";
import { verifySession } from "./_session.js";

const DEFAULT_CIRCLE_BASE_URL = "https://api.circle.com";
const DEFAULT_BLOCKCHAIN = "ETH-SEPOLIA";

function getBody(req) {
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

async function readCircleResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: "Circle returned a non-JSON response",
      raw: text.slice(0, 1000),
    };
  }
}

function send(res, status, body) {
  return res.status(status).json(body);
}

function requireApiKey(res) {
  const apiKey = String(process.env.CIRCLE_API_KEY || "").trim();

  if (!apiKey) {
    send(res, 500, {
      error:
        "CIRCLE_API_KEY is not configured on the server. Add it to .env.local or Vercel Environment Variables.",
    });
    return null;
  }

  return apiKey;
}

async function circleFetch(path, { method = "GET", body, userToken } = {}) {
  const apiKey = String(process.env.CIRCLE_API_KEY || "").trim();
  const baseUrl = String(
    process.env.CIRCLE_BASE_URL || DEFAULT_CIRCLE_BASE_URL
  ).replace(/\/+$/, "");

  const headers = {
    accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (userToken) {
    headers["X-User-Token"] = userToken;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await readCircleResponse(response);
  return { response, data };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  let session;

  try {
    session = verifySession(req);
  } catch (error) {
    console.error("Session validation failed:", error);
    return send(res, 500, {
      error: "Login configuration is incomplete.",
    });
  }

  if (!session) {
    return send(res, 401, {
      code: "WALLET_LOGIN_REQUIRED",
      error: "Authentication required.",
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Only POST is allowed" });
  }

  if (!requireApiKey(res)) return;

  const body = getBody(req);
  const { action, ...params } = body;

  if (!action) {
    return send(res, 400, { error: "Missing action" });
  }

  try {
    switch (action) {
      case "requestEmailOtp": {
        const { deviceId, email } = params;

        if (!deviceId || !email) {
          return send(res, 400, { error: "Missing deviceId or email" });
        }

        const { response, data } = await circleFetch(
          "/v1/w3s/users/email/token",
          {
            method: "POST",
            body: {
              idempotencyKey: randomUUID(),
              deviceId,
              email,
            },
          }
        );

        if (!response.ok) {
          return send(res, response.status, data);
        }

        return send(res, 200, data.data || data);
      }

      case "initializeUser": {
        const { userToken } = params;

        if (!userToken) {
          return send(res, 400, { error: "Missing userToken" });
        }

        const blockchain =
          process.env.CIRCLE_BLOCKCHAIN || DEFAULT_BLOCKCHAIN;

        const { response, data } = await circleFetch(
          "/v1/w3s/user/initialize",
          {
            method: "POST",
            userToken,
            body: {
              idempotencyKey: randomUUID(),
              accountType: "SCA",
              blockchains: [blockchain],
            },
          }
        );

        if (!response.ok) {
          return send(res, response.status, data);
        }

        return send(res, 200, data.data || data);
      }

      case "listWallets": {
        const { userToken } = params;

        if (!userToken) {
          return send(res, 400, { error: "Missing userToken" });
        }

        const { response, data } = await circleFetch("/v1/w3s/wallets", {
          userToken,
        });

        if (!response.ok) {
          return send(res, response.status, data);
        }

        return send(res, 200, data.data || data);
      }

      case "getTokenBalance": {
        const { userToken, walletId } = params;

        if (!userToken || !walletId) {
          return send(res, 400, {
            error: "Missing userToken or walletId",
          });
        }

        const safeWalletId = encodeURIComponent(walletId);

        const { response, data } = await circleFetch(
          `/v1/w3s/wallets/${safeWalletId}/balances`,
          { userToken }
        );

        if (!response.ok) {
          return send(res, response.status, data);
        }

        return send(res, 200, data.data || data);
      }

      default:
        return send(res, 400, { error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error("Circle API endpoint error:", error);
    return send(res, 500, {
      error: "Internal server error",
      message: error?.message || String(error),
    });
  }
}

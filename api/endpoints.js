import { randomUUID } from "node:crypto";

const DEFAULT_CIRCLE_BASE_URL = "https://api.circle.com";
const ARC_MAINNET_RPC = "https://rpc.mainnet.arc.io";
const ARC_MAINNET_USDC = "0x3600000000000000000000000000000000000000";

const NETWORKS = Object.freeze({
  "ETH-SEPOLIA": {
    label: "Ethereum Sepolia",
    environment: "testnet",
    walletBlockchain: "ETH-SEPOLIA",
    accountType: "SCA",
    balanceMode: "circle",
  },
  "ARC-TESTNET": {
    label: "Arc Testnet",
    environment: "testnet",
    walletBlockchain: "ARC-TESTNET",
    accountType: "SCA",
    balanceMode: "circle",
    chainId: 5042002,
    rpc: "https://rpc.testnet.arc.io",
    explorer: "https://explorer.testnet.arc.io",
    usdcAddress: ARC_MAINNET_USDC,
  },
  "ARC-MAINNET": {
    label: "Arc Mainnet",
    environment: "mainnet",
    // Circle currently exposes unsupported EVM mainnets through the generic EVM code.
    // For User-Controlled Wallets this is EOA-only.
    walletBlockchain: "EVM",
    accountType: "EOA",
    balanceMode: "arc-rpc",
    chainId: 5042,
    rpc: ARC_MAINNET_RPC,
    explorer: "https://explorer.arc.io",
    usdcAddress: ARC_MAINNET_USDC,
  },
});

function getNetwork(value) {
  const key = String(value || "").trim().toUpperCase();
  const network = NETWORKS[key];

  if (!network) {
    throw new Error(`Unsupported target network: ${key || "<empty>"}`);
  }

  return { key, ...network };
}

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

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: "Remote service returned a non-JSON response", raw: text.slice(0, 1000) };
  }
}

function send(res, status, body) {
  return res.status(status).json(body);
}

function keyMatchesEnvironment(key, environment) {
  if (!key) return false;
  if (environment === "mainnet") return key.startsWith("LIVE_API_KEY:");
  return key.startsWith("TEST_API_KEY:");
}

function getApiKey(network) {
  const legacyKey = String(process.env.CIRCLE_API_KEY || "").trim();

  const explicitKey = network.environment === "mainnet"
    ? String(process.env.CIRCLE_LIVE_API_KEY || "").trim()
    : String(process.env.CIRCLE_TEST_API_KEY || "").trim();

  const apiKey = explicitKey || (keyMatchesEnvironment(legacyKey, network.environment) ? legacyKey : "");

  if (!apiKey) {
    const variable = network.environment === "mainnet"
      ? "CIRCLE_LIVE_API_KEY"
      : "CIRCLE_TEST_API_KEY";
    throw new Error(`${variable} is not configured on the server.`);
  }

  if (!keyMatchesEnvironment(apiKey, network.environment)) {
    throw new Error(
      network.environment === "mainnet"
        ? "Arc Mainnet requires a LIVE_API_KEY."
        : "Testnet requires a TEST_API_KEY."
    );
  }

  return apiKey;
}

async function circleFetch(network, path, { method = "GET", body, userToken } = {}) {
  const apiKey = getApiKey(network);
  const baseUrl = String(process.env.CIRCLE_BASE_URL || DEFAULT_CIRCLE_BASE_URL).replace(/\/+$/, "");

  const headers = {
    accept: "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (userToken) headers["X-User-Token"] = userToken;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await readJsonResponse(response);
  return { response, data };
}

function toPublicNetwork(network) {
  return {
    targetNetwork: network.key,
    label: network.label,
    environment: network.environment,
    walletBlockchain: network.walletBlockchain,
    accountType: network.accountType,
    chainId: network.chainId || null,
    rpc: network.rpc || null,
    explorer: network.explorer || null,
    usdcAddress: network.usdcAddress || null,
  };
}

function normalizeAddress(address) {
  const value = String(address || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error("Invalid EVM wallet address.");
  }
  return value.toLowerCase();
}

function encodeBalanceOf(address) {
  const normalized = normalizeAddress(address).slice(2);
  return `0x70a08231${normalized.padStart(64, "0")}`;
}

function formatUnits(value, decimals = 6) {
  const amount = BigInt(value);
  const base = 10n ** BigInt(decimals);
  const whole = amount / base;
  const fraction = (amount % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function getArcMainnetUsdcBalance(address) {
  const response = await fetch(ARC_MAINNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [
        {
          to: ARC_MAINNET_USDC,
          data: encodeBalanceOf(address),
        },
        "latest",
      ],
    }),
  });

  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(data?.error?.message || `Arc RPC HTTP ${response.status}`);
  }
  if (data?.error) {
    throw new Error(data.error.message || "Arc RPC returned an error.");
  }
  if (typeof data?.result !== "string") {
    throw new Error("Arc RPC returned no balance result.");
  }

  return formatUnits(BigInt(data.result), 6);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Only POST is allowed" });
  }

  const body = getBody(req);
  const { action, blockchain: requestedNetwork, ...params } = body;

  if (!action) return send(res, 400, { error: "Missing action" });

  try {
    const network = getNetwork(requestedNetwork);

    switch (action) {
      case "getClientConfig": {
        const { response, data } = await circleFetch(network, "/v1/w3s/config/entity");
        if (!response.ok) return send(res, response.status, data);

        const appId = data?.data?.appId || data?.appId;
        if (!appId) return send(res, 502, { error: "Circle did not return an appId." });

        return send(res, 200, {
          appId,
          network: toPublicNetwork(network),
        });
      }

      case "requestEmailOtp": {
        const { deviceId, email } = params;
        if (!deviceId || !email) return send(res, 400, { error: "Missing deviceId or email" });

        const { response, data } = await circleFetch(network, "/v1/w3s/users/email/token", {
          method: "POST",
          body: { idempotencyKey: randomUUID(), deviceId, email },
        });

        if (!response.ok) return send(res, response.status, data);
        return send(res, 200, data.data || data);
      }

      case "initializeUser": {
        const { userToken } = params;
        if (!userToken) return send(res, 400, { error: "Missing userToken" });

        const { response, data } = await circleFetch(network, "/v1/w3s/user/initialize", {
          method: "POST",
          userToken,
          body: {
            idempotencyKey: randomUUID(),
            accountType: network.accountType,
            blockchains: [network.walletBlockchain],
          },
        });

        if (!response.ok) return send(res, response.status, data);
        return send(res, 200, data.data || data);
      }

      case "createWallet": {
        const { userToken } = params;
        if (!userToken) return send(res, 400, { error: "Missing userToken" });

        const { response, data } = await circleFetch(network, "/v1/w3s/user/wallets", {
          method: "POST",
          userToken,
          body: {
            idempotencyKey: randomUUID(),
            accountType: network.accountType,
            blockchains: [network.walletBlockchain],
          },
        });

        if (!response.ok) return send(res, response.status, data);
        return send(res, 200, data.data || data);
      }

      case "listWallets": {
        const { userToken } = params;
        if (!userToken) return send(res, 400, { error: "Missing userToken" });

        const { response, data } = await circleFetch(network, "/v1/w3s/wallets", { userToken });
        if (!response.ok) return send(res, response.status, data);
        return send(res, 200, data.data || data);
      }

      case "getTokenBalance": {
        const { userToken, walletId, walletAddress } = params;

        if (network.balanceMode === "arc-rpc") {
          if (!walletAddress) return send(res, 400, { error: "Missing walletAddress" });
          const amount = await getArcMainnetUsdcBalance(walletAddress);
          return send(res, 200, {
            amount,
            symbol: "USDC",
            tokenAddress: ARC_MAINNET_USDC,
            source: "arc-mainnet-rpc",
          });
        }

        if (!userToken || !walletId) {
          return send(res, 400, { error: "Missing userToken or walletId" });
        }

        const safeWalletId = encodeURIComponent(walletId);
        const { response, data } = await circleFetch(
          network,
          `/v1/w3s/wallets/${safeWalletId}/balances`,
          { userToken }
        );

        if (!response.ok) return send(res, response.status, data);
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

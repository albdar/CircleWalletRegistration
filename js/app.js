import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

const baseUrl = import.meta.env.BASE_URL;
const apiEndpoint = `${baseUrl}api/endpoints`;
const ALLOWED_TARGETS = new Set(["ETH-SEPOLIA", "ARC-TESTNET", "ARC-MAINNET"]);

const ui = {
  email: document.querySelector("#email"),
  networkSelect: document.querySelector("#networkSelect"),
  btnSendOtp: document.querySelector("#btnSendOtp"),
  btnVerifyOtp: document.querySelector("#btnVerifyOtp"),
  btnInitialize: document.querySelector("#btnInitialize"),
  btnCreateWallet: document.querySelector("#btnCreateWallet"),
  btnRefresh: document.querySelector("#btnRefresh"),
  btnReset: document.querySelector("#btnReset"),
  btnCopyAddress: document.querySelector("#btnCopyAddress"),
  sdkBadge: document.querySelector("#sdkBadge"),
  statusBox: document.querySelector("#statusBox"),
  deviceId: document.querySelector("#deviceId"),
  authState: document.querySelector("#authState"),
  targetNetwork: document.querySelector("#targetNetwork"),
  accountType: document.querySelector("#accountType"),
  environment: document.querySelector("#environment"),
  chainId: document.querySelector("#chainId"),
  walletCard: document.querySelector("#walletCard"),
  walletId: document.querySelector("#walletId"),
  walletAddress: document.querySelector("#walletAddress"),
  walletBlockchain: document.querySelector("#walletBlockchain"),
  walletUsdc: document.querySelector("#walletUsdc"),
  debug: document.querySelector("#debug"),
};

const savedTarget = localStorage.getItem("circleTargetNetwork");

const state = {
  sdk: null,
  sdkReady: false,
  appId: "",
  network: null,
  deviceId: "",
  deviceToken: "",
  deviceEncryptionKey: "",
  otpToken: "",
  userToken: "",
  encryptionKey: "",
  challengeId: "",
  wallets: [],
  usdcBalance: null,
  email: "",
  selectedBlockchain: ALLOWED_TARGETS.has(savedTarget) ? savedTarget : "ARC-MAINNET",
};

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

function setStatus(message, type = "info") {
  ui.statusBox.textContent = message;
  ui.statusBox.className = `status status-${type}`;
}

function setSdkBadge(text, kind = "waiting") {
  ui.sdkBadge.textContent = text;
  ui.sdkBadge.className = `badge badge-${kind}`;
}

function apiErrorMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  const message = data.message || data.error || data.data?.message;
  const code = data.code || data.data?.code;
  if (code && message) return `[${code}] ${message}`;
  return message || fallback;
}

function selectedWallet() {
  if (!state.network) return null;
  return state.wallets.find((wallet) => wallet.blockchain === state.network.walletBlockchain) || null;
}

function clearSession({ keepEmail = true } = {}) {
  state.deviceToken = "";
  state.deviceEncryptionKey = "";
  state.otpToken = "";
  state.userToken = "";
  state.encryptionKey = "";
  state.challengeId = "";
  state.wallets = [];
  state.usdcBalance = null;
  if (!keepEmail) {
    state.email = "";
    ui.email.value = "";
  }
}

function publicDebugState() {
  return {
    sdkReady: state.sdkReady,
    selectedBlockchain: state.selectedBlockchain,
    circleEnvironment: state.network?.environment || null,
    circleWalletBlockchain: state.network?.walletBlockchain || null,
    accountType: state.network?.accountType || null,
    deviceId: state.deviceId,
    otpSessionReady: Boolean(state.deviceToken && state.deviceEncryptionKey && state.otpToken),
    authenticated: Boolean(state.userToken && state.encryptionKey),
    challengeId: state.challengeId || null,
    wallets: state.wallets,
    usdcBalance: state.usdcBalance,
  };
}

function render() {
  ui.networkSelect.value = state.selectedBlockchain;
  ui.targetNetwork.textContent = state.network?.label || state.selectedBlockchain;
  ui.accountType.textContent = state.network?.accountType || "–";
  ui.environment.textContent = state.network?.environment || "–";
  ui.chainId.textContent = state.network?.chainId || "–";
  ui.deviceId.textContent = state.deviceId || "–";
  ui.authState.textContent = state.userToken
    ? `Email verified${state.email ? `: ${state.email}` : ""}`
    : "Not signed in";

  const hasOtpSession = state.deviceToken && state.deviceEncryptionKey && state.otpToken;
  const authenticated = state.userToken && state.encryptionKey;
  const wallet = selectedWallet();
  const hasWallet = Boolean(wallet);

  ui.btnSendOtp.disabled = !state.sdkReady || !state.deviceId || !ui.email.value.trim();
  ui.btnVerifyOtp.disabled = !state.sdkReady || !hasOtpSession || Boolean(authenticated);
  ui.btnInitialize.disabled = !authenticated || Boolean(state.challengeId) || hasWallet;
  ui.btnCreateWallet.disabled = !authenticated || !state.challengeId || hasWallet;
  ui.btnRefresh.disabled = !authenticated;

  if (hasWallet) {
    ui.walletCard.classList.remove("hidden");
    ui.walletId.textContent = wallet.id || "–";
    ui.walletAddress.textContent = wallet.address || "–";
    ui.walletBlockchain.textContent = state.selectedBlockchain === "ARC-MAINNET"
      ? `${wallet.blockchain || "EVM"} (Arc Mainnet)`
      : wallet.blockchain || "–";
    ui.walletUsdc.textContent = state.usdcBalance === null ? "–" : `${state.usdcBalance} USDC`;
  } else {
    ui.walletCard.classList.add("hidden");
  }

  ui.debug.textContent = JSON.stringify(publicDebugState(), null, 2);
}

async function callApi(action, params = {}) {
  const response = await fetch(apiEndpoint, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, blockchain: state.selectedBlockchain, ...params }),
  });

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    const err = new Error(apiErrorMessage(data, `HTTP ${response.status}`));
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function initializeSdk() {
  state.sdkReady = false;
  state.sdk = null;
  state.appId = "";
  state.network = null;
  state.deviceId = "";
  setSdkBadge("SDK starting…", "waiting");
  render();

  try {
    const config = await callApi("getClientConfig");
    state.appId = config.appId;
    state.network = config.network;

    const onLoginComplete = async (error, result) => {
      if (error || !result) {
        console.error("Circle Email OTP login failed:", error);
        setStatus(error?.message || "Email authentication failed.", "error");
        state.userToken = "";
        state.encryptionKey = "";
        render();
        return;
      }

      state.userToken = result.userToken;
      state.encryptionKey = result.encryptionKey;

      try {
        state.sdk.setAuthentication({
          userToken: state.userToken,
          encryptionKey: state.encryptionKey,
        });
      } catch (authError) {
        console.warn("Circle SDK authentication setup warning:", authError);
      }

      setStatus("Email verified. Loading your existing Circle wallet…", "success");
      render();
      await loadWallets("login");
    };

    state.sdk = new W3SSdk({ appSettings: { appId: state.appId } }, onLoginComplete);
    state.sdkReady = true;

    const deviceCacheKey = `circleDeviceId:${state.network.environment}`;
    const cached = localStorage.getItem(deviceCacheKey);
    if (cached) {
      state.deviceId = cached;
    } else {
      state.deviceId = await state.sdk.getDeviceId();
      localStorage.setItem(deviceCacheKey, state.deviceId);
    }

    setSdkBadge(state.network.environment === "mainnet" ? "LIVE ready" : "TEST ready", "ok");
    setStatus(
      `Circle ${state.network.environment} environment is ready. Target: ${state.network.label}. Enter an email address and send the OTP.`
    );
    render();
  } catch (error) {
    console.error(error);
    setSdkBadge("Configuration error", "error");
    setStatus(`Circle configuration could not be loaded: ${error.message}`, "error");
    render();
  }
}

async function requestOtp() {
  const email = ui.email.value.trim();
  if (!email || !state.deviceId) return;
  state.email = email;

  try {
    clearSession({ keepEmail: true });
    state.email = email;
    render();
    setStatus("Requesting OTP from Circle…");

    const data = await callApi("requestEmailOtp", {
      deviceId: state.deviceId,
      email,
    });

    state.deviceToken = data.deviceToken;
    state.deviceEncryptionKey = data.deviceEncryptionKey;
    state.otpToken = data.otpToken;

    state.sdk.updateConfigs({
      appSettings: { appId: state.appId },
      loginConfigs: {
        deviceToken: data.deviceToken,
        deviceEncryptionKey: data.deviceEncryptionKey,
        otpToken: data.otpToken,
        email: { email },
      },
    });

    setStatus("OTP has been sent. Open the email and then click “Verify OTP”.", "success");
    render();
  } catch (error) {
    console.error(error);
    setStatus(`OTP could not be sent: ${error.message}`, "error");
    render();
  }
}

function verifyOtp() {
  if (!state.sdk) return;
  try {
    setStatus("Opening the Circle OTP window…");
    state.sdk.verifyOtp();
  } catch (error) {
    console.error(error);
    setStatus(`The OTP window could not be opened: ${error.message}`, "error");
  }
}

async function initializeUser() {
  if (!state.userToken || !state.network) return;

  try {
    setStatus(`Preparing ${state.network.label} ${state.network.accountType} wallet…`);

    const data = await callApi("initializeUser", { userToken: state.userToken });
    state.challengeId = data.challengeId;
    if (!state.challengeId) throw new Error("Circle did not return a challengeId.");

    setStatus(`${state.network.label} wallet challenge is ready. Click “Create Wallet”.`, "success");
    render();
  } catch (error) {
    const circleCode = Number(error?.data?.code ?? error?.data?.data?.code);

    if (circleCode === 155106) {
      try {
        const data = await callApi("createWallet", { userToken: state.userToken });
        state.challengeId = data.challengeId;
        if (!state.challengeId) throw new Error("Circle did not return a challengeId.");

        setStatus(`${state.network.label} additional-wallet challenge is ready. Click “Create Wallet”.`, "success");
        render();
        return;
      } catch (createError) {
        console.error(createError);
        setStatus(`Wallet preparation failed: ${createError.message}`, "error");
        render();
        return;
      }
    }

    console.error(error);
    setStatus(`Initialization failed: ${error.message}`, "error");
    render();
  }
}

function createWallet() {
  if (!state.sdk || !state.challengeId) return;

  try {
    state.sdk.setAuthentication({ userToken: state.userToken, encryptionKey: state.encryptionKey });
    setStatus("Executing wallet challenge…");

    state.sdk.execute(state.challengeId, (error) => {
      if (error) {
        console.error("Challenge failed:", error);
        setStatus(`Wallet could not be created: ${error?.message || "Unknown error"}`, "error");
        return;
      }

      setStatus("Challenge completed. Loading wallet data…");
      window.setTimeout(async () => {
        state.challengeId = "";
        await loadWallets("afterCreate");
      }, 2000);
    });
  } catch (error) {
    console.error(error);
    setStatus(`Challenge could not be started: ${error.message}`, "error");
  }
}

async function loadWallets(source = "refresh") {
  if (!state.userToken || !state.network) return;

  try {
    setStatus("Loading wallet data…");
    const data = await callApi("listWallets", { userToken: state.userToken });
    state.wallets = Array.isArray(data.wallets) ? data.wallets : [];

    if (!state.wallets.length) {
      state.usdcBalance = null;
      setStatus(`Email verified, but no Circle wallets exist yet. Click “Prepare Wallet” to create a ${state.network.label} wallet.`, "info");
      render();
      return;
    }

    const wallet = selectedWallet();
    if (!wallet) {
      state.usdcBalance = null;
      setStatus(`No ${state.network.label} wallet exists yet. Click “Prepare Wallet” to create one.`, "info");
      render();
      return;
    }

    await loadUsdcBalance(wallet);

    if (source === "afterCreate") {
      setStatus(`${state.network.accountType} wallet was created successfully.`, "success");
    } else if (source === "login") {
      setStatus(`${state.network.label} wallet loaded successfully.`, "success");
    } else {
      setStatus("Wallet data refreshed successfully.", "success");
    }
    render();
  } catch (error) {
    console.error(error);
    setStatus(`Wallet data could not be loaded: ${error.message}`, "error");
    render();
  }
}

async function loadUsdcBalance(wallet) {
  try {
    const data = await callApi("getTokenBalance", {
      userToken: state.userToken,
      walletId: wallet.id,
      walletAddress: wallet.address,
    });

    if (typeof data.amount === "string") {
      state.usdcBalance = data.amount;
      return;
    }

    const balances = Array.isArray(data.tokenBalances) ? data.tokenBalances : [];
    const usdc = balances.find((entry) => {
      const symbol = entry?.token?.symbol || "";
      const name = entry?.token?.name || "";
      return symbol.startsWith("USDC") || name.includes("USDC");
    });
    state.usdcBalance = usdc?.amount ?? "0";
  } catch (error) {
    console.warn("USDC balance could not be loaded:", error);
    state.usdcBalance = "not available";
  }
}

function resetTest() {
  clearSession({ keepEmail: false });
  setStatus("Signed out locally. Enter an email address to sign in again.");
  render();
}

async function copyAddress() {
  const address = selectedWallet()?.address;
  if (!address) return;

  try {
    await navigator.clipboard.writeText(address);
    const old = ui.btnCopyAddress.textContent;
    ui.btnCopyAddress.textContent = "Copied";
    window.setTimeout(() => { ui.btnCopyAddress.textContent = old; }, 1300);
  } catch {
    setStatus("Wallet address could not be copied to the clipboard.", "error");
  }
}

ui.networkSelect.addEventListener("change", async () => {
  state.selectedBlockchain = ui.networkSelect.value;
  localStorage.setItem("circleTargetNetwork", state.selectedBlockchain);
  clearSession({ keepEmail: true });
  setStatus("Changing Circle environment…");
  await initializeSdk();
});

ui.email.addEventListener("input", render);
ui.btnSendOtp.addEventListener("click", requestOtp);
ui.btnVerifyOtp.addEventListener("click", verifyOtp);
ui.btnInitialize.addEventListener("click", initializeUser);
ui.btnCreateWallet.addEventListener("click", createWallet);
ui.btnRefresh.addEventListener("click", () => loadWallets("refresh"));
ui.btnReset.addEventListener("click", resetTest);
ui.btnCopyAddress.addEventListener("click", copyAddress);

render();
initializeSdk();

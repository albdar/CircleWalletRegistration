import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

const appId = import.meta.env.VITE_CIRCLE_APP_ID;
const baseUrl = import.meta.env.BASE_URL;
const apiEndpoint = `${baseUrl}api/endpoints`;
const authEndpoint = `${baseUrl}api/auth`;

const authUi = {
  loginView: document.querySelector("#loginView"),
  walletView: document.querySelector("#walletView"),
  loginForm: document.querySelector("#loginForm"),
  loginUser: document.querySelector("#loginUser"),
  loginPassword: document.querySelector("#loginPassword"),
  btnLogin: document.querySelector("#btnLogin"),
  btnLogout: document.querySelector("#btnLogout"),
  loginStatus: document.querySelector("#loginStatus"),
  loggedInUser: document.querySelector("#loggedInUser"),
};

const ui = {
  email: document.querySelector("#email"),
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
  walletCard: document.querySelector("#walletCard"),
  walletId: document.querySelector("#walletId"),
  walletAddress: document.querySelector("#walletAddress"),
  walletBlockchain: document.querySelector("#walletBlockchain"),
  walletUsdc: document.querySelector("#walletUsdc"),
  debug: document.querySelector("#debug"),
};

const state = {
  sdk: null,
  sdkReady: false,
  deviceId: "",
  deviceToken: "",
  deviceEncryptionKey: "",
  otpToken: "",
  userToken: "",
  encryptionKey: "",
  challengeId: "",
  wallets: [],
  usdcBalance: null,
};

function setLoginStatus(message, type = "info") {
  authUi.loginStatus.textContent = message;
  authUi.loginStatus.className = `status status-${type}`;
}

function showLogin(message = "Enter your username and password.", type = "info") {
  authUi.walletView.classList.add("hidden");
  authUi.loginView.classList.remove("hidden");
  authUi.loginPassword.value = "";
  setLoginStatus(message, type);

  window.setTimeout(() => {
    authUi.loginUser.focus();
  }, 0);
}

function showWallet(username) {
  authUi.loggedInUser.textContent = username || "–";
  authUi.loginView.classList.add("hidden");
  authUi.walletView.classList.remove("hidden");
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: text,
    };
  }
}

async function login(event) {
  event?.preventDefault();

  const username = authUi.loginUser.value.trim();
  const password = authUi.loginPassword.value;

  if (!username || !password) {
    setLoginStatus("Enter both username and password.", "error");
    return;
  }

  authUi.btnLogin.disabled = true;
  setLoginStatus("Signing in…");

  try {
    const response = await fetch(authEndpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      setLoginStatus(data.error || "Login failed.", "error");
      return;
    }

    setLoginStatus("Login successful. Loading wallet application…", "success");

    // Reload after login so all in-memory Circle state starts cleanly under
    // the newly authenticated server session.
    window.location.reload();
  } catch (error) {
    console.error("Wallet login failed:", error);
    setLoginStatus(
      `Login request failed: ${error?.message || String(error)}`,
      "error"
    );
  } finally {
    authUi.btnLogin.disabled = false;
  }
}

async function logout() {
  authUi.btnLogout.disabled = true;

  try {
    await fetch(authEndpoint, {
      method: "DELETE",
      credentials: "same-origin",
    });
  } catch (error) {
    console.error("Wallet logout failed:", error);
  } finally {
    // Reload clears all Circle tokens held only in JavaScript memory.
    window.location.reload();
  }
}

async function checkApplicationLogin() {
  try {
    const response = await fetch(authEndpoint, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    const data = await parseJsonResponse(response);

    if (!response.ok) {
      showLogin(data.error || "Could not verify the login session.", "error");
      return false;
    }

    if (!data.authenticated) {
      showLogin();
      return false;
    }

    showWallet(data.username);
    return true;
  } catch (error) {
    console.error("Login session check failed:", error);
    showLogin(
      `Could not verify the login session: ${error?.message || String(error)}`,
      "error"
    );
    return false;
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

function publicDebugState() {
  // Intentionally do not display userToken/encryptionKey/deviceEncryptionKey values.
  return {
    sdkReady: state.sdkReady,
    deviceId: state.deviceId,
    otpSessionReady: Boolean(
      state.deviceToken && state.deviceEncryptionKey && state.otpToken
    ),
    authenticated: Boolean(state.userToken && state.encryptionKey),
    challengeId: state.challengeId || null,
    wallets: state.wallets,
    usdcBalance: state.usdcBalance,
  };
}

function render() {
  ui.deviceId.textContent = state.deviceId || "–";
  ui.authState.textContent = state.userToken ? "Email verified" : "Not signed in";

  const hasOtpSession =
    state.deviceToken && state.deviceEncryptionKey && state.otpToken;
  const authenticated = state.userToken && state.encryptionKey;
  const hasWallet = state.wallets.length > 0;

  ui.btnSendOtp.disabled =
    !state.sdkReady || !state.deviceId || !ui.email.value.trim();

  ui.btnVerifyOtp.disabled =
    !state.sdkReady || !hasOtpSession || Boolean(authenticated);

  ui.btnInitialize.disabled =
    !authenticated || Boolean(state.challengeId) || hasWallet;

  ui.btnCreateWallet.disabled =
    !authenticated || !state.challengeId || hasWallet;

  ui.btnRefresh.disabled = !authenticated;

  if (hasWallet) {
    const wallet = state.wallets[0];
    ui.walletCard.classList.remove("hidden");
    ui.walletId.textContent = wallet.id || "–";
    ui.walletAddress.textContent = wallet.address || "–";
    ui.walletBlockchain.textContent = wallet.blockchain || "–";
    ui.walletUsdc.textContent =
      state.usdcBalance === null ? "–" : state.usdcBalance;
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
    body: JSON.stringify({ action, ...params }),
  });

  const data = await parseJsonResponse(response);

  if (!response.ok) {
    const err = new Error(apiErrorMessage(data, `HTTP ${response.status}`));
    err.status = response.status;
    err.data = data;

    if (response.status === 401 && data.code === "WALLET_LOGIN_REQUIRED") {
      err.loginRequired = true;
      showLogin("Your login session has expired. Please sign in again.", "error");
    }

    throw err;
  }

  return data;
}

async function initializeSdk() {
  if (state.sdkReady && state.sdk) {
    return;
  }

  if (!appId || appId === "YOUR_CIRCLE_APP_ID") {
    setSdkBadge("Configuration missing", "error");
    setStatus(
      "VITE_CIRCLE_APP_ID is missing. Add the Circle App ID to .env.local or Vercel and deploy again.",
      "error"
    );
    return;
  }

  try {
    const onLoginComplete = (error, result) => {
      if (error || !result) {
        console.error("Circle Email OTP login failed:", error);
        setStatus(
          error?.message || "Email authentication failed.",
          "error"
        );
        state.userToken = "";
        state.encryptionKey = "";
        render();
        return;
      }

      state.userToken = result.userToken;
      state.encryptionKey = result.encryptionKey;

      setStatus(
        "Email successfully verified. Next, initialize the user.",
        "success"
      );
      render();
    };

    state.sdk = new W3SSdk(
      {
        appSettings: { appId },
      },
      onLoginComplete
    );

    state.sdkReady = true;
    setSdkBadge("SDK ready", "ok");
    setStatus("Circle SDK is ready. Enter an email address and send the OTP.");

    const cached = localStorage.getItem("circleDeviceId");
    if (cached) {
      state.deviceId = cached;
    } else {
      state.deviceId = await state.sdk.getDeviceId();
      localStorage.setItem("circleDeviceId", state.deviceId);
    }

    render();
  } catch (error) {
    console.error(error);
    setSdkBadge("SDK error", "error");
    setStatus(
      `Circle SDK could not be initialized: ${error?.message || error}`,
      "error"
    );
    render();
  }
}

async function requestOtp() {
  const email = ui.email.value.trim();

  if (!email || !state.deviceId) return;

  try {
    // Start a new Circle login session.
    state.deviceToken = "";
    state.deviceEncryptionKey = "";
    state.otpToken = "";
    state.userToken = "";
    state.encryptionKey = "";
    state.challengeId = "";
    state.wallets = [];
    state.usdcBalance = null;
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
      appSettings: { appId },
      loginConfigs: {
        deviceToken: data.deviceToken,
        deviceEncryptionKey: data.deviceEncryptionKey,
        otpToken: data.otpToken,
        email: { email },
      },
    });

    setStatus(
      "OTP has been sent. Open the email and then click “Verify OTP”.",
      "success"
    );
    render();
  } catch (error) {
    if (error.loginRequired) return;
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
  if (!state.userToken) return;

  try {
    setStatus("Initializing Circle user…");

    const data = await callApi("initializeUser", {
      userToken: state.userToken,
    });

    state.challengeId = data.challengeId;

    if (!state.challengeId) {
      throw new Error("Circle did not return a challengeId.");
    }

    setStatus(
      "User initialized. Now click “Create Wallet”.",
      "success"
    );
    render();
  } catch (error) {
    if (error.loginRequired) return;

    const circleCode = Number(error?.data?.code ?? error?.data?.data?.code);

    // Circle: User is already initialized.
    if (circleCode === 155106) {
      state.challengeId = "";
      setStatus(
        "The Circle user is already initialized. Loading the existing wallet."
      );
      await loadWallets("alreadyInitialized");
      return;
    }

    console.error(error);
    setStatus(`Initialization failed: ${error.message}`, "error");
    render();
  }
}

function createWallet() {
  if (!state.sdk || !state.challengeId) return;

  try {
    state.sdk.setAuthentication({
      userToken: state.userToken,
      encryptionKey: state.encryptionKey,
    });

    setStatus("Executing wallet challenge…");

    state.sdk.execute(state.challengeId, (error) => {
      if (error) {
        console.error("Challenge failed:", error);
        setStatus(
          `Wallet could not be created: ${error?.message || "Unknown error"}`,
          "error"
        );
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
  if (!state.userToken) return;

  try {
    setStatus("Loading wallet data…");

    const data = await callApi("listWallets", {
      userToken: state.userToken,
    });

    state.wallets = Array.isArray(data.wallets) ? data.wallets : [];

    if (!state.wallets.length) {
      state.usdcBalance = null;
      setStatus(
        "No wallet found yet. If it was just created, please refresh again in a few seconds."
      );
      render();
      return;
    }

    const primaryWallet =
      state.wallets.find((w) => w.blockchain === "ETH-SEPOLIA") ||
      state.wallets[0];

    // Display the preferred wallet first.
    state.wallets = [
      primaryWallet,
      ...state.wallets.filter((w) => w.id !== primaryWallet.id),
    ];

    await loadUsdcBalance(primaryWallet.id);

    if (source === "afterCreate") {
      setStatus("SCA wallet was created successfully.", "success");
    } else if (source === "alreadyInitialized") {
      setStatus("Existing Circle wallet loaded successfully.", "success");
    } else {
      setStatus("Wallet data refreshed successfully.", "success");
    }

    render();
  } catch (error) {
    if (error.loginRequired) return;
    console.error(error);
    setStatus(`Wallet data could not be loaded: ${error.message}`, "error");
    render();
  }
}

async function loadUsdcBalance(walletId) {
  try {
    const data = await callApi("getTokenBalance", {
      userToken: state.userToken,
      walletId,
    });

    const balances = Array.isArray(data.tokenBalances)
      ? data.tokenBalances
      : [];

    const usdc = balances.find((entry) => {
      const symbol = entry?.token?.symbol || "";
      const name = entry?.token?.name || "";
      return symbol.startsWith("USDC") || name.includes("USDC");
    });

    state.usdcBalance = usdc?.amount ?? "0";
  } catch (error) {
    if (error.loginRequired) return;
    console.warn("USDC balance could not be loaded:", error);
    state.usdcBalance = "not available";
  }
}

function resetTest() {
  state.deviceToken = "";
  state.deviceEncryptionKey = "";
  state.otpToken = "";
  state.userToken = "";
  state.encryptionKey = "";
  state.challengeId = "";
  state.wallets = [];
  state.usdcBalance = null;
  ui.email.value = "";
  setStatus("Test reset. Enter a new email address.");
  render();
}

async function copyAddress() {
  const address = state.wallets[0]?.address;
  if (!address) return;

  try {
    await navigator.clipboard.writeText(address);
    const old = ui.btnCopyAddress.textContent;
    ui.btnCopyAddress.textContent = "Copied";
    window.setTimeout(() => {
      ui.btnCopyAddress.textContent = old;
    }, 1300);
  } catch {
    setStatus("Wallet address could not be copied to the clipboard.", "error");
  }
}

async function startApplication() {
  render();

  const authenticated = await checkApplicationLogin();
  if (!authenticated) {
    return;
  }

  await initializeSdk();
}

authUi.loginForm.addEventListener("submit", login);
authUi.btnLogout.addEventListener("click", logout);
ui.email.addEventListener("input", render);
ui.btnSendOtp.addEventListener("click", requestOtp);
ui.btnVerifyOtp.addEventListener("click", verifyOtp);
ui.btnInitialize.addEventListener("click", initializeUser);
ui.btnCreateWallet.addEventListener("click", createWallet);
ui.btnRefresh.addEventListener("click", () => loadWallets("refresh"));
ui.btnReset.addEventListener("click", resetTest);
ui.btnCopyAddress.addEventListener("click", copyAddress);

startApplication();

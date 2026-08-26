import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

const appId = import.meta.env.VITE_CIRCLE_APP_ID;

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
  // Absichtlich keine userToken/encryptionKey/deviceEncryptionKey-Werte anzeigen.
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
  ui.authState.textContent = state.userToken ? "E-Mail verifiziert" : "Nicht angemeldet";

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
  const response = await fetch("/api/endpoints", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    const err = new Error(apiErrorMessage(data, `HTTP ${response.status}`));
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

async function initializeSdk() {
  if (!appId || appId === "YOUR_CIRCLE_APP_ID") {
    setSdkBadge("Konfiguration fehlt", "error");
    setStatus(
      "VITE_CIRCLE_APP_ID fehlt. Trage die Circle App ID in .env.local ein und starte den Server neu.",
      "error"
    );
    return;
  }

  try {
    const onLoginComplete = (error, result) => {
      if (error || !result) {
        console.error("Circle Email OTP Login fehlgeschlagen:", error);
        setStatus(
          error?.message || "E-Mail-Authentifizierung fehlgeschlagen.",
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
        "E-Mail erfolgreich verifiziert. Als Nächstes den User initialisieren.",
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
    setSdkBadge("SDK bereit", "ok");
    setStatus("Circle SDK ist bereit. E-Mail-Adresse eingeben und OTP senden.");

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
    setSdkBadge("SDK Fehler", "error");
    setStatus(
      `Circle SDK konnte nicht initialisiert werden: ${error?.message || error}`,
      "error"
    );
    render();
  }
}

async function requestOtp() {
  const email = ui.email.value.trim();

  if (!email || !state.deviceId) return;

  try {
    // Neue Login-Session.
    state.deviceToken = "";
    state.deviceEncryptionKey = "";
    state.otpToken = "";
    state.userToken = "";
    state.encryptionKey = "";
    state.challengeId = "";
    state.wallets = [];
    state.usdcBalance = null;
    render();

    setStatus("OTP wird über Circle angefordert…");

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
      "OTP wurde versendet. Öffne die E-Mail und klicke danach auf „OTP bestätigen“.",
      "success"
    );
    render();
  } catch (error) {
    console.error(error);
    setStatus(`OTP konnte nicht gesendet werden: ${error.message}`, "error");
    render();
  }
}

function verifyOtp() {
  if (!state.sdk) return;

  try {
    setStatus("Circle OTP-Fenster wird geöffnet…");
    state.sdk.verifyOtp();
  } catch (error) {
    console.error(error);
    setStatus(`OTP-Fenster konnte nicht geöffnet werden: ${error.message}`, "error");
  }
}

async function initializeUser() {
  if (!state.userToken) return;

  try {
    setStatus("Circle User wird initialisiert…");

    const data = await callApi("initializeUser", {
      userToken: state.userToken,
    });

    state.challengeId = data.challengeId;

    if (!state.challengeId) {
      throw new Error("Circle hat keine challengeId zurückgegeben.");
    }

    setStatus(
      "User initialisiert. Jetzt „Wallet erstellen“ ausführen.",
      "success"
    );
    render();
  } catch (error) {
    const circleCode = Number(error?.data?.code ?? error?.data?.data?.code);

    // Circle: User ist bereits initialisiert.
    if (circleCode === 155106) {
      state.challengeId = "";
      setStatus(
        "Der Circle User ist bereits initialisiert. Bestehende Wallet wird geladen."
      );
      await loadWallets("alreadyInitialized");
      return;
    }

    console.error(error);
    setStatus(`Initialisierung fehlgeschlagen: ${error.message}`, "error");
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

    setStatus("Wallet-Challenge wird ausgeführt…");

    state.sdk.execute(state.challengeId, (error) => {
      if (error) {
        console.error("Challenge fehlgeschlagen:", error);
        setStatus(
          `Wallet konnte nicht erstellt werden: ${error?.message || "Unbekannter Fehler"}`,
          "error"
        );
        return;
      }

      setStatus("Challenge ausgeführt. Wallet-Daten werden geladen…");

      window.setTimeout(async () => {
        state.challengeId = "";
        await loadWallets("afterCreate");
      }, 2000);
    });
  } catch (error) {
    console.error(error);
    setStatus(`Challenge konnte nicht gestartet werden: ${error.message}`, "error");
  }
}

async function loadWallets(source = "refresh") {
  if (!state.userToken) return;

  try {
    setStatus("Wallet-Daten werden geladen…");

    const data = await callApi("listWallets", {
      userToken: state.userToken,
    });

    state.wallets = Array.isArray(data.wallets) ? data.wallets : [];

    if (!state.wallets.length) {
      state.usdcBalance = null;
      setStatus(
        "Noch keine Wallet gefunden. Falls sie gerade erstellt wurde, bitte in wenigen Sekunden erneut aktualisieren."
      );
      render();
      return;
    }

    const primaryWallet =
      state.wallets.find((w) => w.blockchain === "ETH-SEPOLIA") ||
      state.wallets[0];

    // Gewünschte Wallet als erste anzeigen.
    state.wallets = [
      primaryWallet,
      ...state.wallets.filter((w) => w.id !== primaryWallet.id),
    ];

    await loadUsdcBalance(primaryWallet.id);

    if (source === "afterCreate") {
      setStatus("SCA-Wallet wurde erfolgreich erstellt.", "success");
    } else if (source === "alreadyInitialized") {
      setStatus("Bestehende Circle Wallet wurde geladen.", "success");
    } else {
      setStatus("Wallet-Daten wurden aktualisiert.", "success");
    }

    render();
  } catch (error) {
    console.error(error);
    setStatus(`Wallet-Daten konnten nicht geladen werden: ${error.message}`, "error");
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
    console.warn("USDC Balance konnte nicht geladen werden:", error);
    state.usdcBalance = "nicht verfügbar";
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
  setStatus("Test zurückgesetzt. Neue E-Mail-Adresse eingeben.");
  render();
}

async function copyAddress() {
  const address = state.wallets[0]?.address;
  if (!address) return;

  try {
    await navigator.clipboard.writeText(address);
    const old = ui.btnCopyAddress.textContent;
    ui.btnCopyAddress.textContent = "Kopiert";
    window.setTimeout(() => {
      ui.btnCopyAddress.textContent = old;
    }, 1300);
  } catch {
    setStatus("Wallet-Adresse konnte nicht in die Zwischenablage kopiert werden.", "error");
  }
}

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

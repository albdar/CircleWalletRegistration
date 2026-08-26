# Circle Wallet Registration

Vanilla JavaScript test application for Circle User-Controlled Wallets with:

- Application login with username and password
- Server-side signed HttpOnly session cookie
- Email OTP
- Circle Web SDK
- Smart Contract Account (`SCA`)
- Ethereum Sepolia (`ETH-SEPOLIA`)
- Vercel Serverless API
- Wallet address display
- Optional USDC balance display

## 1. Requirements

- Node.js 22 or newer
- Circle Developer Account
- Circle API Key
- Circle User-Controlled Wallet App ID
- Email OTP configured for the Circle application

## 2. Environment variables

Copy `.env.example` to `.env.local` for local development and replace all placeholders.

Required variables:

```text
CIRCLE_API_KEY=YOUR_CIRCLE_API_KEY
VITE_CIRCLE_APP_ID=YOUR_CIRCLE_APP_ID
CIRCLE_BLOCKCHAIN=ETH-SEPOLIA
CIRCLE_BASE_URL=https://api.circle.com
WALLET_LOGIN_USER=walletadmin
WALLET_LOGIN_PASSWORD=YOUR_STRONG_PASSWORD
WALLET_SESSION_SECRET=YOUR_LONG_RANDOM_SECRET
```

Generate a session secret, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Important:

- `CIRCLE_API_KEY`, `WALLET_LOGIN_USER`, `WALLET_LOGIN_PASSWORD`, and `WALLET_SESSION_SECRET` are server-only values.
- Never prefix those values with `VITE_`.
- `VITE_CIRCLE_APP_ID` is intentionally available to the browser.
- `.env.local` is ignored by Git and must not be pushed to GitHub.

## 3. Install dependencies

```powershell
npm install
```

## 4. Local development

Because the project uses Vercel Serverless Functions under `/api`, start it with Vercel Dev:

```powershell
npm run dev:vercel
```

The Vite-only command can be used for frontend-only work, but the API functions are not available there:

```powershell
npm run dev
```

## 5. Login flow

When the application opens, it first calls `/wallets/api/auth` to check the signed server session.

If there is no valid session, the user sees the login screen. After a successful login, the server sets an HttpOnly, Secure, SameSite=Lax cookie valid for eight hours. The Circle API endpoint rejects requests without that session.

Use **Sign Out** to delete the session cookie and clear the in-memory Circle state by reloading the page.

## 6. Circle wallet flow

After application login:

1. Enter an email address.
2. Send OTP.
3. Verify OTP in the Circle window.
4. Initialize the Circle user.
5. Create the SCA wallet.
6. Refresh the wallet if required.
7. Review the wallet address and USDC balance.

## 7. Vercel configuration

Add all environment variables to the `circlewalletregistration` Vercel project. `VITE_CIRCLE_APP_ID` must be available during the build. The secret values remain server-side.

After changing environment variables, redeploy the project.

The project is configured with the Vite base path:

```text
/wallets/
```

The wallet project's `vercel.json` maps `/wallets/assets/...` and `/wallets/api/...` to its generated assets and serverless API routes so it can also be tested directly.

# Circle Wallet Registration — Circle OTP Only

This version removes the separate application username/password login.

The application now starts directly with Circle User-Controlled Wallet authentication:

```text
Email
  ↓
Send OTP
  ↓
Verify OTP with Circle
  ↓
Existing Circle wallet is loaded automatically
```

If the verified Circle user does not yet have a wallet, the UI enables:

```text
Initialize New User
  ↓
Create New Wallet
```

## Required environment variables

Copy `.env.example` to `.env.local` for local development:

```text
CIRCLE_API_KEY=YOUR_CIRCLE_API_KEY
VITE_CIRCLE_APP_ID=YOUR_CIRCLE_APP_ID
CIRCLE_BLOCKCHAIN=ETH-SEPOLIA
CIRCLE_BASE_URL=https://api.circle.com
```

The old variables are no longer needed and can be deleted from Vercel:

```text
WALLET_LOGIN_USER
WALLET_LOGIN_PASSWORD
WALLET_SESSION_SECRET
```

## Local start

```powershell
npm install
npm run dev:vercel
```

## Production / Vercel

Set the Circle variables in:

```text
Vercel
→ Project
→ Settings
→ Environment Variables
```

Then redeploy.

The configured base path remains:

```text
/wallets/
```

so the application is intended to be opened at:

```text
https://www.lexsecure.biz/wallets/
```

when the domain/project routing is configured accordingly.

## Security note

There is no longer a separate application password. Access to a user's Circle wallet is protected by Circle's email OTP flow. The Circle API key remains server-side in the Vercel function and must never be exposed with a `VITE_` prefix.

For a public production service, consider adding rate limiting to the OTP endpoint to reduce abuse/spam.


## Fix: OTP `parseJsonResponse is not defined`

This corrected package restores the shared `parseJsonResponse()` helper that is used by
the Circle API calls. The previous OTP-only package accidentally removed this helper
while removing the legacy username/password login.

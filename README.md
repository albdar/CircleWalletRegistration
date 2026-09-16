# Circle Wallet Registration — Arc Mainnet + Testnet

This version supports:

- Arc Mainnet
- Arc Testnet
- Ethereum Sepolia
- Circle User-Controlled Wallets with email OTP
- automatic Circle App ID lookup per environment
- Arc Mainnet USDC balance via the official Arc RPC

## Important Arc Mainnet detail

As of 16 September 2026, Circle Wallets documents Arc Testnet explicitly as `ARC-TESTNET`, but Arc Mainnet is not yet listed as a dedicated Circle Wallets chain code.

For Arc Mainnet this application therefore uses Circle's documented generic mainnet chain code:

```text
EVM
```

For User-Controlled Wallets, generic `EVM` supports EOA wallets, not SCA wallets. The UI still labels the target correctly as `ARC-MAINNET`.

Arc Mainnet network values used by the app:

```text
Chain ID: 5042
RPC: https://rpc.mainnet.arc.io
Explorer: https://explorer.arc.io
USDC ERC-20 interface: 0x3600000000000000000000000000000000000000
USDC decimals: 6
```

## Vercel environment variables

In Vercel:

```text
Project -> Settings -> Environment Variables
```

Set:

```text
CIRCLE_LIVE_API_KEY=LIVE_API_KEY:...
CIRCLE_TEST_API_KEY=TEST_API_KEY:...
CIRCLE_BASE_URL=https://api.circle.com
```

If you only want Arc Mainnet, `CIRCLE_LIVE_API_KEY` is enough.

The old browser variable `VITE_CIRCLE_APP_ID` is no longer required. The backend gets the App ID from Circle's `/v1/w3s/config/entity` endpoint using the key for the selected environment.

## Circle Console requirement for LIVE

The LIVE environment must have User-Controlled Wallet email authentication configured under the Circle Wallets Configurator. The LIVE API key and the LIVE wallet configuration belong to the same Circle mainnet environment.

## Local start

```powershell
Copy-Item .env.example .env.local
# Edit .env.local and add your keys
npm install
npm run dev:vercel
```

## Production build

```powershell
npm run build
```

The configured base path remains:

```text
/wallets/
```

Expected URL:

```text
https://www.lexsecure.biz/wallets/
```

## Security

Never put `LIVE_API_KEY` or `TEST_API_KEY` in browser JavaScript, HTML, a `VITE_...` variable, GitHub, or a public ZIP.

`.env.local` and `.vercel/` are intentionally excluded from source control and from the prepared download package.

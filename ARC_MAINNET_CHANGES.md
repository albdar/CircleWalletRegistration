# Arc Mainnet changes

- Added UI target `ARC-MAINNET`.
- Arc Mainnet uses Circle mainnet `EVM` wallet code with account type `EOA`.
- Arc Testnet remains `ARC-TESTNET` with `SCA`.
- Ethereum Sepolia remains `ETH-SEPOLIA` with `SCA`.
- Backend selects `CIRCLE_LIVE_API_KEY` for Arc Mainnet and `CIRCLE_TEST_API_KEY` for testnets.
- Circle App ID is loaded automatically from `/v1/w3s/config/entity` for the selected environment.
- Arc Mainnet USDC balance is read from `https://rpc.mainnet.arc.io` using the USDC ERC-20 interface at `0x3600000000000000000000000000000000000000`.
- `.env.local` and `.vercel/` were removed from the distributable package so API keys/tokens are not included.

# Phase 5 complete — starter on `@spacesops/wdk-react-native-core`

**Pinned:** `@spacesops/wdk-react-native-core@1.0.0-beta.40` (npm)

Transitive stack:

- `@spacesops/pear-wrk-wdk@1.1.1-beta.40` (btc in mobile bundle)
- `@spacesops/react-native-bare-kit@0.11.0-beta.40` (addon linking)

## Removed (legacy patching)

- `scripts/wire-worklet.js`
- `scripts/relink-bare-addons.js`
- `postinstall` / `wire-worklet` / `relink-bare-addons` npm scripts
- Direct `@tetherto/wdk-wallet-btc`, `@ledgerhq/ledger-bitcoin`, starter `bare-*` hoisting deps
- Gradle `link` task override in `plugins/withBareKitAndroid.js` ( **`keepDebugSymbols` kept** )

## Bitcoin in app config

- `bitcoin` in `MAINNET_CHAINS` in `src/config/get-chains-config.ts`
- Tokens/networks already include `bitcoin` in `get-token-configs.ts` / `networks.ts`

Electrum: set `EXPO_PUBLIC_ELECTRS_*` in `.env` if needed.

## Verify locally

```bash
cd /Users/i830671/git/wdk-starter-react-native-develop
npm install
npm run typecheck
npx expo prebuild --clean
npm run android   # or ios
```

Smoke: create wallet → Bitcoin network in send/receive → address/balance via HRPC (no `ADDON_NOT_FOUND`).

## Next (Phase 6)

CI bundle/addon checks, device E2E, update `docs/wdk-wallet-btc-pear-dependency-tree.md` for `@spacesops/*` pins.

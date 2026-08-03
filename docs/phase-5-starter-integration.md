# Phase 5 complete — starter on `@spacesops/wdk-react-native-core`

**Pinned:** `@spacesops/wdk-react-native-core@1.0.0-beta.40` (npm)

Transitive stack:

- `@spacesops/pear-wrk-wdk@1.1.1-beta.40` (btc in mobile bundle)
- `@spacesops/react-native-bare-kit@0.11.0-beta.41` (addon linking + native libs)

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

Bare-kit **beta.41** ships `libbare-kit.so` and iOS xcframework on npm (beta.40 omitted them). Starter uses **`overrides`** until `@spacesops/wdk-react-native-core` is republished with bare-kit **0.11.0-beta.41**.

### Pear bundle ↔ native addon names

The worklet bundle embeds exact linked names (e.g. `linked:libbare-crypto.1.12.0.so`). **`react-native-bare-kit` link** must ship those filenames. If npm hoists newer `bare-crypto` / `bare-tls`, you get `ADDON_NOT_FOUND` and `SIGABRT` in `libbare-kit.so`.

Starter **overrides** pin versions that match `@spacesops/pear-wrk-wdk@1.1.1-beta.40` today:

- `bare-crypto@1.12.0` (bundle links `libbare-crypto.1.12.0.so`, not 1.13.x)

`bare-tls` may need **two** versions in the APK (`2.1.4` and `3.1.7`). npm can hoist `3.1.8`; **`scripts/alias-pear-linked-addons.mjs`** copies patch-level aliases after link (also runs in `postinstall`).

After `npm install`, rebuild Android (link task) and run:

```bash
npm run verify-pear-addons
```

Long-term: republish pear with `gen:mobile-bundle` against current bare pins, then drop overrides.

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

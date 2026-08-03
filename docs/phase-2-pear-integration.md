# Phase 2 complete — `@spacesops/pear-wrk-wdk`

**Published:** `@spacesops/pear-wrk-wdk@1.1.1-beta.40` (npmjs.org)

Includes EVM + Spark + **Bitcoin** (`@spacesops/wdk-wallet-btc@1.0.0-beta.20`) in `wdk-worklet.mobile.bundle.js`.

---

## Verified on npm

```bash
npm view @spacesops/pear-wrk-wdk version
# 1.1.1-beta.40
```

Load check (optional):

```bash
npm pack @spacesops/pear-wrk-wdk@1.1.1-beta.40
mkdir -p /tmp/pear-check && cd /tmp/pear-check && npm init -y && npm i ../spacesops-pear-wrk-wdk-1.1.1-beta.40.tgz
node -e "const m=require('@spacesops/pear-wrk-wdk'); console.log('bundle', m.bundle?.length>1e6, 'HRPC', typeof m.HRPC)"
```

---

## Next: wire into `@spacesops/wdk-react-native-core` (Phase 4)

On branch **`repackage`** in `/Users/i830671/git/wdk-react-native-core`:

### 1. `package.json`

```json
"@spacesops/pear-wrk-wdk": "1.1.1-beta.40"
```

Remove `github:tetherto/pear-wrk-wdk#v2`.

### 2. Replace imports (all occurrences)

| From | To |
|------|-----|
| `@tetherto/pear-wrk-wdk` | `@spacesops/pear-wrk-wdk` |

Files today:

- `src/services/workletLifecycleService.ts`
- `src/store/workletStore.ts`
- `src/hooks/useWorklet.ts`
- `src/types/hrpc.ts`
- `src/utils/storeHelpers.ts`
- `jest.config.cjs`
- `src/__tests__/setup.ts`
- `src/__tests__/services/workletLifecycleService.test.ts`
- `src/__tests__/types/hrpc.test.ts`

### 3. Install and test

```bash
cd /Users/i830671/git/wdk-react-native-core
npm install
npm test
```

### 4. Starter (after core republish or `file:` link)

In `wdk-starter-react-native-develop/package.json`:

- Point `@tetherto/wdk-react-native-core` → `@spacesops/wdk-react-native-core` (when published) **or** `file:../wdk-react-native-core` during dev.
- **Remove** `postinstall` / `scripts/wire-worklet.js` once core ships btc-inclusive pear (Phase 5).
- Remove direct `@tetherto/wdk-wallet-btc` from starter `package.json`.

---

## Still required for clean mobile builds (Phase 3)

- **`@spacesops/react-native-bare-kit`** — fixed `link.mjs` for bare addons (Electrum `bare-tls` / `bare-tcp` with btc bundle).
- Until then, starter may still need `plugins/withBareKitAndroid.js` + relink workaround for wallet creation.

---

## Release chain

1. ~~`@spacesops/wdk-wallet-btc@1.0.0-beta.20`~~
2. ~~`@spacesops/pear-wrk-wdk@1.1.1-beta.40`~~
3. `@spacesops/react-native-bare-kit` (Phase 3)
4. `@spacesops/wdk-react-native-core` pin pear + bare-kit (Phase 4)
5. Starter trim + bitcoin in `MAINNET_CHAINS` (Phase 5)

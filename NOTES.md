# Pear worklet bundle

To see the exact list after you change deps or republish pear:

```bash
rg -o 'linked:lib[^"'\''\\]+' node_modules/@spacesops/pear-wrk-wdk/generated/bundle/wdk-worklet.mobile.bundle.js | sort -u
```

To change which chains/wallets are packed, edit `schema.json` → `config.walletModules` / `preloadModules` and run `npm run gen:mobile-bundle` in `pear-wrk-wdk` before publish.

## Addon alignment (resolved 2026-08-04 — nothing to configure here)

`pear-wrk-wdk@1.1.1-beta.43` declares **all 25 linked addons as exact `dependencies`** (its `pre-publish.md` §14), so a consumer resolves precisely the versions baked into the bundle and bare-kit's `link` alone produces every expected filename. Consequently this repo now has **no `bare-*` pins, no `overrides`, no alias script, and no Expo plugin** for any of it. Check alignment with:

```bash
npx wdk-verify-addons
```

Two expected results, neither a problem: `bare-posix` reports no Android prebuild (its `exports` map `android` to `unsupported.js`, so **24 of 25 on disk is correct**), and `bare-subprocess` is linked at two versions because `bare-node-runtime` wants `^6.0.0` while pear overrides `5.2.3` — it is not in the bundle, so both copies are unused bloat.

### Why overrides were never the fix

npm honours `overrides` only in the **root** manifest, so pear's own pins were invisible to consumers and had to be duplicated here by hand. Two addons were actually drifting and only one was known: `bare-crypto` (bundle `1.12.0`, tree resolved `1.15.3`) and `bare-tcp` (bundle `2.5.3`, tree resolved `2.5.4`, published after pear packed). The alias script had been silently covering the second by copying `2.5.4` onto the `2.5.3` filename, so it never surfaced.

**The dedupe requires a fresh lockfile.** `npm install` preserves existing lock entries instead of re-resolving, so an incremental install keeps the old version hoisted and *nests* pear's exact pin beneath it — two copies, and two `.so` in the APK. After any change that touches the addon tree:

```bash
rm -rf node_modules package-lock.json && npm install
```

## Never add a bare addon package to this repo's dependencies

`link` turns **every** copy of an addon package in `node_modules` into a `.so`, so a direct dependency that duplicates one of pear's puts **two versions** of the same addon in the APK.

Found 2026-08-04: this repo declared `@buildonspark/spark-frost-bare-addon: 0.0.5` (since `feat: init`) while pear's `@buildonspark/bare@0.0.76` pulls `0.0.12`. Both were linked. The bundle only ever requests `0.0.12`, so the app worked and the old `verify-pear-addons` passed at 25/25 — the stale `0.0.5` was invisible dead weight in every build. It was also the reason `keepDebugSymbols` needed hand-maintaining.

Diagnose ownership from the lockfile:

```bash
node -e "
const lock=require('./package-lock.json'), t='<addon-package>';
for (const [k,v] of Object.entries(lock.packages||{}))
  for (const f of ['dependencies','optionalDependencies','peerDependencies'])
    if (v[f]?.[t]) console.log((k||'<root>')+'  ['+f+'] -> '+v[f][t]);
"
```

A `<root>` line means **this repo** owns the duplicate — delete it and let pear's tree supply the addon. `npx wdk-verify-addons` warns about duplicates, and `unzip -l android/app/build/outputs/apk/debug/app-debug.apk | rg '<addon-name>'` confirms what actually shipped. Clear `node_modules/@spacesops/react-native-bare-kit/android/build` too, or its stale JNI intermediates re-inject the old `.so`.

## Wallet errors after the worklet starts come from the bundle's dep tree

Once the worklet is running and addons load, remaining per-network failures are almost always **stale versions inside the pear bundle**, not app or native problems. The same packages sit in this repo's `node_modules` for types and **never execute**, so they can look correct while the device fails. Reproduce in **`pear-wrk-wdk`**, not here (`pear-wrk-wdk/pre-publish.md` §13 has a copy-paste Node script).

Both failures found 2026-08-03 read like native bugs and were neither:

| Symptom | Cause | Fix |
|---|---|---|
| All EVM networks: `Failed to get account for network "ethereum" at index 0: Address "undefined" is invalid. … viem@2.43.3` | pear pinned `@wdk-safe-global/relay-kit@4.1.0`, whose `predictSafeAddress({ owner })` is singular while the wallet passes `{ owners: [owner] }` → Safe setup encodes `owners: [undefined]` | pear → `@tetherto/wdk-wallet-evm-erc-4337@1.0.0-beta.14` (uses `abstractionkit`, Safe kits gone) |
| `spark`: `MODULE_NOT_FOUND: Cannot find module './wallet-account-spark.js'` | `wdk-wallet-spark@1.0.0-beta.6` resolved it with `await import(...)`, which does not resolve inside a packed bundle | pear → `wdk-wallet-spark@1.0.0-beta.11` or later (static import) |

Reading these two messages correctly saves a lot of time:

- **`Address "undefined" is invalid`** names viem, but the EVM wallet uses ethers. The viem frame comes from the Safe/ERC-4337 layer, so trace the **owner** address, not the ethers HD derivation (`MemorySafeHDNodeWallet` was fine the whole time).
- **`MODULE_NOT_FOUND` listing the correct file as its first candidate** means resolution succeeded and the bundle's `exists()` check rejected it. Don't chase pear packaging — the file and its resolution entry were both present in the bundle. Treat dynamic `import()` inside a packed module as unsupported.

Refreshing pear's `@tetherto` deps also changes the native addon set (newer `bare-node-runtime`), so re-run the `dlopen` sweep below afterward. Verify the derived address is **unchanged** before shipping — a different Safe address moves existing users' funds.

## Native addon loading failures

Moved to **`react-native-bare-kit/TROUBLESHOOTING.md`** (ships in the package, so it is at `node_modules/@spacesops/react-native-bare-kit/TROUBLESHOOTING.md`). It covers why `ADDON_NOT_FOUND` is normally a `dlopen` symbol error rather than a missing file, the NDK `dlopen` harness that recovers the real `dlerror()` bare truncates, the `NEEDED libbare-kit.so` requirement, and the runtime-vs-prebuild ABI trap including why 0.15.x must not be used.

It lives there because every symptom in it is a property of bare-kit and pear, not of this app — keeping it here meant no consumer could ever find it.

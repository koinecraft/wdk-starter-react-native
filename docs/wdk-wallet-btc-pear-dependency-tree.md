# WDK Wallet BTC ↔ Pear Worklet Dependency Tree

Reference for how `@tetherto/wdk-wallet-btc` relates to this starter app when packaged inside `@tetherto/pear-wrk-wdk`.

---

## 1. npm install tree (host app / Metro)

What `npm install` puts in `node_modules`. **Only the left branch runs wallet logic at runtime today.**

```
@tetherto/wdk-starter-react-native
│
├── @tetherto/wdk-react-native-core
│   ├── @tetherto/pear-wrk-wdk          (@wdk/bare — git pin v2)
│   │   ├── @tetherto/wdk
│   │   │   └── @tetherto/wdk-wallet
│   │   ├── @tetherto/wdk-wallet-evm-erc-4337
│   │   │   ├── @tetherto/wdk-wallet-evm
│   │   │   │   └── @tetherto/wdk-wallet
│   │   │   └── @tetherto/wdk-wallet
│   │   ├── @tetherto/wdk-wallet-spark
│   │   │   ├── @buildonspark/spark-sdk / bare
│   │   │   └── @tetherto/wdk-wallet
│   │   ├── @buildonspark/spark-frost-bare-addon   (preload in schema)
│   │   ├── hrpc, hyperschema, @scure/bip39, …
│   │   └── [schema also lists btc/rgb, but starter wire-worklet strips them]
│   │
│   ├── react-native-bare-kit          (native Bare runtime)
│   └── @tetherto/wdk-react-native-secure-storage
│
├── @tetherto/wdk-wallet-btc           ⚠ direct app dep — NOT in worklet bundle today
│   ├── @tetherto/wdk-wallet
│   │   └── bare-node-runtime → bare-buffer, bare-crypto, bare-tls, …
│   ├── @tetherto/wdk-failover-provider
│   ├── @mempool/electrum-client       (uses net/tls → bare-net/bare-tls in worklet)
│   ├── bitcoinjs-lib
│   ├── @bitcoinerlab/* (descriptors, secp256k1, coinselect, btcmessage)
│   ├── bip32, bip39, @noble/hashes, sodium-universal, …
│   └── bare-node-runtime@1.5.0
│
├── @ledgerhq/ledger-bitcoin           ⚠ bundling helper only — not used by wdk-wallet-btc
│
└── bare-* (bare-crypto, bare-tcp, bare-tls, …)   host/RN polyfills, separate from worklet addons
```

**Important:** `@tetherto/wdk-wallet-btc` is a **sibling** of pear today, not a child. The starter keeps it installed so pear *can* resolve it during `bare-pack`, but `wire-worklet.js` currently removes `btc` from `schema.json`, so it never enters the bundle.

---

## 2. pear packaging tree (when `btc` is in `schema.json`)

Intended model: pear owns module selection and produces one artifact.

```
@tetherto/pear-wrk-wdk
│
├── schema.json
│   └── config.walletModules.btc
│         modulePath: "@tetherto/wdk-wallet-btc"
│         networks: ["bitcoin"]
│
├── scripts/generate-wallet-modules.js
│   └── require('@tetherto/wdk-wallet-btc')   ← static require for bundler
│   └── walletManagers['bitcoin'] = WalletManagerBtc
│
├── src/wdk-worklet.js
│   └── loads generated/wallet-modules.js
│   └── HRPC handlers → WDK.callMethod(network: "bitcoin", …)
│
├── bare-pack --linked
│   └── generated/bundle/wdk-worklet.mobile.bundle.js   (~14 MB evm+spark, ~18 MB +btc)
│       └── embeds linked:lib*.so names for every native addon in the bundle graph
│
└── index.js
    └── exports { bundle, HRPC }
```

**JS module tree inside the bundle** (when btc is enabled):

```
wdk-worklet.mobile.bundle.js
│
├── @tetherto/wdk
├── @tetherto/wdk-wallet-evm-erc-4337  → ethereum, polygon, arbitrum, plasma, sepolia
├── @tetherto/wdk-wallet-spark           → spark
└── @tetherto/wdk-wallet-btc             → bitcoin
    ├── @tetherto/wdk-wallet
    │   └── bare.js → bare-node-runtime/global
    ├── @tetherto/wdk-failover-provider
    ├── @mempool/electrum-client
    │   └── net / tls  → bare-net / bare-tls (via bare-node-runtime/imports)
    ├── bitcoinjs-lib + @bitcoinerlab/*
    └── wallet-manager-btc → ElectrumTcp | ElectrumTls | ElectrumSsl | ElectrumWs
```

pear should declare `@tetherto/wdk-wallet-btc` in its own `package.json` dependencies; today it only appears in `schema.json.bak`, and the starter’s direct dep is what makes hoisting work during local builds.

---

## 3. Runtime tree (on device)

What actually executes when you create/use a Bitcoin wallet:

```
React Native app (starter)
│
├── UI: complete.tsx → useWalletManager.initializeFromMnemonic()
│
├── @tetherto/wdk-react-native-core
│   ├── WorkletLifecycleService.startWorklet()
│   │   └── import('@tetherto/pear-wrk-wdk').bundle
│   │   └── react-native-bare-kit Worklet.start('/wdk-worklet.bundle', bundle)
│   │
│   └── HRPC.initializeWDK / callMethod(network: "bitcoin")
│
├── react-native-bare-kit  (native)
│   ├── libbare-kit.so
│   └── addons/*.so        ← all packages with "addon": true in node_modules
│       (bare-tls, bare-tcp, bare-buffer, bare-performance, spark-frost, …)
│
└── Inside Bare worklet thread
    └── wdk-worklet.mobile.bundle.js
        └── walletManagers['bitcoin']  (@tetherto/wdk-wallet-btc)
            └── electrum over bare-tcp / bare-tls
```

The starter app **never imports `@tetherto/wdk-wallet-btc` directly at runtime**. It only talks to pear’s bundle over HRPC.

---

## 4. Side-by-side: current vs btc-in-pear

| Layer | Current (starter) | With btc in pear |
|--------|-------------------|------------------|
| **pear schema** | btc removed by `wire-worklet.js` | `walletModules.btc` kept |
| **JS bundle** | evm + spark (~14.6 MB) | evm + spark + btc (~18 MB+) |
| **App → wdk-wallet-btc** | Direct dep, unused at runtime | Optional — pear should own the dep |
| **@ledgerhq/ledger-bitcoin** | In starter for bare-pack | Only if pear/bare-pack needs it |
| **Native addons** | From full `node_modules` scan | Same, but more addons if btc pulls extra bare versions |
| **Config** | App `get-chains-config.ts` → `network: "bitcoin"` | Must match pear `networks: ["bitcoin"]` |

---

## 5. Native addon subtree (btc-specific pressure)

Adding btc doesn’t add a single “btc.so”. It pulls **more JS** and often **duplicate bare addon versions** already required by evm/spark:

```
@tetherto/wdk-wallet-btc
└── bare-node-runtime@1.5.0
    ├── bare-tcp@2.5.3        → libbare-tcp.2.5.3.so
    ├── bare-tls@3.1.7        → libbare-tls.3.1.7.so
    ├── bare-performance@2.1.1 → libbare-performance.2.1.1.so
    ├── bare-buffer, bare-crypto, bare-dns, bare-net, …
    └── bare-subprocess, bare-inspector, bare-ws, …
```

Those overlap with versions already pulled by `@tetherto/wdk-wallet` / `@tetherto/wdk-wallet-evm` / spark — which is why addon linking is fragile (multiple versions, SONAME vs `--linked` names).

---

## Bottom line

```
Starter app
  └── wdk-react-native-core
        └── pear-wrk-wdk  ← single integration point
              └── [bundle] wdk-worklet.mobile.bundle.js
                    └── wdk-wallet-btc  ← belongs HERE, via schema.json
                          └── wdk-wallet, electrum-client, bitcoinjs-lib, …
              └── [native] react-native-bare-kit addons (bare-tls, bare-tcp, …)
```

**`wdk-wallet-btc` should live inside pear’s schema + bundle**, not as app-level patching. The starter should only:

1. Pin a pear ref that includes btc in schema and declares `@tetherto/wdk-wallet-btc` as a pear dependency
2. Pass `bitcoin` chain config from `get-chains-config.ts`
3. Drop `wire-worklet.js` schema hacks and the redundant direct `@tetherto/wdk-wallet-btc` dep once pear ships it

The linking/addon issues are a **separate pipeline problem** (bare-pack `--linked` + react-native-bare-kit addon SONAME matching), not a reason to wire btc from the app instead of pear.

---

## Related paths in this repo

| Path | Role |
|------|------|
| `scripts/wire-worklet.js` | Patches pear schema, rebuilds mobile bundle, relinks bare addons |
| `scripts/relink-bare-addons.js` | Copies raw `.bare` prebuilds into `react-native-bare-kit` addons |
| `plugins/withBareKitAndroid.js` | Expo plugin: `keepDebugSymbols` + Gradle link task patch |
| `src/config/get-chains-config.ts` | App-side network config passed to worklet via HRPC |
| `node_modules/@tetherto/pear-wrk-wdk/schema.json` | Active wallet module registry (btc stripped by wire-worklet) |
| `node_modules/@tetherto/pear-wrk-wdk/schema.json.bak` | Upstream schema including btc + rgb |

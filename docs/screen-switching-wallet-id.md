# Screen Switching & Wallet ID Resolution

Reference for startup and navigation errors caused by premature wallet switching and invalid wallet ID fallbacks.

---

## Summary

When navigating between screens (or on cold start), the app could attempt to switch to wallet `"default"` before SecureStorage was ready, or before that wallet actually existed. This produced errors during `useWallet` initialization and wallet switching.

Two separate issues were involved:

1. **SecureStorage race** in `@tetherto/wdk-react-native-core` — child screen effects ran before the provider registered storage.
2. **Invalid wallet ID fallback** in the starter app — screens passed non-existent wallet IDs into `useWallet({ walletId })`.

Both were fixed. Screens must only pass wallet IDs that are confirmed to exist in secure storage.

---

## Symptoms

Typical log / error patterns:

```
SecureStorage not initialized. Ensure WdkAppProvider is mounted.
```

```
Failed to switch wallet: Wallet "default" does not exist
```

Observed when:

- Cold-starting the app before any wallet was created
- Navigating to wallet-scoped screens (`/wallet`, `/assets`, send/receive flows, settings)
- Hot reload in dev (JS context persists; storage timing differs from production)

---

## Root cause 1: SecureStorage initialization race

### What happened

`useWallet` automatically switches wallets in a `useEffect` when `options.walletId` differs from `activeWalletId`. That switch calls `WalletSetupService.hasWallet()`, which requires SecureStorage.

Originally, `WdkAppProvider` registered SecureStorage in its own `useEffect`:

```tsx
// Before (broken)
const secureStorage = useMemo(() => createSecureStorage(), [])
useEffect(() => {
  WalletSetupService.setSecureStorage(secureStorage)
}, [secureStorage])
```

**React runs child effects before parent effects.** Screen components mounting under `WdkAppProvider` could call `useWallet` and trigger a wallet switch before the provider's effect ran.

### Fix (wdk-react-native-core)

Register SecureStorage **synchronously during render** inside `useMemo`, before children mount:

```tsx
// After (fixed) — WdkAppProvider.tsx
const secureStorage = useMemo(() => {
  const storage = createSecureStorage()
  WalletSetupService.setSecureStorage(storage)
  return storage
}, [])
```

Add a defensive guard in `useWallet`:

```tsx
if (!WalletSetupService.isSecureStorageInitialized()) {
  log('[useWallet] SecureStorage not initialized yet, skipping wallet switch')
  return
}
```

### Files

| Package | File |
|---------|------|
| `wdk-react-native-core` | `src/provider/WdkAppProvider.tsx` |
| `wdk-react-native-core` | `src/hooks/useWallet.ts` |
| `wdk-react-native-core` | `src/services/walletSetupService.ts` (`isSecureStorageInitialized()`) |

---

## Root cause 2: Fallback to non-existent wallet IDs

### What happened

`refreshWalletList()` (with no known identifiers) always returns an entry for `"default"`:

```tsx
// useWalletManager.ts
const defaultExists = await checkWallet('default')
walletStore.setState({
  walletList: [{ identifier: 'default', exists: defaultExists, isActive: ... }],
})
```

When no wallet exists yet, this is `{ identifier: 'default', exists: false }`.

Many starter screens previously resolved the current wallet like this:

```tsx
// Before (broken)
const currentWalletId = activeWalletId || wallets[0]?.identifier;
// or
const currentWalletId = activeWalletId || 'default';
```

On a fresh install:

- `activeWalletId` is often `null`
- `wallets[0]?.identifier` is `"default"` even when `exists: false`
- `useWallet({ walletId: 'default' })` triggers a switch to a wallet that is not in SecureStorage

`shouldSkipWalletSwitch` only skips when `requestedWalletId` is falsy or matches `activeWalletId`. Passing `"default"` explicitly does **not** skip — so the switch is attempted and fails.

### Fix (starter app)

Added `src/utils/get-current-wallet-id.ts`:

```tsx
const getCurrentWalletId = (
  activeWalletId: string | null,
  wallets: WalletListEntry[]
): string | undefined => {
  const existingWallets = wallets.filter(w => w.exists);

  if (activeWalletId && existingWallets.some(w => w.identifier === activeWalletId)) {
    return activeWalletId;
  }

  return existingWallets[0]?.identifier;
};
```

When `undefined` is returned, `useWallet({ walletId: undefined })` skips switching (`shouldSkipWalletSwitch` treats falsy `walletId` as "skip").

### Screens updated

All wallet-scoped screens now use `getCurrentWalletId(activeWalletId, wallets)` instead of `|| 'default'` or `|| wallets[0]?.identifier`:

| Screen | Path |
|--------|------|
| Index / routing | `src/app/index.tsx` |
| Wallet home | `src/app/wallet.tsx` |
| Assets | `src/app/assets.tsx` |
| Authorize | `src/app/authorize.tsx` |
| Settings | `src/app/settings.tsx` |
| Token details | `src/app/token-details.tsx` |
| Send — select token | `src/app/send/select-token.tsx` |
| Send — select network | `src/app/send/select-network.tsx` |
| Send — details | `src/app/send/details.tsx` |
| Receive — select network | `src/app/receive/select-network.tsx` |

`index.tsx` also gates routing on `wallets.some(w => w.exists)` before redirecting to `/wallet` or `/authorize`.

---

## Effect ordering (reference)

```
WdkAppProvider render
  └─ useMemo: createSecureStorage + setSecureStorage  ← synchronous, first
  └─ children render
       └─ Screen mount
            └─ useWallet effect  ← may run wallet switch
  └─ WdkAppProvider effects     ← run after all child effects
```

The SecureStorage fix moves registration from the bottom of this tree to the top (render phase).

---

## Guidelines for new screens

1. **Never** hardcode `'default'` or use `wallets[0]?.identifier` without checking `exists`.
2. **Always** use `getCurrentWalletId(activeWalletId, wallets)` before passing `walletId` to `useWallet`.
3. Handle `undefined` — show loading, redirect to onboarding, or wait for `refreshWalletList()` if no wallet exists yet.
4. Call `refreshWalletList()` after wallet creation/deletion so the list reflects SecureStorage.

Example:

```tsx
const { wallets, activeWalletId, refreshWalletList } = useWalletManager();
const currentWalletId = getCurrentWalletId(activeWalletId, wallets);
const { addresses, isInitialized } = useWallet({ walletId: currentWalletId });
```

---

## Persisting the core fix

The SecureStorage changes live in `@tetherto/wdk-react-native-core`. After `npm install`, verify the fix is present:

- `WdkAppProvider` sets storage in `useMemo`, not a deferred `useEffect`
- `useWallet` checks `WalletSetupService.isSecureStorageInitialized()`

If missing, bump the git ref in `package.json` for `@tetherto/wdk-react-native-core`, or use a local `file:` dependency during development.

---

## Related

- Wallet creation failures (separate issue): bare addon / SONAME pipeline — see build notes in `scripts/relink-bare-addons.js` and conversation history.
- Pear / worklet dependency tree: `docs/wdk-wallet-btc-pear-dependency-tree.md`

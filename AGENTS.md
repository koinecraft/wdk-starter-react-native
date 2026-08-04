# AGENTS.md — WDK React Native starter

An **integration starter**. Behaviour belonging to the WDK stack is implemented in the owning package, published to npm, and consumed here as a version bump — not duplicated here. Never edit `node_modules`.

Detailed rules live in `.cursor/rules/`: **`upstream-dependencies-first`** (which repo owns a fix, release order) and **`bare-native-addons`** (addon dependency rules and failure diagnosis). Read both before touching dependencies or Android build config.

## The short version

- **Install `@spacesops/wdk-react-native-core` only.** Never add `@spacesops/pear-wrk-wdk`, `@spacesops/react-native-bare-kit`, or any `"addon": true` package (`bare-crypto`, `@buildonspark/spark-frost-bare-addon`) to `dependencies`, and never add `bare-*` to `overrides`.
- **Re-resolve after any dependency change that touches addons**, because npm keeps stale lock entries and silently ships two copies of an addon:
  ```bash
  rm -rf node_modules package-lock.json && npm install && npx wdk-verify-addons
  ```
- **`app.json` `plugins` must include `"@spacesops/react-native-bare-kit"`.** Without it, debug builds work and release builds crash.
- **Read error messages before changing anything.** `ADDON_NOT_FOUND` with a candidate listed is a `dlopen` **symbol** failure, not a missing file. A failure scoped to one chain comes from versions packed inside pear's bundle, which must be reproduced in `pear-wrk-wdk` — this repo's copies of those packages are used for types and never execute.

`NOTES.md` records this project's debugging history. Native addon loading is documented in `node_modules/@spacesops/react-native-bare-kit/TROUBLESHOOTING.md`.

## Checks

```bash
npm run typecheck
npx wdk-verify-addons
npm run android        # Gradle preBuild links addons automatically
```

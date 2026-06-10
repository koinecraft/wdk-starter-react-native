# Getting Started

This guide walks through setting up a **new development machine** and building a **production release APK** for Android. The steps below were tested on macOS; Linux is similar except where noted.

> **Alpha software** — do not use with real funds. See [README.md](README.md) for feature overview and architecture.

## Prerequisites overview

| Tool | Version / notes |
|------|-----------------|
| **Node.js** | 24 (see `.nvmrc`) |
| **nvm** | Recommended for managing Node |
| **Java (JDK)** | 21 (required by Gradle / Android build) |
| **Android SDK** | compileSdk **36**, build-tools **36.0.0**, minSdk **29** |
| **Git** | To clone the repository |

The `android/` folder is **not** committed — it is generated during the release build via Expo prebuild.

---

## 1. Install nvm and Node.js

Install [nvm](https://github.com/nvm-sh/nvm) if you do not have it:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

Restart your shell, then from the project root:

```bash
cd wdk-starter-react-native
nvm install    # reads .nvmrc (Node 24)
nvm use
node -v      # should print v24.x.x
```

---

## 2. Install Java 21

The release build script expects **JDK 21**.

**macOS (Homebrew):**

```bash
brew install openjdk@21
```

**macOS:** The `build:android` script sets `JAVA_HOME` automatically via `/usr/libexec/java_home -v 21`. If that fails, point `JAVA_HOME` at your JDK 21 install manually.

**Linux:** Install OpenJDK 21 from your package manager and export `JAVA_HOME` before building:

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64   # path may vary
export PATH=$JAVA_HOME/bin:$PATH
java -version
```

---

## 3. Install the Android SDK

1. Install [Android Studio](https://developer.android.com/studio).
2. Open **SDK Manager** and install:
   - **Android SDK Platform 36**
   - **Android SDK Build-Tools 36.0.0**
   - **Android SDK Platform-Tools** (includes `adb`)
   - **NDK** (installed automatically by Gradle when needed)

3. Set environment variables (add to `~/.bashrc`, `~/.zshrc`, or equivalent):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk   # macOS default
# Linux example: export ANDROID_HOME=$HOME/Android/Sdk

export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
```

Verify:

```bash
adb version
```

---

## 4. Clone the repository

```bash
git clone <repository-url> wdk-starter-react-native
cd wdk-starter-react-native
nvm use
```

---

## 5. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_WDK_INDEXER_BASE_URL` | Recommended | WDK Indexer base URL (default: `https://wdk-api.tether.io`) |
| `EXPO_PUBLIC_WDK_INDEXER_API_KEY` | Recommended | API key for balances and transaction history ([get a key](https://docs.wallet.tether.io)) |
| `EXPO_PUBLIC_TRON_API_KEY` | Optional | Tron network API key |
| `EXPO_PUBLIC_TRON_API_SECRET` | Optional | Tron network API secret |

These `EXPO_PUBLIC_*` values are embedded into the JS bundle at **build time**. Rebuild the APK after changing `.env`.

Optional: customize RPC endpoints and chain settings in `src/config/get-chains-config.ts` (see [README.md](README.md#-provider-configuration-recommended)).

---

## 6. Install dependencies

```bash
npm install
```

This runs two important hooks automatically:

- **`preinstall`** — pins `@tetherto/pear-wrk-wdk@1.0.0-beta.5` (required for HRPC compatibility).
- **`postinstall`** — runs `scripts/link-bare-addons.js`, which links exact-version Bare native addons for the WDK worklets.

If native addon linking fails, run it manually:

```bash
npm run link:bare-addons
```

---

## 7. Build a production release APK (Android)

Connect a device with USB debugging enabled, or use an emulator. The build itself does not require a device.

```bash
npm run build:android
```

This script:

1. Exports the JS bundle (`expo export`)
2. Removes any existing `android/` folder and runs `expo prebuild`
3. Links Bare worklet native addons
4. Writes `android/local.properties` with your SDK path
5. Runs `./gradlew assembleRelease`

The first build downloads Gradle dependencies and Bare addon packages — expect **10–30+ minutes** depending on network and machine.

On success, the APK is at:

```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 8. Install and launch on a device

With a device connected (`adb devices` shows `device`):

```bash
npm run install:android
npm run launch:android
```

Or install manually:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.lcfx.koine.wdkstarterreactnative/com.lcfx.koine.wdkstarterreactnative.MainActivity
```

---

## 9. Verify the build (optional)

```bash
npm run typecheck
npm run lint
```

---

## Development workflow (non-release)

For day-to-day development with hot reload, use the Expo dev client:

```bash
npm install          # if not already done
npm run android      # builds debug dev client and runs on device/emulator
npm start            # Metro bundler (in a second terminal, if needed)
```

The release flow in section 7 produces a standalone APK without Metro.

---

## npm scripts reference

| Script | Purpose |
|--------|---------|
| `npm run build:android` | Full production release APK build |
| `npm run install:android` | Install release APK on connected device |
| `npm run launch:android` | Start the installed app via `adb` |
| `npm run link:bare-addons` | Re-link Bare native addons (after dependency changes) |
| `npm run prebuild:clean` | Regenerate native projects (`android/` + `ios/`) |
| `npm run android` | Debug build and run (dev client) |
| `npm start` | Start Expo dev server |

---

## Troubleshooting

### `JAVA_HOME` / Java version errors

Ensure JDK 21 is installed. On macOS:

```bash
/usr/libexec/java_home -v 21
```

### `ANDROID_HOME` / SDK not found

Confirm `ANDROID_HOME` points at your SDK and that Platform 36 and Build-Tools 36.0.0 are installed.

### `expo prebuild` / `ENOTEMPTY` errors

The release script removes `android/` before prebuild. If prebuild fails manually, run:

```bash
rm -rf android
CI=1 npx expo prebuild --platform android
npm run link:bare-addons
```

### App crashes on startup (`ADDON_NOT_FOUND`)

Bare worklet native libraries must match exact versions bundled in the WDK worklets. Re-run:

```bash
npm run link:bare-addons
npm run build:android
```

### Wallet import appears to hang

- A **fingerprint prompt** may appear while the encrypted seed is saved — complete it to continue.
- Address resolution (ERC-4337 Safe addresses) can take up to ~20 seconds per network; the app includes timeouts so import should not block indefinitely.

### No device detected

```bash
adb devices
```

Enable **USB debugging** on the phone and accept the debugging prompt. For emulators, start one from Android Studio first.

### Rebuild after `.env` changes

Environment variables are baked in at export time:

```bash
npm run build:android
npm run install:android
```

---

## Next steps

- Read [README.md](README.md) for architecture, supported networks, and customization.
- WDK documentation: [docs.wallet.tether.io](https://docs.wallet.tether.io)

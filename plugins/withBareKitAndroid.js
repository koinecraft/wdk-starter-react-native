const { withAppBuildGradle } = require('@expo/config-plugins');

const BARE_KEEP_DEBUG_SYMBOLS = `
    packaging {
        jniLibs {
            // Bare addon .so files break when stripped (strtab out of bounds in bare-kit loader).
            keepDebugSymbols += [
                "**/libbare*.so",
                "**/libbuildonspark__*.so",
                "**/libsodium-native*.so",
            ]
        }
    }
`;

const withBareKitAndroid = (config) =>
  withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      return modConfig;
    }

    if (modConfig.modResults.contents.includes('keepDebugSymbols')) {
      return modConfig;
    }

    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      /(\s+androidResources\s*\{)/,
      `${BARE_KEEP_DEBUG_SYMBOLS}$1`
    );

    return modConfig;
  });

module.exports = withBareKitAndroid;

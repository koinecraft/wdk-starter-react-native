const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

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

const PEAR_ALIAS_AFTER_LINK = `
// Pear worklet bundle expects linked:lib*.so names from bare-pack; link.mjs writes current npm versions.
gradle.projectsLoaded {
  rootProject.subprojects { sub ->
    sub.afterEvaluate {
      if (!sub.name.contains('react-native-bare-kit')) return
      def linkTask = sub.tasks.findByName('link')
      if (linkTask == null) return
      def aliasTask = sub.tasks.register('aliasPearLinkedAddons', Exec) {
        workingDir rootProject.projectDir.parentFile
        commandLine 'node', 'scripts/alias-pear-linked-addons.mjs'
      }
      linkTask.finalizedBy aliasTask
    }
  }
}
`;

const withBareKitAndroid = (config) => {
  config = withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      return modConfig;
    }
    if (modConfig.modResults.contents.includes('aliasPearLinkedAddons')) {
      return modConfig;
    }
    modConfig.modResults.contents += PEAR_ALIAS_AFTER_LINK;
    return modConfig;
  });

  return withAppBuildGradle(config, (modConfig) => {
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
};

module.exports = withBareKitAndroid;

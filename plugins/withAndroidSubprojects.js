const { withProjectBuildGradle } = require('@expo/config-plugins');

const PBKDF2_EXT_MARKER = '// spacesops: react-native-fast-pbkdf2 compileSdk ext';

const PBKDF2_EXT_BLOCK = `
${PBKDF2_EXT_MARKER}
ext {
  Pbkdf2_compileSdkVersion = 36
  Pbkdf2_buildToolsVersion = "36.0.0"
  Pbkdf2_minSdkVersion = 29
  Pbkdf2_targetSdkVersion = 36
}
`;

const withAndroidSubprojects = (config) => {
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      return modConfig;
    }

    if (modConfig.modResults.contents.includes(PBKDF2_EXT_MARKER)) {
      return modConfig;
    }

    modConfig.modResults.contents += PBKDF2_EXT_BLOCK;
    return modConfig;
  });
};

module.exports = withAndroidSubprojects;

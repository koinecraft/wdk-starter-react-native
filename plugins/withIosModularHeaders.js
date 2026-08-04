const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const MODULAR_HEADERS_LINE = '  use_modular_headers!\n';

/**
 * spark-sdk (from pear / wdk-wallet-spark) pulls gRPC-Swift + SwiftNIO. As static
 * pods they need module maps on CNIO* targets — CocoaPods requires use_modular_headers!.
 */
function withIosModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return modConfig;
      }

      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes('use_modular_headers!')) {
        return modConfig;
      }

      const withExpoModules = contents.replace(
        /(target .+ do\n)(\s+use_expo_modules!)/,
        `$1${MODULAR_HEADERS_LINE}$2`
      );

      if (withExpoModules !== contents) {
        fs.writeFileSync(podfilePath, withExpoModules);
        return modConfig;
      }

      const fallback = contents.replace(/(target .+ do\n)/, `$1${MODULAR_HEADERS_LINE}`);
      if (fallback !== contents) {
        fs.writeFileSync(podfilePath, fallback);
      }

      return modConfig;
    },
  ]);
}

module.exports = withIosModularHeaders;

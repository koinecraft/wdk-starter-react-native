const { withMainApplication } = require('@expo/config-plugins');

const IMPORTS = [
  'import java.io.IOException',
  'import com.facebook.react.soloader.OpenSourceMergedSoMapping',
  'import com.facebook.react.views.view.setEdgeToEdgeFeatureFlagOn',
  'import com.facebook.soloader.SoLoader',
];

const ON_CREATE_BODY = `    try {
      SoLoader.init(this, OpenSourceMergedSoMapping)
    } catch (e: IOException) {
      throw RuntimeException(e)
    }
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      DefaultNewArchitectureEntryPoint.load()
    }
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
    if (BuildConfig.IS_EDGE_TO_EDGE_ENABLED) {
      setEdgeToEdgeFeatureFlagOn()
    }`;

/**
 * Avoid loadReactNative() + duplicate DevLauncherPackage from android/bin trees.
 * SoLoader → New Arch → Expo lifecycle → edge-to-edge.
 */
const withDevLauncherMainApplication = (config) =>
  withMainApplication(config, (mod) => {
    if (mod.modResults.language !== 'kotlin') {
      return mod;
    }

    let contents = mod.modResults.contents;

    if (contents.includes('setEdgeToEdgeFeatureFlagOn()') && !contents.includes('loadReactNative')) {
      return mod;
    }

    for (const imp of IMPORTS) {
      if (!contents.includes(imp)) {
        contents = contents.replace(
          'import android.content.res.Configuration',
          `import android.content.res.Configuration\n${imp}`
        );
      }
    }

    contents = contents.replace(
      /import com\.facebook\.react\.ReactNativeApplicationEntryPoint\.loadReactNative\n/,
      ''
    );

    const loadBlock =
      /loadReactNative\(this\)\s*\n\s*ApplicationLifecycleDispatcher\.onApplicationCreate\(this\)/;
    const swappedBlock =
      /ApplicationLifecycleDispatcher\.onApplicationCreate\(this\)\s*\n\s*loadReactNative\(this\)/;

    if (loadBlock.test(contents)) {
      contents = contents.replace(loadBlock, ON_CREATE_BODY);
    } else if (swappedBlock.test(contents)) {
      contents = contents.replace(swappedBlock, ON_CREATE_BODY);
    }

    mod.modResults.contents = contents;
    return mod;
  });

module.exports = withDevLauncherMainApplication;

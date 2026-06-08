const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const link = require('bare-link');

const projectRoot = path.resolve(__dirname, '..');
const addonsOut = path.join(
  projectRoot,
  'node_modules/react-native-bare-kit/android/src/main/addons'
);
const cacheRoot = path.join(projectRoot, '.bare-addon-cache');

const androidTargets = [
  'android-arm64',
  'android-arm',
  'android-ia32',
  'android-x64',
];

const workletBundles = [
  '@tetherto/wdk-react-native-provider/lib/module/services/wdk-service/wdk-secret-manager-worklet.bundle.js',
  '@tetherto/wdk-react-native-provider/lib/module/services/wdk-service/wdk-worklet.mobile.bundle.js',
];

function patchBareKitGradle() {
  const gradlePath = path.join(
    projectRoot,
    'node_modules/react-native-bare-kit/android/build.gradle'
  );

  if (!fs.existsSync(gradlePath)) {
    return;
  }

  let contents = fs.readFileSync(gradlePath, 'utf8');

  if (contents.includes('linkWorkletAddons')) {
    return;
  }

  const replacement = `task linkWorkletAddons(type: Exec) {
  workingDir file("../../../")
  commandLine "node", "scripts/link-bare-addons.js"
}

preBuild.dependsOn linkWorkletAddons`;

  const updated = contents.replace(
    /task link\(type: Exec\) \{\s*commandLine "node", "link"\s*\}\s*\n\s*preBuild\.dependsOn link/,
    replacement
  );

  if (updated === contents) {
    throw new Error(
      'Could not patch react-native-bare-kit/android/build.gradle for worklet addon linking.'
    );
  }

  fs.writeFileSync(gradlePath, updated);
}

function libFileToPackage(libFile) {
  return libFile
    .replace(/^lib/, '')
    .replace(/\.[\d.]+\.so$/, '');
}

function parseRequiredAddons() {
  const required = new Map();

  for (const relativePath of workletBundles) {
    const bundlePath = path.join(projectRoot, 'node_modules', relativePath);

    if (!fs.existsSync(bundlePath)) {
      throw new Error(`Worklet bundle not found: ${relativePath}`);
    }

    const content = fs.readFileSync(bundlePath, 'utf8');
    const matches = content.matchAll(
      /linked:(lib(?:bare-[a-z0-9-]+|sodium-native)\.(\d+\.\d+\.\d+)\.so)/g
    );

    for (const [, libFile, version] of matches) {
      const pkg = libFileToPackage(libFile);
      const key = `${pkg}@${version}`;

      if (!required.has(key)) {
        required.set(key, { pkg, version, libFile });
      }
    }
  }

  return [...required.values()];
}

function ensurePackageDir(pkg, version) {
  const installedDir = path.join(projectRoot, 'node_modules', pkg);
  const installedPkgPath = path.join(installedDir, 'package.json');

  if (fs.existsSync(installedPkgPath)) {
    const installed = JSON.parse(fs.readFileSync(installedPkgPath, 'utf8'));

    if (installed.version === version && installed.addon === true) {
      return installedDir;
    }
  }

  const cacheDir = path.join(cacheRoot, `${pkg}@${version}`);

  if (!fs.existsSync(path.join(cacheDir, 'package.json'))) {
    fs.mkdirSync(cacheDir, { recursive: true });
    execFileSync('npm', ['pack', `${pkg}@${version}`, '--silent'], {
      cwd: cacheDir,
      stdio: 'pipe',
    });

    const tarball = fs
      .readdirSync(cacheDir)
      .find((file) => file.endsWith('.tgz'));

    if (!tarball) {
      throw new Error(`Failed to download ${pkg}@${version}`);
    }

    execFileSync('tar', ['-xzf', tarball, '--strip-components=1'], {
      cwd: cacheDir,
      stdio: 'pipe',
    });
  }

  return cacheDir;
}

function clearAddonsDir() {
  for (const arch of ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']) {
    const archDir = path.join(addonsOut, arch);

    if (!fs.existsSync(archDir)) {
      fs.mkdirSync(archDir, { recursive: true });
      continue;
    }

    for (const file of fs.readdirSync(archDir)) {
      if (file.endsWith('.so')) {
        fs.unlinkSync(path.join(archDir, file));
      }
    }
  }
}

async function main() {
  patchBareKitGradle();

  const required = parseRequiredAddons();

  if (required.length === 0) {
    throw new Error('No linked native addons found in WDK worklet bundles.');
  }

  clearAddonsDir();

  for (const { pkg, version, libFile } of required) {
    const packageDir = ensurePackageDir(pkg, version);
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
    );

    if (pkgJson.addon !== true) {
      throw new Error(`${pkg}@${version} is not a Bare addon package.`);
    }

    await link(packageDir, {
      target: androidTargets,
      needs: ['libbare-kit.so'],
      out: addonsOut,
    });

    const linkedFile = path.join(
      addonsOut,
      'arm64-v8a',
      `lib${pkg}.${version}.so`
    );

    if (!fs.existsSync(linkedFile)) {
      throw new Error(`Failed to link ${libFile} from ${pkg}@${version}.`);
    }
  }

  const allowedFiles = new Set(
    required.map(({ pkg, version }) => `lib${pkg}.${version}.so`)
  );

  for (const arch of ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64']) {
    const archDir = path.join(addonsOut, arch);

    for (const file of fs.readdirSync(archDir)) {
      if (file.endsWith('.so') && !allowedFiles.has(file)) {
        fs.unlinkSync(path.join(archDir, file));
      }
    }
  }

  const linked = fs.readdirSync(path.join(addonsOut, 'arm64-v8a')).sort();
  console.log(`Linked ${linked.length} worklet native addons:`);
  for (const file of linked) {
    console.log(`  ${file}`);
  }
}

main().catch((error) => {
  console.error('Failed to link bare addons:', error.message);
  process.exit(1);
});

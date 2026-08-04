#!/usr/bin/env node
/**
 * Fail if pear worklet bundle linked .so names are missing from addons-lock.json.
 * Run after Gradle :spacesops_react-native-bare-kit:link (or npm run android).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Gradle :react-native-bare-kit:link re-runs on every Android preBuild and drops pear aliases.
await import('./alias-pear-linked-addons.mjs');

const bundlePath = path.join(
  root,
  'node_modules/@spacesops/pear-wrk-wdk/generated/bundle/wdk-worklet.mobile.bundle.js'
);
const lockPath = path.join(root, 'addons-lock.json');

if (!fs.existsSync(bundlePath)) {
  console.error('[verify-pear-addons] Missing pear bundle:', bundlePath);
  process.exit(1);
}

const bundle = fs.readFileSync(bundlePath, 'utf8');
const linked = [
  ...bundle.matchAll(/linked:lib[^"'\\]+/g),
  ...bundle.matchAll(/linked\\:lib[^"'\\]+/g),
].map((m) => m[0].replace(/^linked\\?:/, '').replace(/\\$/, ''));

const uniqueLinked = [...new Set(linked)].sort();

let lockFiles = new Set();
if (fs.existsSync(lockPath)) {
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  lockFiles = new Set(lock.addons?.map((a) => a.file) ?? []);
}

const addonsArm64 = path.join(
  root,
  'node_modules/@spacesops/react-native-bare-kit/android/src/main/addons/arm64-v8a'
);
if (fs.existsSync(addonsArm64)) {
  for (const f of fs.readdirSync(addonsArm64)) {
    if (f.endsWith('.so')) lockFiles.add(f);
  }
}

const missing = uniqueLinked.filter((name) => !lockFiles.has(name));

if (missing.length === 0) {
  console.log(
    `[verify-pear-addons] OK — ${uniqueLinked.length} linked addon(s) match addons-lock.json`
  );
  process.exit(0);
}

console.error('[verify-pear-addons] Pear bundle expects native libs not in addons-lock:');
for (const name of missing) {
  console.error('  -', name);
}
console.error(
  '\nFix: pin bare-* versions to match the pear bundle (see package.json overrides) or republish @spacesops/pear-wrk-wdk with a fresh gen:mobile-bundle.'
);
process.exit(1);

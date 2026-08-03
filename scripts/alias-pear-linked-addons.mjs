#!/usr/bin/env node
/**
 * Copy linked .so names the pear bundle expects when npm hoists a patch bump
 * (e.g. libbare-tls.3.1.7.so vs installed libbare-tls.3.1.8.so).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.join(
  root,
  'node_modules/@spacesops/pear-wrk-wdk/generated/bundle/wdk-worklet.mobile.bundle.js'
);
const addonsRoot = path.join(
  root,
  'node_modules/@spacesops/react-native-bare-kit/android/src/main/addons'
);

if (!fs.existsSync(bundlePath) || !fs.existsSync(addonsRoot)) {
  process.exit(0);
}

const bundle = fs.readFileSync(bundlePath, 'utf8');
const linked = [
  ...new Set(
    [...bundle.matchAll(/linked:lib[^"'\\]+/g), ...bundle.matchAll(/linked\\:lib[^"'\\]+/g)].map(
      (m) => m[0].replace(/^linked\\?:/, '').replace(/\\$/, '')
    )
  ),
];

/** libbare-fs.4.5.2.so → libbare-fs */
function libraryPrefix(filename) {
  const m = filename.match(/^(lib[^.]+)\./);
  return m ? m[1] : null;
}

const arches = fs.readdirSync(addonsRoot).filter((d) =>
  fs.statSync(path.join(addonsRoot, d)).isDirectory()
);

let copied = 0;

for (const arch of arches) {
  const archDir = path.join(addonsRoot, arch);
  const present = new Set(fs.readdirSync(archDir).filter((f) => f.endsWith('.so')));

  for (const expected of linked) {
    if (present.has(expected)) continue;

    const expectedPrefix = libraryPrefix(expected);
    if (!expectedPrefix) continue;

    const candidate = [...present].find(
      (f) => f.startsWith(`${expectedPrefix}.`) && f.endsWith('.so') && f !== expected
    );
    if (!candidate) continue;

    const dest = path.join(archDir, expected);
    fs.copyFileSync(path.join(archDir, candidate), dest);
    present.add(expected);
    copied++;
    console.log(`[alias-pear-linked-addons] ${arch}: ${candidate} → ${expected}`);
  }
}

if (copied > 0) {
  console.log(`[alias-pear-linked-addons] Created ${copied} alias(es)`);
}

const linkedSet = new Set(linked);
let pruned = 0;

for (const arch of arches) {
  const archDir = path.join(addonsRoot, arch);
  for (const f of fs.readdirSync(archDir)) {
    if (!f.endsWith('.so') || linkedSet.has(f)) continue;

    const prefix = libraryPrefix(f);
    if (!prefix) continue;

    const bundleWantsThisPackage = [...linkedSet].some(
      (name) => libraryPrefix(name) === prefix
    );
    if (!bundleWantsThisPackage) continue;

    // Keep at least one .so per library prefix (the linked name or any alias target).
    const siblings = fs.readdirSync(archDir).filter(
      (name) => name.endsWith('.so') && libraryPrefix(name) === prefix
    );
    if (siblings.length <= 1) continue;

    fs.unlinkSync(path.join(archDir, f));
    pruned++;
    console.log(`[alias-pear-linked-addons] ${arch}: removed stale ${f}`);
  }
}

if (pruned > 0) {
  console.log(`[alias-pear-linked-addons] Pruned ${pruned} stale addon(s)`);
}

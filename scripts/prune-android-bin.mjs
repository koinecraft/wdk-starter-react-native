#!/usr/bin/env node
/**
 * Some installs copy `android/src` → `android/bin`, which makes Expo autolinking
 * register each Package twice (e.g. DevLauncherController double-init).
 */
import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const nodeModules = new URL('../node_modules/', import.meta.url).pathname;

async function pruneAndroidBin(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(root, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'android') {
          const binPath = join(fullPath, 'bin');
          try {
            const binStat = await stat(binPath);
            if (binStat.isDirectory()) {
              await rm(binPath, { recursive: true, force: true });
            }
          } catch {
            // no android/bin
          }
        } else if (entry.name !== '.bin' && !entry.name.startsWith('.')) {
          await pruneAndroidBin(fullPath);
        }
      }
    })
  );
}

await pruneAndroidBin(nodeModules);

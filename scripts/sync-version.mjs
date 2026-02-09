#!/usr/bin/env node

/**
 * sync version from root package.json to all other version locations.
 * run with: node scripts/sync-version.mjs [--check]
 *
 * --check: only verify all versions match (exits 1 if they don't)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const checkOnly = process.argv.includes("--check");

const rootPkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf-8"));
const version = rootPkg.version;

if (!version) {
  console.error("error: no version found in root package.json");
  process.exit(1);
}

console.log(`root version: ${version}`);

const jsonTargets = [
  "core/package.json",
  "apps/app/package.json",
];

let allMatch = true;

for (const rel of jsonTargets) {
  const abs = resolve(root, rel);
  if (!existsSync(abs)) {
    console.log(`  skip: ${rel} (not found)`);
    continue;
  }

  const content = readFileSync(abs, "utf-8");
  const parsed = JSON.parse(content);
  const current = parsed.version;

  if (current === version) {
    console.log(`  ok:   ${rel} (${current})`);
    continue;
  }

  allMatch = false;

  if (checkOnly) {
    console.log(`  MISMATCH: ${rel} (${current} != ${version})`);
  } else {
    parsed.version = version;
    writeFileSync(abs, JSON.stringify(parsed, null, 2) + "\n");
    console.log(`  updated: ${rel} (${current} -> ${version})`);
  }
}

// Cargo.toml no longer exists (Tauri was removed in v2 refactor)

if (checkOnly && !allMatch) {
  console.error("\nversion mismatch detected. run 'pnpm run version:sync' to fix.");
  process.exit(1);
}

console.log(checkOnly ? "\nall versions in sync." : "\nversion sync complete.");

const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

const monorepoRoot = path.resolve(__dirname, "../..");
const localModules = path.resolve(__dirname, "node_modules");
const rootModules = path.resolve(monorepoRoot, "node_modules");

// packages that must resolve from the local node_modules
// to avoid version mismatches with the monorepo root
const localOnly = ["react-native-screens", "react-native-safe-area-context", "react-native-svg"];

const extraNodeModules = {};
for (const pkg of localOnly) {
  try {
    extraNodeModules[pkg] = path.resolve(localModules, pkg);
  } catch {}
}

// redirect libsodium WASM builds to our compat shim (native JSI + tweetnacl).
// the core library imports "libsodium-wrappers-sumo" which uses WASM
// and doesn't work in hermes. the compat shim wraps react-native-libsodium
// (native C via JSI) and fills in missing functions.
const sodiumRedirects = new Set([
  "libsodium-wrappers-sumo",
  "libsodium-sumo",
  "libsodium-wrappers",
]);

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [localModules, rootModules],
    extraNodeModules,
    resolveRequest: (context, moduleName, platform) => {
      // redirect libsodium WASM to our compat shim (native JSI + tweetnacl)
      if (sodiumRedirects.has(moduleName)) {
        return {
          filePath: path.resolve(__dirname, "src/stubs/libsodium-compat.js"),
          type: "sourceFile",
        };
      }
      // react-native-svg/css doesn't exist in v13 — stub it out
      if (moduleName === "react-native-svg/css") {
        return {
          filePath: path.resolve(__dirname, "src/stubs/react-native-svg-css.js"),
          type: "sourceFile",
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);

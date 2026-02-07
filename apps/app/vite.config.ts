import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// mobile-only native modules that must never enter the web/electron bundle
const nativeOnlyModules = [
  "react-native-vision-camera",
  "react-native-libsodium",
  "react-native-tcp-socket",
  "react-native-network-info",
  "react-native-zeroconf",
  "react-native-get-random-values",
  "react-native-haptic-feedback",
  "@react-native-clipboard/clipboard",
];

/**
 * vite plugin to transform .js files that contain JSX syntax.
 * some react-native packages (e.g. react-native-qrcode-svg) ship
 * JSX in plain .js files, which rollup/commonjs can't parse.
 */
function jsxInJsPlugin(): Plugin {
  return {
    name: "jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
      if (!id.endsWith(".js") || !id.includes("node_modules")) return null;
      if (!code.includes("<") || !code.includes("/>")) return null;

      const esbuild = await import("esbuild");
      const result = await esbuild.transform(code, {
        loader: "jsx",
        jsx: "automatic",
      });
      return { code: result.code, map: result.map || null };
    },
  };
}

/**
 * vite plugin that stubs mobile-only native modules so they never
 * reach esbuild's dependency optimizer (dev) or rollup (prod).
 */
function nativeModuleStubPlugin(): Plugin {
  return {
    name: "native-module-stub",
    enforce: "pre",
    resolveId(source) {
      if (nativeOnlyModules.some((m) => source === m || source.startsWith(m + "/"))) {
        return { id: `\0stub:${source}`, moduleSideEffects: false };
      }
      return null;
    },
    load(id) {
      if (id.startsWith("\0stub:")) {
        return "export default {}; export {};";
      }
      return null;
    },
  };
}

/**
 * vite config for building the electron renderer (react-native-web).
 *
 * aliases react-native → react-native-web so RN components render in browser.
 * the output goes to web/dist/ which the electron main process loads.
 */
export default defineConfig({
  plugins: [nativeModuleStubPlugin(), jsxInJsPlugin(), react()],
  root: __dirname,
  base: "./",
  build: {
    outDir: "web/dist",
    emptyDirBeforeWrite: true,
  },
  resolve: {
    alias: {
      // react-native internal modules used by react-native-screens —
      // these don't exist in react-native-web, so we stub them
      "react-native/Libraries/Utilities/codegenNativeComponent": path.resolve(
        __dirname,
        "src/stubs/codegenNativeComponent.js",
      ),
      "react-native/Libraries/Utilities/codegenNativeCommands": path.resolve(
        __dirname,
        "src/stubs/codegenNativeCommands.js",
      ),
      "react-native/Libraries/ReactNative/AppContainer": path.resolve(
        __dirname,
        "src/stubs/AppContainer.js",
      ),
      "react-native/Libraries/Components/View/ReactNativeStyleAttributes": path.resolve(
        __dirname,
        "src/stubs/ReactNativeStyleAttributes.js",
      ),
      // core aliases
      "react-native": "react-native-web",
      "react-native-svg": "react-native-svg-web",
      // libsodium ESM dist is incomplete — alias to CJS
      "libsodium-wrappers-sumo": path.resolve(
        __dirname,
        "../../node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js",
      ),
    },
    extensions: [
      ".web.tsx",
      ".web.ts",
      ".web.jsx",
      ".web.js",
      ".tsx",
      ".ts",
      ".jsx",
      ".js",
    ],
  },
  optimizeDeps: {
    exclude: nativeOnlyModules,
    esbuildOptions: {
      mainFields: ["browser", "module", "main"],
      resolveExtensions: [
        ".web.tsx",
        ".web.ts",
        ".web.jsx",
        ".web.js",
        ".tsx",
        ".ts",
        ".jsx",
        ".js",
      ],
      loader: {
        ".js": "jsx",
      },
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development",
    ),
    __DEV__: process.env.NODE_ENV !== "production",
  },
});

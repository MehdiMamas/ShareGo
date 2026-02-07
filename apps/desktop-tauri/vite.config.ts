import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import type { Plugin } from "vite";

// libsodium-wrappers-sumo's ESM build imports ./libsodium-sumo.mjs
// but that file lives in the separate libsodium-sumo package
function fixLibsodiumEsm(): Plugin {
  return {
    name: "fix-libsodium-esm",
    resolveId(source, importer) {
      if (
        source === "./libsodium-sumo.mjs" &&
        importer?.includes("libsodium-wrappers-sumo")
      ) {
        return path.resolve(
          __dirname,
          "../../node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs",
        );
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), fixLibsodiumEsm()],
  resolve: {
    alias: {
      "@sharego/core": path.resolve(__dirname, "../../core/src"),
    },
  },
  optimizeDeps: {
    // libsodium ESM uses top-level await which esbuild can't handle —
    // exclude from pre-bundling so the vite plugin resolves it at serve time
    exclude: ["libsodium-wrappers-sumo", "libsodium-sumo"],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});

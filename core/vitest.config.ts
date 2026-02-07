import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // libsodium ESM dist is incomplete — alias to CJS for vitest
      "libsodium-wrappers-sumo": path.resolve(
        __dirname,
        "../node_modules/libsodium-wrappers-sumo/dist/modules-sumo/libsodium-wrappers.js",
      ),
    },
  },
});

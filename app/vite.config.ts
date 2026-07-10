import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Import the pure engine source and the ETL artifact directly. The engine
      // stays a sibling package; Vite transpiles/bundles its TS as project source.
      "@engine": resolve(here, "../engine/src"),
      "@data": resolve(here, "../data"),
    },
  },
  // allow dev server to read the sibling engine/ and data/ directories
  server: { fs: { allow: [resolve(here, "..")] } },
});

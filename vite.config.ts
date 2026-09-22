/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import pkg from "./package.json";

export default defineConfig({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
  test: {
    timeout: 60_000,
  },
});

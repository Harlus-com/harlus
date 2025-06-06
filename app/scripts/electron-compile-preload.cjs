#!/usr/bin/env node
/**
 * Bundle Electron main process with esbuild,
 * inlining dependencies like `mime`.
 */
const { build } = require("esbuild");
const path = require("path");

(async () => {
  try {
    await build({
      entryPoints: [path.resolve(__dirname, "../electron/preload.ts")],
      bundle: true,
      platform: "node",
      external: ["electron"], // leave Electron runtime out
      outfile: path.resolve(__dirname, "../dist-electron/preload.cjs"),
      format: "cjs",
      sourcemap: false,
    });
    console.log("Electron main bundled successfully");
  } catch (err) {
    console.error("Error bundling Electron preload:", err);
    process.exit(1);
  }
})();

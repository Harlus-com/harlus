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
      entryPoints: [path.resolve(__dirname, "../electron/main.ts")],
      bundle: true,
      platform: "node",
      external: ["electron"], // leave Electron runtime out
      outfile: path.resolve(__dirname, "../dist-electron/main.cjs"),
      format: "cjs",
      sourcemap: false,
      // addition to handle 
      loader: {
        ".node": "file",
      },

    });
    console.log("Electron main bundled successfully");
  } catch (err) {
    console.error("Error bundling Electron main:", err);
    process.exit(1);
  }
})();

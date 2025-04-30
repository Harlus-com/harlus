const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Run TypeScript compilation
console.log("Compiling Electron TypeScript files...");
execSync("tsc -p electron/tsconfig.json", { stdio: "inherit" });

// Rename .js files to .cjs
console.log("Renaming .js files to .cjs...");
const dir = "dist-electron";
fs.readdirSync(dir)
  .filter((f) => f.endsWith(".js"))
  .forEach((f) => {
    const oldPath = path.join(dir, f);
    const newPath = path.join(dir, f.replace(".js", ".cjs"));
    fs.renameSync(oldPath, newPath);
    console.log(`Renamed ${f} to ${f.replace(".js", ".cjs")}`);
  });

console.log("Electron TypeScript compilation complete!");

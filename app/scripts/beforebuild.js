import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Paths ===
const projectRoot = path.resolve(__dirname, "..", ".."); // harlus/
const serverSource = path.join(projectRoot, "server"); // harlus/server
const destServerDir = path.join(projectRoot, "app", "dist-electron", "server");
const venvDir = path.join(destServerDir, ".venv");

// === Helpers ===
function copy(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing: ${src}`);
  }
  fs.cpSync(src, dest, { recursive: true });
}

// === Main ===
export default async function beforeBuild() {
  console.log("🔧 Setting up embedded FastAPI server…");

  if (fs.existsSync(destServerDir)) {
    fs.rmSync(destServerDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destServerDir, { recursive: true });

  console.log("📂 Copying source files…");
  copy(path.join(serverSource, "main.py"), path.join(destServerDir, "main.py"));
  copy(path.join(serverSource, "src"), path.join(destServerDir, "src"));

  // TODO: We should really be createing this from sctach...
  console.log("🐍 Copying pre-built virtual environment…");
  copy(path.join(projectRoot, "python", "env", ".venv"), venvDir);

  console.log("✅ Embedded FastAPI server is ready.");
}

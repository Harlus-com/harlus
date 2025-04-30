import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper file that runs before packaging the electron app.
// It copies the fastapi-server executable into the dist-electron/server directory.
// In turn electron packaging puts that in the app bundle, as a resource.

export default async function (context) {
  const isWindows = context.platform.nodeName !== "darwin";
  const binaryName = isWindows ? "fastapi-server.exe" : "fastapi-server";

  const sourceBinary = path.resolve(
    __dirname,
    "..",
    "..",
    "server",
    "dist",
    binaryName
  );
  const destDir = path.join(__dirname, "..", "dist-electron", "server");

  if (!fs.existsSync(sourceBinary)) {
    throw new Error(`Cannot find FastAPI binary at: ${sourceBinary}`);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const destBinary = path.join(destDir, binaryName);
  fs.copyFileSync(sourceBinary, destBinary);

  if (!isWindows) {
    fs.chmodSync(destBinary, 0o755);
  }

  console.log(`Copied FastAPI binary to: ${destBinary}`);
}

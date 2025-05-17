import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper file that runs before packaging the electron app.
// It copies the TLS certificates into the dist-electron/tls directory.
// In turn electron packaging puts those in the app bundle as resources.

export default async function (context) {
  const tlsDir = path.resolve(
    __dirname,
    "..",
    "..",
    "infra",
    "nginx-mtls",
    "tls"
  );
  const destDir = path.join(__dirname, "..", "dist-electron", "tls");

  const certFiles = ["client.crt", "client.key", "ca.crt"];

  if (!fs.existsSync(tlsDir)) {
    throw new Error(`Cannot find TLS directory at: ${tlsDir}`);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  for (const certFile of certFiles) {
    const sourceFile = path.join(tlsDir, certFile);
    const destFile = path.join(destDir, certFile);

    if (!fs.existsSync(sourceFile)) {
      throw new Error(`Cannot find certificate file at: ${sourceFile}`);
    }

    fs.copyFileSync(sourceFile, destFile);
    console.log(`Copied ${certFile} to: ${destFile}`);
  }
}

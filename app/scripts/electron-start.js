import { spawn } from "child_process";
import http from "http";

// This script starts the Vite dev server and the Electron app
// In production / when packaged, the electron app will start from the dist/index.html file
// Moreoever, in production, it will enter via (the compiled) main.ts file.
// This script and electron.js are only used in development.

const args = process.argv.slice(2); // Skip the first two: node and script path

let viteProcess = null;

function startViteDevServer() {
  console.log("Starting Vite development server...");
  viteProcess = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    shell: true,
  });
}

function waitForDevServer() {
  return new Promise((resolve) => {
    const checkServer = () => {
      const request = http.get("http://localhost:8080", (response) => {
        if (response.statusCode === 200) {
          console.log("UI server is ready!");
          resolve();
        } else {
          console.log("Non-200 status code from UI server. Waiting...");
          setTimeout(checkServer, 500);
        }
      });

      request.on("error", () => {
        console.log("No response from UI server. Waiting...");
        setTimeout(checkServer, 500);
      });
    };

    checkServer();
  });
}

// Start Electron app
function startElectronApp() {
  console.log("Starting Electron application...");
  const electronProcess = spawn("electron", ["scripts/electron.js", ...args], {
    stdio: "inherit",
    shell: true,
  });

  electronProcess.on("close", () => {
    // Clean up when Electron app closes
    if (viteProcess) {
      console.log("Shutting down Vite development server...");
      viteProcess.kill();
    }
    process.exit();
  });
}

// Main start function
async function start() {
  console.log("Starting Vite development server...");
  startViteDevServer();
  await waitForDevServer();

  startElectronApp();
}

// Run the start function
start().catch((err) => {
  console.error("Error starting application:", err);
  process.exit(1);
});

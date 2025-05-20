import { DevElectronApp, ProductionElectronApp } from "./electron_app";

const args = process.argv;
const dev = !!args.find((arg) => arg === "--dev");
if (dev) {
  const app = new DevElectronApp();
  app.start();
} else {
  const app = new ProductionElectronApp();
  app.start();
}

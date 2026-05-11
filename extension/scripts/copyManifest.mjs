import { cpSync, copyFileSync, existsSync } from "node:fs";

copyFileSync("manifest.json", "dist/manifest.json");

if (existsSync("icons")) {
  cpSync("icons", "dist/icons", { recursive: true });
}

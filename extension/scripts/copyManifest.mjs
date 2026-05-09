import { copyFileSync } from "node:fs";

copyFileSync("manifest.json", "dist/manifest.json");

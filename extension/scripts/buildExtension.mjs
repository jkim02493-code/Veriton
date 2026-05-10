import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const viteBin = join("node_modules", "vite", "bin", "vite.js");

for (const target of ["content", "background"]) {
  const result = spawnSync(process.execPath, [viteBin, "build"], {
    env: { ...process.env, BUILD_TARGET: target },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const staleSharedChunk = join("dist", "assets", "queryTranslator.js");
if (existsSync(staleSharedChunk)) {
  rmSync(staleSharedChunk);
}

import { spawnSync } from "node:child_process";

const reverse = spawnSync(process.execPath, ["scripts/adb-reverse.mjs", "8081"], {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});

if (reverse.status !== 0) {
  process.exit(reverse.status ?? 1);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCommand, ["--workspace", "@gigeze/mobile", "run", "android"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    REACT_NATIVE_PACKAGER_HOSTNAME: "127.0.0.1",
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);

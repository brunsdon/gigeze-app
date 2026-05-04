import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const port = process.argv[2] ?? "8081";
const adbName = process.platform === "win32" ? "adb.exe" : "adb";

const sdkRoots = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Android", "Sdk") : undefined,
  process.env.HOME ? join(process.env.HOME, "Android", "Sdk") : undefined,
].filter(Boolean);

const pathCandidates = (process.env.PATH ?? "")
  .split(process.platform === "win32" ? ";" : ":")
  .filter(Boolean)
  .map((entry) => join(entry, adbName));

const sdkCandidates = sdkRoots.map((root) => join(root, "platform-tools", adbName));
const adb = [...pathCandidates, ...sdkCandidates].find((candidate) => existsSync(candidate));

if (!adb) {
  console.error(
    [
      "Unable to find adb.",
      "Install Android SDK Platform-Tools or add its platform-tools folder to PATH.",
      "Checked PATH, ANDROID_HOME, ANDROID_SDK_ROOT, and the default local Android SDK path.",
    ].join("\n"),
  );
  process.exit(1);
}

const result = spawnSync(adb, ["reverse", `tcp:${port}`, `tcp:${port}`], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);

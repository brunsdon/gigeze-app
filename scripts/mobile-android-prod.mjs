import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(scriptDirectory, "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const androidRoot = join(mobileRoot, "android");
const mobileEnvPath = join(mobileRoot, ".env");
const releaseApkPath = join(androidRoot, "app", "build", "outputs", "apk", "release", "app-release.apk");

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Missing ${filePath}. Create apps/mobile/.env with production values first.`);
  }

  const values = {};
  const contents = readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const rawValue = normalizedLine.slice(separatorIndex + 1).trim();
    values[key] = unquoteEnvValue(rawValue);
  }

  return values;
}

function unquoteEnvValue(value) {
  if (value.length < 2) {
    return value;
  }

  const first = value[0];
  const last = value[value.length - 1];
  if ((first === `"` && last === `"`) || (first === `'` && last === `'`)) {
    return value.slice(1, -1);
  }

  return value;
}

function findAdb() {
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
  return [...pathCandidates, ...sdkCandidates].find((candidate) => existsSync(candidate));
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const envValues = parseEnvFile(mobileEnvPath);
const buildEnv = {
  ...process.env,
  ...envValues,
  NODE_ENV: "production",
  EXPO_PUBLIC_APP_ENV: envValues.EXPO_PUBLIC_APP_ENV ?? "production",
  EXPO_PUBLIC_SUPABASE_URL: envValues.EXPO_PUBLIC_SUPABASE_URL ?? envValues.NEXT_PUBLIC_SUPABASE_URL ?? "",
  EXPO_PUBLIC_SUPABASE_ANON_KEY:
    envValues.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? envValues.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

for (const key of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_WEB_API_URL"]) {
  if (!buildEnv[key]) {
    throw new Error(`Missing ${key} in apps/mobile/.env.`);
  }
}

if (process.platform === "win32") {
  run("cmd.exe", ["/d", "/s", "/c", "gradlew.bat app:assembleRelease -x lint -x test --build-cache"], {
    cwd: androidRoot,
    env: buildEnv,
  });
} else {
  run(join(androidRoot, "gradlew"), ["app:assembleRelease", "-x", "lint", "-x", "test", "--build-cache"], {
    cwd: androidRoot,
    env: buildEnv,
  });
}

if (!existsSync(releaseApkPath)) {
  throw new Error(`Expected release APK was not created: ${releaseApkPath}`);
}

const adb = findAdb();
if (!adb) {
  throw new Error("Unable to find adb. Install Android SDK Platform-Tools or add platform-tools to PATH.");
}

run(adb, ["install", "-r", releaseApkPath]);
run(adb, ["shell", "monkey", "-p", "com.gigeze.mobile", "-c", "android.intent.category.LAUNCHER", "1"]);

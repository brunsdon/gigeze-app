"use client";

import packageJson from "../../../package.json";

export type AppVersionInfo = {
  versionName: string;
  versionCode: number;
  platform: "web";
};

const WEB_VERSION_NAME = process.env.NEXT_PUBLIC_APP_VERSION ?? packageJson.version ?? "0.0.0";

function getFallbackAppVersion(): AppVersionInfo {
  return {
    versionName: WEB_VERSION_NAME,
    versionCode: 0,
    platform: "web",
  };
}

export function useAppVersion(): AppVersionInfo {
  return getFallbackAppVersion();
}

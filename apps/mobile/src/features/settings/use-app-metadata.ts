import { useMemo } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getMobileConfig, type MobileConfig } from "../../lib/config";

export type AppRuntimeKind = "Expo Go" | "Development Build" | "Standalone" | "Web" | "Unknown";

export type AppMetadata = {
  appName: string;
  appVersion: string;
  appBuild: string;
  runtimeKind: AppRuntimeKind;
  runtimeRaw: string;
  platform: typeof Platform.OS;
  platformLabel: string;
  environmentName: string;
  webApiUrl: string;
  webApiUrlWarning: string | null;
  supabaseUrlConfigured: boolean;
  supabaseAnonKeyConfigured: boolean;
  isExpoGo: boolean;
  isDevelopmentBuild: boolean;
  isStandalone: boolean;
  isDevice: boolean | null;
  deviceKind: "Device" | "Emulator" | "Unknown";
};

type ExpoRuntimeConstants = {
  appOwnership?: string | null;
  nativeAppVersion?: unknown;
  nativeBuildVersion?: unknown;
  expoConfig?: {
    name?: string | null;
    version?: string | null;
    android?: {
      versionCode?: number | string | null;
    } | null;
    ios?: {
      buildNumber?: string | null;
    } | null;
  } | null;
  isDevice?: boolean | null;
};

function toDisplayString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const displayValue = String(value).trim();
  return displayValue.length > 0 ? displayValue : null;
}

function getRuntimeKind(appOwnership: string | null | undefined, platform: typeof Platform.OS): AppRuntimeKind {
  if (platform === "web") {
    return "Web";
  }

  if (appOwnership === "expo") {
    return "Expo Go";
  }

  if (appOwnership === "guest") {
    return "Development Build";
  }

  if (appOwnership === "standalone") {
    return "Standalone";
  }

  return "Unknown";
}

function getPlatformLabel(platform: typeof Platform.OS) {
  if (platform === "android") {
    return "Android";
  }

  if (platform === "ios") {
    return "iOS";
  }

  if (platform === "web") {
    return "Web";
  }

  return String(platform);
}

function getAppBuild(constants: ExpoRuntimeConstants, platform: typeof Platform.OS) {
  const nativeBuildVersion = toDisplayString(constants.nativeBuildVersion);
  if (nativeBuildVersion) {
    return nativeBuildVersion;
  }

  if (platform === "android" && constants.expoConfig?.android?.versionCode !== undefined && constants.expoConfig.android.versionCode !== null) {
    return String(constants.expoConfig.android.versionCode);
  }

  if (platform === "ios") {
    const buildNumber = toDisplayString(constants.expoConfig?.ios?.buildNumber);
    if (buildNumber) {
      return buildNumber;
    }
  }

  return "unavailable";
}

export function deriveAppMetadata(config: MobileConfig, constants: ExpoRuntimeConstants, platform: typeof Platform.OS): AppMetadata {
  const runtimeRaw = constants.appOwnership ?? "unknown";
  const runtimeKind = getRuntimeKind(constants.appOwnership, platform);
  const isDevice = typeof constants.isDevice === "boolean" ? constants.isDevice : null;
  const nativeAppVersion = toDisplayString(constants.nativeAppVersion);
  const expoConfigVersion = toDisplayString(constants.expoConfig?.version);
  const configAppVersion = toDisplayString(config.appVersion);

  return {
    appName: constants.expoConfig?.name ?? config.appName,
    appVersion: nativeAppVersion || expoConfigVersion || configAppVersion || "unavailable",
    appBuild: getAppBuild(constants, platform),
    runtimeKind,
    runtimeRaw,
    platform,
    platformLabel: getPlatformLabel(platform),
    environmentName: config.appEnvironment || "unknown",
    webApiUrl: config.webApiBaseUrl || "missing",
    webApiUrlWarning: config.webApiBaseUrlWarning,
    supabaseUrlConfigured: Boolean(config.supabaseUrl),
    supabaseAnonKeyConfigured: Boolean(config.supabaseAnonKey),
    isExpoGo: runtimeKind === "Expo Go",
    isDevelopmentBuild: runtimeKind === "Development Build",
    isStandalone: runtimeKind === "Standalone",
    isDevice,
    deviceKind: isDevice === null ? "Unknown" : isDevice ? "Device" : "Emulator",
  };
}

export function useAppMetadata() {
  return useMemo(() => deriveAppMetadata(getMobileConfig(), Constants as ExpoRuntimeConstants, Platform.OS), []);
}

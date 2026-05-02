import { describe, expect, it, vi } from "vitest";
import { deriveAppMetadata } from "./use-app-metadata";
import type { MobileConfig } from "../../lib/config";

vi.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}));

vi.mock("expo-constants", () => ({
  default: {
    appOwnership: "guest",
    expoConfig: {},
  },
}));

function createConfig(overrides: Partial<MobileConfig> = {}): MobileConfig {
  return {
    appName: "GigEze",
    appVersion: "0.1.0",
    appEnvironment: "development",
    platform: "android",
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-secret",
    webApiBaseUrl: "http://10.0.2.2:3000",
    webApiBaseUrlWarning: null,
    googleMapsApiKeyConfigured: false,
    ...overrides,
  };
}

describe("deriveAppMetadata", () => {
  it("labels Expo Go and keeps config visibility secret-safe", () => {
    const metadata = deriveAppMetadata(
      createConfig(),
      {
        appOwnership: "expo",
        expoConfig: { name: "GigEze", version: "0.1.0", android: { versionCode: 12 } },
        isDevice: false,
      },
      "android",
    );

    expect(metadata).toMatchObject({
      appName: "GigEze",
      appVersion: "0.1.0",
      appBuild: "12",
      runtimeKind: "Expo Go",
      isExpoGo: true,
      isDevelopmentBuild: false,
      platformLabel: "Android",
      deviceKind: "Emulator",
      webApiUrl: "http://10.0.2.2:3000",
      webApiUrlWarning: null,
      supabaseUrlConfigured: true,
      supabaseAnonKeyConfigured: true,
    });
    expect(JSON.stringify(metadata)).not.toContain("anon-secret");
  });

  it("prefers native version/build values for development builds", () => {
    const metadata = deriveAppMetadata(
      createConfig(),
      {
        appOwnership: "guest",
        nativeAppVersion: "0.2.0",
        nativeBuildVersion: "42",
        isDevice: true,
      },
      "android",
    );

    expect(metadata).toMatchObject({
      appVersion: "0.2.0",
      appBuild: "42",
      runtimeKind: "Development Build",
      isDevelopmentBuild: true,
      deviceKind: "Device",
    });
  });

  it("coerces numeric native version/build values without crashing", () => {
    const metadata = deriveAppMetadata(
      createConfig(),
      {
        appOwnership: "guest",
        nativeAppVersion: 2,
        nativeBuildVersion: 42,
      },
      "android",
    );

    expect(metadata).toMatchObject({
      appVersion: "2",
      appBuild: "42",
      runtimeKind: "Development Build",
    });
  });

  it("handles missing build/config values explicitly", () => {
    const metadata = deriveAppMetadata(
      createConfig({
        supabaseUrl: "",
        supabaseAnonKey: "",
        webApiBaseUrl: "",
        webApiBaseUrlWarning: "EXPO_PUBLIC_WEB_API_URL is missing. Production sync will not work.",
        appEnvironment: "",
      }),
      { appOwnership: null, expoConfig: {} },
      "ios",
    );

    expect(metadata).toMatchObject({
      appBuild: "unavailable",
      runtimeKind: "Unknown",
      platformLabel: "iOS",
      environmentName: "unknown",
      webApiUrl: "missing",
      webApiUrlWarning: "EXPO_PUBLIC_WEB_API_URL is missing. Production sync will not work.",
      supabaseUrlConfigured: false,
      supabaseAnonKeyConfigured: false,
      deviceKind: "Unknown",
    });
  });
});

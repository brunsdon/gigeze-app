import Constants from "expo-constants";
import { Platform } from "react-native";

export const PRODUCTION_WEB_API_BASE_URL = "https://www.gigeze.online";

export type MobileConfig = {
  appName: string;
  appVersion: string;
  appEnvironment: string;
  platform: typeof Platform.OS;
  supabaseUrl: string;
  supabaseAnonKey: string;
  webApiBaseUrl: string;
  webApiBaseUrlWarning: string | null;
  googleMapsApiKeyConfigured: boolean;
};

type ExtraConfig = Partial<MobileConfig>;

export function hasSupabaseConfig(config: MobileConfig): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function getMissingSupabaseConfigKeys(config: MobileConfig): string[] {
  return [
    config.supabaseUrl ? null : "EXPO_PUBLIC_SUPABASE_URL",
    config.supabaseAnonKey ? null : "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((key): key is string => Boolean(key));
}

export function getWebApiBaseUrlWarning(webApiBaseUrl: string): string | null {
  if (!webApiBaseUrl.trim()) {
    return "EXPO_PUBLIC_WEB_API_URL is missing. Production sync will not work.";
  }

  try {
    const parsedUrl = new URL(webApiBaseUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return "EXPO_PUBLIC_WEB_API_URL must start with http:// or https://.";
    }
  } catch {
    return "EXPO_PUBLIC_WEB_API_URL is not a valid URL.";
  }

  return null;
}

export function getMobileConfig(): MobileConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;
  const webApiBaseUrl = extra.webApiBaseUrl ?? process.env.EXPO_PUBLIC_WEB_API_URL ?? PRODUCTION_WEB_API_BASE_URL;

  return {
    appName: Constants.expoConfig?.name ?? "GigEze",
    appVersion: Constants.expoConfig?.version ?? "0.1.0",
    appEnvironment: extra.appEnvironment ?? "development",
    platform: Platform.OS,
    supabaseUrl: extra.supabaseUrl ?? "",
    supabaseAnonKey: extra.supabaseAnonKey ?? "",
    webApiBaseUrl,
    webApiBaseUrlWarning: getWebApiBaseUrlWarning(webApiBaseUrl),
    googleMapsApiKeyConfigured: Boolean(extra.googleMapsApiKeyConfigured ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
  };
}

export function requireSupabaseConfig(config = getMobileConfig()): Pick<MobileConfig, "supabaseUrl" | "supabaseAnonKey"> {
  if (!hasSupabaseConfig(config)) {
    throw new Error(`Supabase is not configured. Missing: ${getMissingSupabaseConfigKeys(config).join(", ")}.`);
  }

  return {
    supabaseUrl: config.supabaseUrl,
    supabaseAnonKey: config.supabaseAnonKey,
  };
}

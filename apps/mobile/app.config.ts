import type { ExpoConfig } from "expo/config";

const productionWebApiBaseUrl = "https://www.gigeze.online";
const webApiBaseUrl = process.env.EXPO_PUBLIC_WEB_API_URL ?? productionWebApiBaseUrl;
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function warnIfInvalidWebApiBaseUrl(value: string) {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      console.warn("EXPO_PUBLIC_WEB_API_URL should start with http:// or https://.");
    }
  } catch {
    console.warn(`EXPO_PUBLIC_WEB_API_URL is not a valid URL: ${value || "(empty)"}`);
  }
}

warnIfInvalidWebApiBaseUrl(webApiBaseUrl);

const config: ExpoConfig = {
  name: "GigEze",
  slug: "gigeze-mobile",
  scheme: "gigeze",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    bundleIdentifier: "com.gigeze.mobile",
    config: googleMapsApiKey ? {
      googleMapsApiKey,
    } : undefined,
    supportsTablet: false
  },
  android: {
    package: "com.gigeze.mobile",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0B0B0F"
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION"
    ],
    config: googleMapsApiKey ? {
      googleMaps: {
        apiKey: googleMapsApiKey,
      },
    } : undefined
  },
  plugins: [
    [
      "expo-location",
      {
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        locationAlwaysAndWhenInUsePermission: "Allow GigEze to record trip location while a trip is active."
      }
    ]
  ],
  extra: {
    appEnvironment: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
    supabaseUrl,
    supabaseAnonKey,
    webApiBaseUrl,
    googleMapsApiKeyConfigured: Boolean(googleMapsApiKey),
  }
};

export default config;

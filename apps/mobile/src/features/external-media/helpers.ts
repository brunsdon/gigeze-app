import type { MobileTripSession } from "../trips/trip-workflow";

export type MobileExternalMediaEntityType = "Tour" | "TRIP" | "MOMENT" | "STORY";
export type MobileExternalMediaPlatform = "flickr" | "youtube" | "instagram" | "tiktok" | "facebook" | "generic";

export type MobileExternalMediaTarget = {
  entityType: MobileExternalMediaEntityType;
  entityId: string;
  label: string;
};

export type DeepLinkTarget = {
  appUrl: string;
  fallbackUrl: string;
  androidIntent?: {
    action: string;
    category: string;
    data: string;
    packageName: string;
  };
};

export type MobileDeepLinkRuntimePlatform = "android" | "ios" | "web" | "windows" | "macos";

const supportedClipboardHosts = ["flickr.com", "flic.kr", "instagram.com", "youtube.com", "youtu.be", "tiktok.com"];

export function getExternalMediaTargetForTrip(trip: MobileTripSession): MobileExternalMediaTarget | null {
  if (typeof trip.journeyId === "string" && trip.journeyId.trim().length > 0) {
    return {
      entityType: "Tour",
      entityId: trip.journeyId,
      label: trip.journeyTitle?.trim() || "Tour",
    };
  }

  if (typeof trip.backendTripId === "string" && trip.backendTripId.trim().length > 0) {
    return {
      entityType: "TRIP",
      entityId: trip.backendTripId,
      label: trip.title,
    };
  }

  return null;
}

export function detectMobileExternalMediaPlatform(url: string): MobileExternalMediaPlatform {
  const normalized = url.trim().toLowerCase();

  if (normalized.includes("flickr.com") || normalized.includes("flic.kr")) {
    return "flickr";
  }

  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) {
    return "youtube";
  }

  if (normalized.includes("instagram.com")) {
    return "instagram";
  }

  if (normalized.includes("tiktok.com")) {
    return "tiktok";
  }

  if (normalized.includes("facebook.com") || normalized.includes("fb.watch")) {
    return "facebook";
  }

  return "generic";
}

export function getPlatformDetectedLabel(platform: MobileExternalMediaPlatform) {
  switch (platform) {
    case "flickr":
      return "Flickr photo detected";
    case "youtube":
      return "YouTube video detected";
    case "instagram":
      return "Instagram post detected";
    case "tiktok":
      return "TikTok post detected";
    case "facebook":
      return "Facebook post detected";
    case "generic":
      return "Link detected";
  }
}

export function getPlatformDisplayName(platform: MobileExternalMediaPlatform) {
  switch (platform) {
    case "flickr":
      return "Flickr";
    case "youtube":
      return "YouTube";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "facebook":
      return "Facebook";
    case "generic":
      return "Link";
  }
}

export function getDeepLinkTarget(
  platform: "flickr" | "instagram" | "youtube",
  runtimePlatform?: MobileDeepLinkRuntimePlatform,
): DeepLinkTarget {
  if (platform === "flickr") {
    if (runtimePlatform === "android") {
      return {
        appUrl: "https://www.flickr.com/photos",
        fallbackUrl: "https://www.flickr.com/photos",
        androidIntent: {
          action: "android.intent.action.VIEW",
          category: "android.intent.category.BROWSABLE",
          data: "https://www.flickr.com/photos",
          packageName: "com.flickr.android",
        },
      };
    }

    return {
      appUrl: "flickr://",
      fallbackUrl: "https://www.flickr.com",
    };
  }

  if (platform === "instagram") {
    return {
      appUrl: "instagram://camera",
      fallbackUrl: "https://instagram.com",
    };
  }

  return {
    appUrl: "vnd.youtube://",
    fallbackUrl: "https://youtube.com",
  };
}

export function getClipboardExternalMediaCandidate(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!supportedClipboardHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    return null;
  }

  return parsedUrl.toString();
}

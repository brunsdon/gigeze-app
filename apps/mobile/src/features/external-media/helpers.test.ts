import { describe, expect, it } from "vitest";
import type { MobileTripSession } from "../trips/trip-workflow";
import {
  detectMobileExternalMediaPlatform,
  getClipboardExternalMediaCandidate,
  getDeepLinkTarget,
  getExternalMediaTargetForTrip,
  getPlatformDetectedLabel,
} from "./helpers";

function createTrip(overrides: Partial<MobileTripSession> = {}): MobileTripSession {
  return {
    id: "trip-1",
    userId: "user-1",
    status: "completed",
    startedAt: "2026-04-24T00:00:00.000Z",
    endedAt: "2026-04-24T01:00:00.000Z",
    distanceMeters: 1200,
    title: "Trip to Byron",
    sampleCount: 4,
    captureMode: "tracking",
    syncState: "synced",
    createdAt: "2026-04-24T00:00:00.000Z",
    updatedAt: "2026-04-24T01:00:00.000Z",
    ...overrides,
  };
}

describe("external media mobile helpers", () => {
  it("targets the linked Tour before the backend trip id", () => {
    expect(getExternalMediaTargetForTrip(createTrip({
      journeyId: "Tour-1",
      journeyTitle: "Coastal run",
      backendTripId: "log-1",
    }))).toEqual({
      entityType: "Tour",
      entityId: "Tour-1",
      label: "Coastal run",
    });
  });

  it("falls back to the synced trip id when no Tour is linked", () => {
    expect(getExternalMediaTargetForTrip(createTrip({
      backendTripId: "log-1",
    }))).toEqual({
      entityType: "TRIP",
      entityId: "log-1",
      label: "Trip to Byron",
    });
  });

  it("returns null when the trip has not synced and has no Tour", () => {
    expect(getExternalMediaTargetForTrip(createTrip())).toBeNull();
  });

  it("detects mobile platforms from pasted urls", () => {
    expect(detectMobileExternalMediaPlatform("https://www.flickr.com/photos/coburg-testing/123456789")).toBe("flickr");
    expect(detectMobileExternalMediaPlatform("https://flic.kr/p/2abcxyz")).toBe("flickr");
    expect(detectMobileExternalMediaPlatform("https://www.instagram.com/reel/abc")).toBe("instagram");
    expect(detectMobileExternalMediaPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(detectMobileExternalMediaPlatform("https://www.tiktok.com/@creator/video/123")).toBe("tiktok");
    expect(detectMobileExternalMediaPlatform("https://example.com")).toBe("generic");
  });

  it("returns the correct clipboard candidate only for supported hosts", () => {
    expect(getClipboardExternalMediaCandidate("https://www.flickr.com/photos/coburg-testing/123")).toBe("https://www.flickr.com/photos/coburg-testing/123");
    expect(getClipboardExternalMediaCandidate("https://www.instagram.com/p/abc")).toBe("https://www.instagram.com/p/abc");
    expect(getClipboardExternalMediaCandidate("javascript:alert(1)")).toBeNull();
    expect(getClipboardExternalMediaCandidate("https://example.com/article")).toBeNull();
  });

  it("provides native deep link targets with safe fallbacks", () => {
    expect(getDeepLinkTarget("flickr")).toEqual({
      appUrl: "flickr://",
      fallbackUrl: "https://www.flickr.com",
    });
    expect(getDeepLinkTarget("flickr", "android")).toEqual({
      appUrl: "https://www.flickr.com/photos",
      fallbackUrl: "https://www.flickr.com/photos",
      androidIntent: {
        action: "android.intent.action.VIEW",
        category: "android.intent.category.BROWSABLE",
        data: "https://www.flickr.com/photos",
        packageName: "com.flickr.android",
      },
    });
    expect(getDeepLinkTarget("instagram")).toEqual({
      appUrl: "instagram://camera",
      fallbackUrl: "https://instagram.com",
    });
    expect(getDeepLinkTarget("youtube")).toEqual({
      appUrl: "vnd.youtube://",
      fallbackUrl: "https://youtube.com",
    });
  });

  it("returns user-facing detection labels", () => {
    expect(getPlatformDetectedLabel("flickr")).toBe("Flickr photo detected");
    expect(getPlatformDetectedLabel("instagram")).toBe("Instagram post detected");
    expect(getPlatformDetectedLabel("youtube")).toBe("YouTube video detected");
  });
});

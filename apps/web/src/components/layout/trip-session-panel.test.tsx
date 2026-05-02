import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const { mockUseTripTracker } = vi.hoisted(() => ({
  mockUseTripTracker: vi.fn(),
}));

vi.mock("@/features/trips/use-trip-tracker", () => ({
  useTripTracker: mockUseTripTracker,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}));

import { TripSessionPanel } from "@/components/layout/trip-session-panel";

const Tours = [{ id: "j-1", title: "Tasmania Loop", slug: "tasmania-loop" }];

const idleTracker = {
  geolocationSupported: true,
  wakeLockSupported: true,
  wakeLockEnabled: false,
  wakeLockActive: false,
  wakeLockError: null,
  isTracking: false,
  session: null,
  elapsedMs: 0,
  trackingMayBePaused: false,
  resumedAfterBackgroundMs: null,
  hadTrackingGap: false,
  lastError: null,
  startTrip: vi.fn(),
  endTrip: vi.fn(),
  captureSample: vi.fn(),
  setWakeLockEnabled: vi.fn(),
};

describe("TripSessionPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Start trip button and Idle badge when not tracking", () => {
    mockUseTripTracker.mockReturnValue(idleTracker);

    const html = renderToStaticMarkup(
      <TripSessionPanel workspaceId="ws-1" Tours={Tours} />,
    );

    expect(html).toContain("Start trip");
    expect(html).not.toContain("End trip");
    expect(html).toContain("Ready to start");
    expect(html).not.toContain("Trip in progress");
  });

  it("shows End trip button and Trip in progress badge when tracking", () => {
    mockUseTripTracker.mockReturnValue({
      ...idleTracker,
      isTracking: true,
      session: {
        id: "trip-1",
        workspaceId: "ws-1",
        startedAt: new Date("2026-04-08T09:00:00.000Z").toISOString(),
        lastSampleAt: new Date("2026-04-08T09:05:00.000Z").toISOString(),
        totalDistanceKm: 12.3,
        samples: new Array(5).fill({ latitude: -42, longitude: 146, accuracyMeters: 10, recordedAt: new Date().toISOString() }),
      },
    });

    const html = renderToStaticMarkup(
      <TripSessionPanel workspaceId="ws-1" Tours={Tours} />,
    );

    expect(html).toContain("End trip");
    expect(html).not.toContain("Start trip");
    expect(html).toContain("Trip in progress");
    expect(html).toContain("12");
    expect(html).toContain("km");
  });

  it("shows honest foreground guidance and wake lock copy while tracking", () => {
    mockUseTripTracker.mockReturnValue({
      ...idleTracker,
      isTracking: true,
      wakeLockEnabled: true,
      wakeLockActive: true,
      session: {
        id: "trip-1",
        workspaceId: "ws-1",
        startedAt: new Date("2026-04-08T09:00:00.000Z").toISOString(),
        lastSampleAt: new Date("2026-04-08T09:05:00.000Z").toISOString(),
        totalDistanceKm: 12.3,
        samples: [],
      },
    });

    const html = renderToStaticMarkup(
      <TripSessionPanel workspaceId="ws-1" Tours={Tours} />,
    );

    expect(html).toContain("Tracking works best while this screen stays open.");
    expect(html).toContain("Switching apps or locking your phone may pause GPS updates.");
    expect(html).toContain("Keep screen awake during trip");
    expect(html).toContain("Screen awake is active.");
  });

  it("shows resume and pause notices when background gaps are detected", () => {
    mockUseTripTracker.mockReturnValue({
      ...idleTracker,
      isTracking: true,
      trackingMayBePaused: true,
      resumedAfterBackgroundMs: 180_000,
      session: {
        id: "trip-1",
        workspaceId: "ws-1",
        startedAt: new Date("2026-04-08T09:00:00.000Z").toISOString(),
        lastSampleAt: new Date("2026-04-08T09:05:00.000Z").toISOString(),
        totalDistanceKm: 12.3,
        samples: [],
      },
    });

    const html = renderToStaticMarkup(
      <TripSessionPanel workspaceId="ws-1" Tours={Tours} />,
    );

    expect(html).toContain("Tracking resumed after 3 min in the background.");
    expect(html).toContain("Tracking may have paused while the app was in the background.");
  });

  it("shows geolocation unavailable notice when geolocation is not supported", () => {
    mockUseTripTracker.mockReturnValue({
      ...idleTracker,
      geolocationSupported: false,
    });

    const html = renderToStaticMarkup(
      <TripSessionPanel workspaceId="ws-1" Tours={Tours} />,
    );

    expect(html).toContain("Location tracking is unavailable in this browser");
    expect(html).toContain("manual Tour and log entry");
  });

  it("shows prompt to create a Tour when no Tours are provided", () => {
    mockUseTripTracker.mockReturnValue(idleTracker);

    const html = renderToStaticMarkup(
      <TripSessionPanel workspaceId="ws-1" Tours={[]} />,
    );

    expect(html).toContain("Create a Tour before starting trip tracking");
    expect(html).toContain("Start trip");
  });

  it("renders Tour picker when multiple Tours are available and showJourneyPicker is true", () => {
    const multiJourneys = [
      { id: "j-1", title: "Tasmania Loop", slug: "tasmania-loop" },
      { id: "j-2", title: "Nullarbor Sprint", slug: "nullarbor-sprint" },
    ];
    mockUseTripTracker.mockReturnValue(idleTracker);

    const html = renderToStaticMarkup(
      <TripSessionPanel workspaceId="ws-1" Tours={multiJourneys} showJourneyPicker />,
    );

    expect(html).toContain("Tasmania Loop");
    expect(html).toContain("Nullarbor Sprint");
    expect(html).toContain('id="trip-Tour"');
  });

  it("hides Tour picker when showJourneyPicker is false", () => {
    const multiJourneys = [
      { id: "j-1", title: "Tasmania Loop", slug: "tasmania-loop" },
      { id: "j-2", title: "Nullarbor Sprint", slug: "nullarbor-sprint" },
    ];
    mockUseTripTracker.mockReturnValue(idleTracker);

    const html = renderToStaticMarkup(
      <TripSessionPanel workspaceId="ws-1" Tours={multiJourneys} showJourneyPicker={false} />,
    );

    expect(html).not.toContain('id="trip-Tour"');
  });
});

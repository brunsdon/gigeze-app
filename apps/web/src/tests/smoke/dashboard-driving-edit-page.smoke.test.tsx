import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const {
  mockRequireCurrentWorkspace,
  mockGetDrivingLogById,
  mockRefreshDrivingLogGpsEndpointLocations,
  mockListJourneys,
  mockListVehicles,
  mockGetLatestOdometerForVehicle,
} = vi.hoisted(() => ({
  mockRequireCurrentWorkspace: vi.fn(),
  mockGetDrivingLogById: vi.fn(),
  mockRefreshDrivingLogGpsEndpointLocations: vi.fn(),
  mockListJourneys: vi.fn(),
  mockListVehicles: vi.fn(),
  mockGetLatestOdometerForVehicle: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  requireCurrentWorkspace: mockRequireCurrentWorkspace,
}));

vi.mock("@/features/driving-logs/service", () => ({
  getDrivingLogById: mockGetDrivingLogById,
  refreshDrivingLogGpsEndpointLocations: mockRefreshDrivingLogGpsEndpointLocations,
}));

vi.mock("@/features/tours/service", () => ({
  listJourneys: mockListJourneys,
}));

vi.mock("@/features/vehicles/service", () => ({
  getLatestOdometerForVehicle: mockGetLatestOdometerForVehicle,
  listVehicles: mockListVehicles,
}));

vi.mock("@/features/driving-logs/actions", () => ({
  deleteDrivingLogAction: vi.fn(),
  updateDrivingLogAction: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not-found");
  }),
}));

vi.mock("@/components/forms/action-submit-button", () => ({
  ActionSubmitButton: ({ label, className }: { label: string; className?: string }) => (
    <button type="submit" className={className}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/forms/confirm-submit-button", () => ({
  ConfirmSubmitButton: ({ triggerLabel }: { triggerLabel: string }) => <button type="button">{triggerLabel}</button>,
}));

vi.mock("@/components/forms/vehicle-odometer-fields", () => ({
  VehicleOdometerFields: ({ className }: { className?: string }) => <div className={className}>Vehicle odometer fields</div>,
}));

import EditDrivingLogPage from "@/app/(app)/dashboard/logs/driving/[logId]/edit/page";

describe("dashboard driving edit page smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentWorkspace.mockResolvedValue({ id: "workspace-1" });
    mockListJourneys.mockResolvedValue([{ id: "Tour-1", title: "Coburg Testing" }]);
    mockListVehicles.mockResolvedValue([{ id: "vehicle-1", name: "Business Van" }]);
    mockGetLatestOdometerForVehicle.mockResolvedValue(5015);
    mockRefreshDrivingLogGpsEndpointLocations.mockResolvedValue(false);
    mockGetDrivingLogById.mockResolvedValue({
      id: "log-1",
      date: new Date("2026-04-15T00:00:00.000Z"),
      startTime: new Date("2026-04-15T00:26:00.000Z"),
      endTime: new Date("2026-04-15T00:36:00.000Z"),
      tripMode: "DRIVE",
      startLocation: "Coburg North VIC 3058, Australia",
      endLocation: "Brunswick VIC 3056, Australia",
      startFormattedAddress: "Coburg North VIC 3058, Australia",
      endFormattedAddress: "Brunswick VIC 3056, Australia",
      startPlaceId: "start-place",
      endPlaceId: "end-place",
      startLatitude: "-37.728000",
      startLongitude: "144.961000",
      endLatitude: "-37.765000",
      endLongitude: "144.961000",
      startOdometer: 5010,
      endOdometer: 5015,
      businessKm: 5,
      personalKm: 0,
      purpose: "Client meeting",
      notes: null,
      computedDistanceKm: 5,
      Tour: { id: "Tour-1", title: "Coburg Testing" },
      vehicle: { id: "vehicle-1", name: "Business Van" },
    });
  });

  it("uses the full dashboard width and a wide form grid", async () => {
    const element = await EditDrivingLogPage({ params: Promise.resolve({ logId: "log-1" }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Edit driving log");
    expect(html).toContain("w-full space-y-6");
    expect(html).toContain("xl:grid-cols-3");
    expect(html).toContain("xl:col-span-3");
    expect(html).not.toContain("max-w-3xl space-y-6");
  });
});

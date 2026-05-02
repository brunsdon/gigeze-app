import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMobileBearerAuthContext,
  mockUpdateJourney,
  mockDeleteJourney,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetMobileBearerAuthContext: vi.fn(),
  mockUpdateJourney: vi.fn(),
  mockDeleteJourney: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/app/api/mobile/auth", () => ({
  getMobileBearerAuthContext: mockGetMobileBearerAuthContext,
}));

vi.mock("@/features/tours/service", () => ({
  updateJourney: mockUpdateJourney,
  deleteJourney: mockDeleteJourney,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { DELETE, PUT } from "@/app/api/mobile/tours/[tourId]/route";

describe("mobile Tour mutation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMobileBearerAuthContext.mockResolvedValue({ user: { id: "user-1" }, workspace: { id: "workspace-1" } });
  });

  it("updates a Tour for the authenticated workspace", async () => {
    mockUpdateJourney.mockResolvedValue({
      id: "Tour-1",
      title: "NSW Coast Run",
      description: "Updated route",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-12T00:00:00.000Z"),
      status: "ACTIVE",
      visibility: "PRIVATE",
      coverImageUrl: null,
    });

    const response = await PUT(
      new Request("http://localhost/api/mobile/tours/Tour-1", {
        method: "PUT",
        headers: { Authorization: "Bearer access-token", "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "NSW Coast Run",
          description: "Updated route",
          startDate: "2026-04-01",
          endDate: "2026-04-12",
          status: "ACTIVE",
          visibility: "PRIVATE",
        }),
      }),
      { params: Promise.resolve({ tourId: "Tour-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      Tour: {
        id: "Tour-1",
        title: "NSW Coast Run",
        description: "Updated route",
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-04-12T00:00:00.000Z",
        status: "ACTIVE",
        visibility: "PRIVATE",
        coverImageUrl: null,
      },
    });
    expect(mockUpdateJourney).toHaveBeenCalledWith("Tour-1", expect.objectContaining({ title: "NSW Coast Run" }), {
      workspaceId: "workspace-1",
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/tours");
  });

  it("deletes a Tour using the web dependency-blocking behavior", async () => {
    mockDeleteJourney.mockResolvedValue({ id: "Tour-1" });

    const response = await DELETE(
      new Request("http://localhost/api/mobile/tours/Tour-1", {
        method: "DELETE",
        headers: { Authorization: "Bearer access-token" },
      }),
      { params: Promise.resolve({ tourId: "Tour-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ journeyId: "Tour-1", deleted: true });
    expect(mockDeleteJourney).toHaveBeenCalledWith("Tour-1", "workspace-1");
  });

  it("rejects unauthenticated updates", async () => {
    mockGetMobileBearerAuthContext.mockResolvedValue(null);

    const response = await PUT(
      new Request("http://localhost/api/mobile/tours/Tour-1", { method: "PUT", body: "{}" }),
      { params: Promise.resolve({ tourId: "Tour-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockUpdateJourney).not.toHaveBeenCalled();
  });
});

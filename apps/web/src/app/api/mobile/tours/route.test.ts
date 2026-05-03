import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetMobileBearerAuthContext,
  mockListJourneys,
  mockCreateJourney,
  mockRevalidatePath,
} = vi.hoisted(() => ({
  mockGetMobileBearerAuthContext: vi.fn(),
  mockListJourneys: vi.fn(),
  mockCreateJourney: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

vi.mock("@/app/api/mobile/auth", () => ({
  getMobileBearerAuthContext: mockGetMobileBearerAuthContext,
}));

vi.mock("@/features/tours/service", () => ({
  listJourneys: mockListJourneys,
  createJourney: mockCreateJourney,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

import { GET, POST } from "@/app/api/mobile/tours/route";

describe("mobile Tours route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMobileBearerAuthContext.mockResolvedValue({ user: { id: "user-1" }, workspace: { id: "workspace-1" } });
  });

  it("returns compact Tour options for mobile trip setup", async () => {
    mockListJourneys.mockResolvedValue([
      {
        id: "Tour-1",
        title: "NSW Coast Run",
        description: "Autumn coast run",
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: null,
        status: "ACTIVE",
        visibility: "PRIVATE",
        coverImageUrl: null,
      },
      {
        id: "Tour-2",
        title: "Tasmania Loop",
        description: null,
        startDate: new Date("2026-03-01T00:00:00.000Z"),
        endDate: new Date("2026-03-20T00:00:00.000Z"),
        status: "PLANNED",
        visibility: "SHARED",
        coverImageUrl: "https://example.test/tasmania.jpg",
      },
    ]);

    const response = await GET(new Request("http://localhost/api/mobile/Tours", {
      headers: { Authorization: "Bearer access-token" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      Tours: [
        {
          id: "Tour-1",
          title: "NSW Coast Run",
          description: "Autumn coast run",
          startDate: "2026-04-01T00:00:00.000Z",
          endDate: null,
          status: "ACTIVE",
          visibility: "PRIVATE",
          coverImageUrl: null,
        },
        {
          id: "Tour-2",
          title: "Tasmania Loop",
          description: null,
          startDate: "2026-03-01T00:00:00.000Z",
          endDate: "2026-03-20T00:00:00.000Z",
          status: "PLANNED",
          visibility: "SHARED",
          coverImageUrl: "https://example.test/tasmania.jpg",
        },
      ],
    });
    expect(mockListJourneys).toHaveBeenCalledWith("workspace-1");
  });

  it("rejects unauthenticated requests", async () => {
    mockGetMobileBearerAuthContext.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/mobile/Tours"));

    expect(response.status).toBe(401);
  });

  it("creates a Tour using the web Tour validation contract", async () => {
    mockCreateJourney.mockResolvedValue({
      id: "Tour-3",
      title: "Winter Loop",
      description: "Snowy roads",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: null,
      status: "PLANNED",
      visibility: "PRIVATE",
      coverImageUrl: null,
    });

    const response = await POST(new Request("http://localhost/api/mobile/Tours", {
      method: "POST",
      headers: { Authorization: "Bearer access-token", "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Winter Loop",
        description: "Snowy roads",
        startDate: "2026-06-01",
        status: "PLANNED",
        visibility: "PRIVATE",
      }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      Tour: {
        id: "Tour-3",
        title: "Winter Loop",
        description: "Snowy roads",
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: null,
        status: "PLANNED",
        visibility: "PRIVATE",
        coverImageUrl: null,
      },
    });
    expect(mockCreateJourney).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Winter Loop", description: "Snowy roads", status: "PLANNED" }),
      { workspaceId: "workspace-1", userId: "user-1" },
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/tours");
  });

  it("rejects invalid Tour create input", async () => {
    const response = await POST(new Request("http://localhost/api/mobile/Tours", {
      method: "POST",
      body: JSON.stringify({ title: "", startDate: "not-a-date" }),
    }));

    expect(response.status).toBe(400);
    expect(mockCreateJourney).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockRequireAuthenticatedUser,
  mockRequireWorkspaceOwner,
  mockCreateStop,
  mockCreateDrivingLog,
  mockCreateActivityNote,
  mockCreateMediaMetadata,
} = vi.hoisted(() => ({
  mockRequireAuthenticatedUser: vi.fn(),
  mockRequireWorkspaceOwner: vi.fn(),
  mockCreateStop: vi.fn(),
  mockCreateDrivingLog: vi.fn(),
  mockCreateActivityNote: vi.fn(),
  mockCreateMediaMetadata: vi.fn(),
}))

vi.mock("@/lib/auth/workspace", () => ({
  requireAuthenticatedUser: mockRequireAuthenticatedUser,
  requireWorkspaceOwner: mockRequireWorkspaceOwner,
}))

vi.mock("@/features/gigs/service", () => ({
  createStop: mockCreateStop,
}))

vi.mock("@/features/driving-logs/service", () => ({
  createDrivingLog: mockCreateDrivingLog,
}))

vi.mock("@/features/activity-notes/service", () => ({
  createActivityNote: mockCreateActivityNote,
}))

vi.mock("@/features/media/service", () => ({
  createMediaMetadata: mockCreateMediaMetadata,
}))

import { POST } from "@/app/api/quick-entry/sync/route"

function buildStopItem(id: string, title = "Queued Gig") {
  return {
    id,
    type: "create-Gig",
    queuedAt: new Date().toISOString(),
    attempts: 0,
    payload: {
      journeyId: "Tour-1",
      title,
      description: undefined,
      latitude: -33.8688,
      longitude: 151.2093,
      locationName: "Sydney",
      arrivalDate: undefined,
      departureDate: undefined,
      visibility: "PRIVATE",
      orderIndex: 1,
    },
  }
}

function buildDrivingItem(id: string) {
  return {
    id,
    type: "create-driving-log",
    queuedAt: new Date().toISOString(),
    attempts: 0,
    payload: {
      journeyId: undefined,
      date: new Date("2026-04-06T00:00:00.000Z").toISOString(),
      startLocation: undefined,
      endLocation: undefined,
      startOdometer: 100,
      endOdometer: 180,
      businessKm: 40,
      personalKm: 40,
      notes: undefined,
    },
  }
}

describe("quick entry sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuthenticatedUser.mockResolvedValue({ id: "user-1" })
    mockRequireWorkspaceOwner.mockResolvedValue({ id: "workspace-1" })
  })

  it("returns 400 for invalid payload", async () => {
    const response = await POST(new Request("http://localhost/api/quick-entry/sync", {
      method: "POST",
      body: JSON.stringify({ items: [{ id: "bad" }] }),
      headers: { "Content-Type": "application/json" },
    }))

    expect(response.status).toBe(400)
  })

  it("syncs valid items and returns success ids", async () => {
    const itemA = buildStopItem("queue-1")
    const itemB = buildDrivingItem("queue-2")

    const response = await POST(new Request("http://localhost/api/quick-entry/sync", {
      method: "POST",
      body: JSON.stringify({ items: [itemA, itemB] }),
      headers: { "Content-Type": "application/json" },
    }))

    const body = await response.json() as { successIds: string[]; failed: Array<{ id: string; error: string }> }

    expect(response.status).toBe(200)
    expect(body.successIds).toEqual(["queue-1", "queue-2"])
    expect(body.failed).toEqual([])
    expect(mockCreateStop).toHaveBeenCalledWith(itemA.payload, { workspaceId: "workspace-1", userId: "user-1" })
    expect(mockCreateDrivingLog).toHaveBeenCalledWith(
      expect.objectContaining({
        startOdometer: 100,
        endOdometer: 180,
        businessKm: 40,
        personalKm: 40,
        date: expect.any(Date),
      }),
      { workspaceId: "workspace-1", userId: "user-1" },
    )
  })

  it("keeps failed items and still processes later items", async () => {
    const first = buildStopItem("queue-3", "Will fail")
    const second = buildStopItem("queue-4", "Will pass")

    mockCreateStop.mockRejectedValueOnce(new Error("sync-failed"))
    mockCreateStop.mockResolvedValueOnce({ id: "Gig-2" })

    const response = await POST(new Request("http://localhost/api/quick-entry/sync", {
      method: "POST",
      body: JSON.stringify({ items: [first, second] }),
      headers: { "Content-Type": "application/json" },
    }))

    const body = await response.json() as { successIds: string[]; failed: Array<{ id: string; error: string }> }

    expect(body.successIds).toEqual(["queue-4"])
    expect(body.failed).toEqual([{ id: "queue-3", error: "sync-failed" }])
  })

  it("de-duplicates replayed queue ids", async () => {
    const item = buildStopItem("queue-5")

    const firstResponse = await POST(new Request("http://localhost/api/quick-entry/sync", {
      method: "POST",
      body: JSON.stringify({ items: [item] }),
      headers: { "Content-Type": "application/json" },
    }))

    const secondResponse = await POST(new Request("http://localhost/api/quick-entry/sync", {
      method: "POST",
      body: JSON.stringify({ items: [item] }),
      headers: { "Content-Type": "application/json" },
    }))

    const firstBody = await firstResponse.json() as { successIds: string[] }
    const secondBody = await secondResponse.json() as { successIds: string[] }

    expect(firstBody.successIds).toEqual(["queue-5"])
    expect(secondBody.successIds).toEqual(["queue-5"])
    expect(mockCreateStop).toHaveBeenCalledTimes(1)
  })
})

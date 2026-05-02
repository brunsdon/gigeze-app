import { beforeEach, describe, expect, it } from "vitest"
import { createQueuedAction } from "@/features/quick-entry/offline-contract"
import {
  addCompletedQuickEntryIds,
  enqueueQuickEntryAction,
  getCompletedQuickEntryIds,
  getQueuedQuickEntryActions,
  markQueuedQuickEntryFailures,
  removeQueuedQuickEntryActions,
} from "@/features/quick-entry/offline-queue"

function createStopPayload() {
  return {
    journeyId: "Tour-1",
    title: "Quick Gig",
    description: "notes",
    latitude: -33.8688,
    longitude: 151.2093,
    locationName: "Sydney",
    arrivalDate: undefined,
    departureDate: undefined,
    visibility: "PRIVATE" as const,
    orderIndex: 1,
  }
}

describe("offline queue", () => {
  beforeEach(() => {
    const store = new Map<string, string>()

    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    }

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage },
    })

    localStorage.clear()
  })

  it("stores, reads, and removes queued actions", () => {
    const first = createQueuedAction("create-Gig", createStopPayload())
    const second = createQueuedAction("create-Gig", {
      ...createStopPayload(),
      title: "Second Gig",
    })

    enqueueQuickEntryAction(first)
    enqueueQuickEntryAction(second)

    const queued = getQueuedQuickEntryActions()
    expect(queued).toHaveLength(2)
    expect(queued[0].id).toBe(first.id)
    expect(queued[1].id).toBe(second.id)

    removeQueuedQuickEntryActions([first.id])

    const afterRemove = getQueuedQuickEntryActions()
    expect(afterRemove).toHaveLength(1)
    expect(afterRemove[0].id).toBe(second.id)
  })

  it("records failure attempts without removing items", () => {
    const first = createQueuedAction("create-Gig", createStopPayload())
    const second = createQueuedAction("create-Gig", {
      ...createStopPayload(),
      title: "Second Gig",
    })

    enqueueQuickEntryAction(first)
    enqueueQuickEntryAction(second)

    markQueuedQuickEntryFailures([{ id: second.id, error: "temporary-error" }])

    const queued = getQueuedQuickEntryActions()
    const unchanged = queued.find((item) => item.id === first.id)
    const failed = queued.find((item) => item.id === second.id)

    expect(unchanged?.attempts).toBe(0)
    expect(failed?.attempts).toBe(1)
  })

  it("deduplicates completed ids", () => {
    addCompletedQuickEntryIds(["a", "b", "a"])
    expect(getCompletedQuickEntryIds()).toEqual(["a", "b"])
  })
})

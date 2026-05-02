import { queuedQuickEntryActionsSchema, type QueuedQuickEntryAction } from "@/features/quick-entry/offline-contract"
import { getAppPersistenceProvider } from "@/features/mobile/persistence"

const OFFLINE_QUEUE_KEY = "gigeze.quickEntryQueue"
const OFFLINE_COMPLETED_KEY = "gigeze.quickEntryCompleted"
const COMPLETED_SET_LIMIT = 500

function readJson<T>(key: string, fallback: T): T {
  const persistence = getAppPersistenceProvider()
  if (!persistence.isStorageAvailable()) {
    return fallback
  }

  const raw = persistence.getItem(key)
  if (!raw) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  const persistence = getAppPersistenceProvider()
  if (!persistence.isStorageAvailable()) {
    return
  }

  persistence.setItem(key, JSON.stringify(value))
}

export function getQueuedQuickEntryActions(): QueuedQuickEntryAction[] {
  const parsed = queuedQuickEntryActionsSchema.safeParse(readJson<unknown[]>(OFFLINE_QUEUE_KEY, []))
  return parsed.success ? parsed.data : []
}

export function setQueuedQuickEntryActions(items: QueuedQuickEntryAction[]) {
  writeJson(OFFLINE_QUEUE_KEY, items)
}

export function enqueueQuickEntryAction(item: QueuedQuickEntryAction) {
  const items = getQueuedQuickEntryActions()
  items.push(item)
  setQueuedQuickEntryActions(items)
}

export function removeQueuedQuickEntryActions(ids: string[]) {
  if (!ids.length) {
    return
  }

  const idSet = new Set(ids)
  const next = getQueuedQuickEntryActions().filter((item) => !idSet.has(item.id))
  setQueuedQuickEntryActions(next)
}

export function markQueuedQuickEntryFailures(failures: Array<{ id: string; error: string }>) {
  if (!failures.length) {
    return
  }

  const failureMap = new Map(failures.map((failure) => [failure.id, failure.error]))
  const next = getQueuedQuickEntryActions().map((item) => {
    const error = failureMap.get(item.id)
    if (!error) {
      return item
    }

    return {
      ...item,
      attempts: item.attempts + 1,
      lastError: error,
    }
  })

  setQueuedQuickEntryActions(next)
}

export function getCompletedQuickEntryIds(): string[] {
  const value = readJson<unknown[]>(OFFLINE_COMPLETED_KEY, [])
  return value.filter((entry): entry is string => typeof entry === "string")
}

export function addCompletedQuickEntryIds(ids: string[]) {
  if (!ids.length) {
    return
  }

  const merged = [...getCompletedQuickEntryIds(), ...ids]
  const unique = Array.from(new Set(merged))
  const trimmed = unique.slice(Math.max(0, unique.length - COMPLETED_SET_LIMIT))
  writeJson(OFFLINE_COMPLETED_KEY, trimmed)
}

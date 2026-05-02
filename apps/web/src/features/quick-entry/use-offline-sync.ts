"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { getErrorMessage } from "@/lib/utils/feedback-messages"
import { useNetworkStatus } from "@/lib/hooks/use-network-status"
import { updateMobileDiagnostics } from "@/features/mobile/diagnostics"
import { getAppPersistenceProvider } from "@/features/mobile/persistence"
import { getSyncTriggerProvider, type SyncTriggerSource } from "@/features/mobile/sync-trigger"
import {
  addCompletedQuickEntryIds,
  getCompletedQuickEntryIds,
  getQueuedQuickEntryActions,
  markQueuedQuickEntryFailures,
  removeQueuedQuickEntryActions,
} from "@/features/quick-entry/offline-queue"

const OFFLINE_LAST_SYNC_KEY = "gigeze.quickEntryLastSync"

export function useOfflineSync() {
  const persistenceProvider = useMemo(() => getAppPersistenceProvider(), [])
  const syncTriggerProvider = useMemo(() => getSyncTriggerProvider(), [])
  const { isOnline } = useNetworkStatus()
  const [queueCount, setQueueCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncError, setLastSyncError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [lastSyncTriggerSource, setLastSyncTriggerSource] = useState<SyncTriggerSource | null>(null)

  const refreshQueueCount = useCallback(() => {
    setQueueCount(getQueuedQuickEntryActions().length)
  }, [])

  const syncNow = useCallback(async (source: SyncTriggerSource = "manual") => {
    setLastSyncTriggerSource(source)
    updateMobileDiagnostics({ lastSyncTriggerSource: source })

    if (!isOnline) {
      refreshQueueCount()
      return
    }

    const completedIds = new Set(getCompletedQuickEntryIds())
    const queuedItems = getQueuedQuickEntryActions()

    const staleCompletedIds = queuedItems.filter((item) => completedIds.has(item.id)).map((item) => item.id)
    if (staleCompletedIds.length) {
      removeQueuedQuickEntryActions(staleCompletedIds)
    }

    const items = getQueuedQuickEntryActions()

    if (!items.length) {
      refreshQueueCount()
      return
    }

    setIsSyncing(true)
    setLastSyncError(null)

    try {
      toast.message("Syncing queued entries...")

      const response = await fetch("/api/quick-entry/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items }),
      })

      if (!response.ok) {
        throw new Error("sync-request-failed")
      }

      const body = (await response.json()) as {
        successIds?: string[]
        failed?: Array<{ id: string; error: string }>
      }

      const successIds = body.successIds ?? []
      const failed = body.failed ?? []

      if (successIds.length) {
        removeQueuedQuickEntryActions(successIds)
        addCompletedQuickEntryIds(successIds)
      }

      if (failed.length) {
        markQueuedQuickEntryFailures(failed)
        setLastSyncError(failed[0].error)
        toast.error(`Sync finished with ${failed.length} pending item(s).`)
      } else {
        const now = new Date()
        setLastSyncTime(now)
        if (persistenceProvider.isStorageAvailable()) {
          persistenceProvider.setItem(OFFLINE_LAST_SYNC_KEY, now.toISOString())
          persistenceProvider.emit("gigeze-sync-updated")
        }
        toast.success("Sync complete")
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : "sync-request-failed"
      setLastSyncError(code)
      toast.error(getErrorMessage(code))
    } finally {
      setIsSyncing(false)
      refreshQueueCount()
    }
  }, [isOnline, persistenceProvider, refreshQueueCount])

  useEffect(() => {
    refreshQueueCount()
  }, [refreshQueueCount])

  useEffect(() => {
    if (!syncTriggerProvider.getIsOnline()) {
      return
    }

    void syncNow("initial-online")
  }, [syncNow, syncTriggerProvider])

  useEffect(() => syncTriggerProvider.subscribe((event) => {
    void syncNow(event.source)
  }), [syncNow, syncTriggerProvider])

  const statusLabel = useMemo(() => {
    if (!isOnline) {
      return queueCount ? `Offline · ${queueCount} queued` : "Offline"
    }

    if (isSyncing) {
      return "Syncing..."
    }

    if (lastSyncError) {
      return "Sync pending"
    }

    return queueCount ? `${queueCount} queued` : "Online"
  }, [isOnline, isSyncing, lastSyncError, queueCount])

  return {
    isOnline,
    isSyncing,
    queueCount,
    lastSyncError,
    lastSyncTime,
    lastSyncTriggerSource,
    statusLabel,
    refreshQueueCount,
    syncNow,
  }
}

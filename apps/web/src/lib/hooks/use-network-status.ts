"use client"

import { useSyncExternalStore } from "react"
import { getAppLifecycleProvider } from "@/features/mobile/lifecycle-provider"

export function useNetworkStatus() {
  const lifecycleProvider = getAppLifecycleProvider()

  const isOnline = useSyncExternalStore(
    (onStoreChange) => lifecycleProvider.subscribe(() => onStoreChange()),
    () => lifecycleProvider.getSnapshot().isOnline,
    () => lifecycleProvider.getSnapshot().isOnline,
  )

  return { isOnline }
}

"use client";

import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";
import {
  refreshMobileDiagnosticsSnapshot,
  subscribeMobileDiagnostics,
  updateMobileDiagnostics,
  type MobileDiagnosticsSnapshot,
} from "@/features/mobile/diagnostics";
import { getAppLifecycleProvider } from "@/features/mobile/lifecycle-provider";
import { getAppPersistenceProvider } from "@/features/mobile/persistence";
import { detectMobileRuntime } from "@/features/mobile/runtime";
import { getSyncTriggerProvider } from "@/features/mobile/sync-trigger";
import { getTripTrackingProvider } from "@/features/mobile/tracking-provider";
import { useAppVersion } from "@/features/mobile/use-app-version";
import { getQueuedQuickEntryActions } from "@/features/quick-entry/offline-queue";

type DebugPanelProps = {
  enabled?: boolean;
};

const OFFLINE_LAST_SYNC_KEY = "gigeze.quickEntryLastSync";

function formatLastSync(value: Date | null) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
  }).format(value);
}

export function DebugPanel({ enabled = false }: DebugPanelProps) {
  const { isOnline } = useNetworkStatus();
  const appVersion = useAppVersion();
  const [queueCount, setQueueCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [diagnostics, setDiagnostics] = useState<MobileDiagnosticsSnapshot | null>(null);
  const [isNativeShell, setIsNativeShell] = useState(false);

  useEffect(() => {
    const unsubscribeDiagnostics = subscribeMobileDiagnostics(setDiagnostics);

    function refreshLiveDiagnostics() {
      setDiagnostics(refreshMobileDiagnosticsSnapshot());
      setIsNativeShell(detectMobileRuntime().isNativeShell);
    }

    refreshLiveDiagnostics();

    const lifecycle = getAppLifecycleProvider();
    const persistence = getAppPersistenceProvider();
    const tracking = getTripTrackingProvider();
    getSyncTriggerProvider();

    refreshLiveDiagnostics();
    const delayedDiagnosticsRefresh = window.setTimeout(refreshLiveDiagnostics, 150);

    function refresh() {
      setQueueCount(getQueuedQuickEntryActions().length);
      const raw = persistence.getItem(OFFLINE_LAST_SYNC_KEY);
      setLastSyncTime(raw ? new Date(raw) : null);
    }

    const interval = window.setInterval(refresh, 1500);
    const unsubscribeStorage = persistence.subscribeStorageChanges(() => refresh());
    const unsubscribeLifecycle = lifecycle.subscribe(refreshLiveDiagnostics);
    let isMounted = true;
    void tracking.getAvailability().then((trackingAvailability) => {
      if (!isMounted) {
        return;
      }

      updateMobileDiagnostics({
        trackingAvailability,
      });
    });
    void tracking.getPermissionState().then((trackingPermissionState) => {
      if (!isMounted) {
        return;
      }

      updateMobileDiagnostics({
        trackingPermissionState,
      });
    });
    refresh();

    return () => {
      isMounted = false;
      window.clearTimeout(delayedDiagnosticsRefresh);
      window.clearInterval(interval);
      unsubscribeStorage();
      unsubscribeLifecycle();
      unsubscribeDiagnostics();
    };
  }, []);

  const shouldShowDebugPanel = enabled || isNativeShell;

  if (!shouldShowDebugPanel) {
    return null;
  }

  return (
    <aside className="fixed right-3 bottom-3 z-[100] max-w-[calc(100vw-1.5rem)] rounded-xl border border-border/80 bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur">
      <p className="font-semibold text-foreground">Debug panel</p>
      <p className="text-muted-foreground">Network: {isOnline ? "Online" : "Offline"}</p>
      <p className="text-muted-foreground">App version: {appVersion.versionName} ({appVersion.versionCode})</p>
      <p className="text-muted-foreground">Offline queue: {queueCount}</p>
      <p className="text-muted-foreground">Last sync: {formatLastSync(lastSyncTime)}</p>
      <p className="text-muted-foreground">Runtime: {diagnostics?.runtimeMode ?? "hydrating"}</p>
      <p className="text-muted-foreground">Providers: {diagnostics?.trackingProviderKind ?? "?"} / {diagnostics?.persistenceProviderKind ?? "?"} / {diagnostics?.lifecycleProviderKind ?? "?"}</p>
      <p className="text-muted-foreground">Sync trigger: {diagnostics?.lastSyncTriggerSource ?? "n/a"}</p>
      <p className="text-muted-foreground">Tracking: {diagnostics?.trackingAvailability?.status ?? "unknown"}</p>
      <p className="text-muted-foreground">Background: {diagnostics?.trackingBackgroundReadiness?.status ?? "unknown"}</p>
      <p className="text-muted-foreground">Tracking permission: {diagnostics?.trackingPermissionState ?? "unknown"}</p>
      <p className="text-muted-foreground">Tracking path: {diagnostics?.trackingSamplingPath ?? "unknown"}</p>
    </aside>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";

const LAST_SAVED_AT_KEY = "gigeze.lastSavedAt";
const LAST_SYNC_AT_KEY = "gigeze.quickEntryLastSync";

function readDateFromStorage(key: string) {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRelative(value: Date) {
  const deltaMs = Date.now() - value.getTime();
  const minutes = Math.floor(deltaMs / (1000 * 60));

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function readTrustIndicatorDates() {
  return {
    lastSavedAt: readDateFromStorage(LAST_SAVED_AT_KEY),
    lastSyncAt: readDateFromStorage(LAST_SYNC_AT_KEY),
  };
}

export function TrustIndicators() {
  const { isOnline } = useNetworkStatus();
  const [{ lastSavedAt, lastSyncAt }, setIndicatorDates] = useState(readTrustIndicatorDates);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndicatorDates(readTrustIndicatorDates());
    }, 60_000);

    function onStorage() {
      setIndicatorDates(readTrustIndicatorDates());
    }

    function onUpdated() {
      setIndicatorDates(readTrustIndicatorDates());
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("gigeze-save-updated", onUpdated);
    window.addEventListener("gigeze-sync-updated", onUpdated);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("gigeze-save-updated", onUpdated);
      window.removeEventListener("gigeze-sync-updated", onUpdated);
    };
  }, []);

  const syncLabel = useMemo(() => {
    if (!lastSyncAt) {
      return "No sync yet";
    }

    return `Synced ${formatRelative(lastSyncAt)}`;
  }, [lastSyncAt]);

  const saveLabel = useMemo(() => {
    if (!lastSavedAt) {
      return "No save yet";
    }

    return `Saved ${formatRelative(lastSavedAt)}`;
  }, [lastSavedAt]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
      <Badge variant={isOnline ? "outline" : "destructive"}>{isOnline ? "Online" : "Offline"}</Badge>
      <Badge variant="secondary">{saveLabel}</Badge>
      <Badge variant="secondary">{syncLabel}</Badge>
    </div>
  );
}

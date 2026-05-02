"use client";

import { useSyncExternalStore } from "react";
import { getAppLifecycleProvider } from "@/features/mobile/lifecycle-provider";

export function useLifecycle() {
  const provider = getAppLifecycleProvider();

  return useSyncExternalStore(
    (onStoreChange) => provider.subscribe(() => onStoreChange()),
    () => provider.getSnapshot(),
    () => provider.getSnapshot(),
  );
}

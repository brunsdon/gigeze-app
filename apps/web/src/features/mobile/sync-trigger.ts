import {
  getAppLifecycleProvider,
  type AppLifecycleEvent,
  type AppLifecycleProvider,
} from "@/features/mobile/lifecycle-provider";
import { updateMobileDiagnostics } from "@/features/mobile/diagnostics";

export type SyncTriggerSource =
  | "manual"
  | "initial-online"
  | "browser-resumed"
  | "browser-connectivity-restored"
  | "native-resumed"
  | "native-connectivity-restored";

export type SyncTriggerProviderKind = "lifecycle-adapter";

export type SyncTriggerEvent = {
  source: SyncTriggerSource;
  at: string;
  isOnline: boolean;
};

export type SyncTriggerProvider = {
  kind: SyncTriggerProviderKind;
  getIsOnline: () => boolean;
  subscribe: (listener: (event: SyncTriggerEvent) => void) => () => void;
};

function mapLifecycleEventToSyncSource(event: AppLifecycleEvent, provider: AppLifecycleProvider): SyncTriggerSource | null {
  if (!event.snapshot.isOnline) {
    return null;
  }

  if (event.type === "resumed") {
    return provider.kind === "browser" ? "browser-resumed" : "native-resumed";
  }

  if (event.type === "connectivity-restored") {
    return provider.kind === "browser" ? "browser-connectivity-restored" : "native-connectivity-restored";
  }

  return null;
}

function createLifecycleSyncTriggerProvider(lifecycleProvider: AppLifecycleProvider): SyncTriggerProvider {
  return {
    kind: "lifecycle-adapter",
    getIsOnline: () => lifecycleProvider.getSnapshot().isOnline,
    subscribe: (listener) =>
      lifecycleProvider.subscribe((event) => {
        const source = mapLifecycleEventToSyncSource(event, lifecycleProvider);
        if (!source) {
          return;
        }

        updateMobileDiagnostics({ lastSyncTriggerSource: source });
        listener({
          source,
          at: event.at,
          isOnline: event.snapshot.isOnline,
        });
      }),
  };
}

let syncTriggerProviderOverride: SyncTriggerProvider | null = null;
let syncTriggerProviderSingleton: SyncTriggerProvider | null = null;

export function getSyncTriggerProvider(): SyncTriggerProvider {
  if (syncTriggerProviderOverride) {
    return syncTriggerProviderOverride;
  }

  if (!syncTriggerProviderSingleton) {
    syncTriggerProviderSingleton = createLifecycleSyncTriggerProvider(getAppLifecycleProvider());
    updateMobileDiagnostics({
      syncTriggerProviderKind: syncTriggerProviderSingleton.kind,
    });
  }

  return syncTriggerProviderSingleton;
}

export function setSyncTriggerProviderForTests(provider: SyncTriggerProvider | null) {
  syncTriggerProviderOverride = provider;
}

export function resetSyncTriggerProviderForTests() {
  syncTriggerProviderOverride = null;
  syncTriggerProviderSingleton = null;
}

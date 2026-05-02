import { detectMobileRuntimeCapabilities } from "@/features/mobile/capabilities";
import { updateMobileDiagnostics } from "@/features/mobile/diagnostics";

type AppEventListener = () => void;

type AppStorageChangeListener = (event: { key: string | null }) => void;

export type AppPersistenceProviderKind = "browser-local-storage" | "in-memory";

export type AppPersistenceProvider = {
  kind: AppPersistenceProviderKind;
  isStorageAvailable: () => boolean;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  emit: (eventName: string) => void;
  subscribe: (eventName: string, listener: AppEventListener) => () => void;
  subscribeStorageChanges: (listener: AppStorageChangeListener) => () => void;
};

function createBrowserLocalStorageProvider(): AppPersistenceProvider {
  const isStorageAvailable = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

  return {
    kind: "browser-local-storage",
    isStorageAvailable,
    getItem: (key) => {
      if (!isStorageAvailable()) {
        return null;
      }

      return window.localStorage.getItem(key);
    },
    setItem: (key, value) => {
      if (!isStorageAvailable()) {
        return;
      }

      window.localStorage.setItem(key, value);
    },
    removeItem: (key) => {
      if (!isStorageAvailable()) {
        return;
      }

      window.localStorage.removeItem(key);
    },
    emit: (eventName) => {
      if (typeof window === "undefined") {
        return;
      }

      window.dispatchEvent(new Event(eventName));
    },
    subscribe: (eventName, listener) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }

      window.addEventListener(eventName, listener);
      return () => {
        window.removeEventListener(eventName, listener);
      };
    },
    subscribeStorageChanges: (listener) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }

      const onStorage = (event: StorageEvent) => {
        listener({ key: event.key });
      };

      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener("storage", onStorage);
      };
    },
  };
}

function createMemoryProvider(): AppPersistenceProvider {
  const store = new Map<string, string>();

  return {
    kind: "in-memory",
    isStorageAvailable: () => true,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    emit: () => undefined,
    subscribe: () => () => undefined,
    subscribeStorageChanges: () => () => undefined,
  };
}

let appPersistenceProviderOverride: AppPersistenceProvider | null = null;
let appPersistenceProviderSingleton: AppPersistenceProvider | null = null;

function createDefaultPersistenceProvider(): AppPersistenceProvider {
  const capabilities = detectMobileRuntimeCapabilities();
  if (capabilities.persistentStorageAvailable) {
    return createBrowserLocalStorageProvider();
  }

  return createMemoryProvider();
}

export function getAppPersistenceProvider(): AppPersistenceProvider {
  if (appPersistenceProviderOverride) {
    return appPersistenceProviderOverride;
  }

  if (!appPersistenceProviderSingleton) {
    appPersistenceProviderSingleton = createDefaultPersistenceProvider();
    updateMobileDiagnostics({
      persistenceProviderKind: appPersistenceProviderSingleton.kind,
      runtimeMode: detectMobileRuntimeCapabilities().runtime.mode,
      capabilities: detectMobileRuntimeCapabilities(),
    });
  }

  return appPersistenceProviderSingleton;
}

export function setAppPersistenceProviderForTests(provider: AppPersistenceProvider | null) {
  appPersistenceProviderOverride = provider;
}

export function resetAppPersistenceProviderForTests() {
  appPersistenceProviderOverride = null;
  appPersistenceProviderSingleton = null;
}

import { mobileStorage } from "../../../lib/storage/mobile-storage";

const diagnosticsKey = "gigeze.mobile.tracking.background-task-diagnostics";

export type BackgroundTaskDiagnosticsSnapshot = {
  callbackCount: number;
  lastCallbackAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
};

function emptySnapshot(): BackgroundTaskDiagnosticsSnapshot {
  return {
    callbackCount: 0,
    lastCallbackAt: null,
    lastError: null,
    lastErrorAt: null,
  };
}

function readSnapshot(raw: string | null): BackgroundTaskDiagnosticsSnapshot {
  if (!raw) {
    return emptySnapshot();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BackgroundTaskDiagnosticsSnapshot>;
    return {
      callbackCount: typeof parsed.callbackCount === "number" ? parsed.callbackCount : 0,
      lastCallbackAt: typeof parsed.lastCallbackAt === "string" ? parsed.lastCallbackAt : null,
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : null,
      lastErrorAt: typeof parsed.lastErrorAt === "string" ? parsed.lastErrorAt : null,
    };
  } catch {
    return emptySnapshot();
  }
}

async function writeSnapshot(snapshot: BackgroundTaskDiagnosticsSnapshot) {
  await mobileStorage.setItem(diagnosticsKey, JSON.stringify(snapshot));
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return typeof error === "string" ? error : "Unknown background task error.";
}

export const backgroundTaskDiagnosticsStore = {
  async getSnapshot() {
    return readSnapshot(await mobileStorage.getItem(diagnosticsKey));
  },
  async recordCallback(nowIso = new Date().toISOString()) {
    const snapshot = await this.getSnapshot();
    const nextSnapshot: BackgroundTaskDiagnosticsSnapshot = {
      callbackCount: snapshot.callbackCount + 1,
      lastCallbackAt: nowIso,
      lastError: snapshot.lastError,
      lastErrorAt: snapshot.lastErrorAt,
    };
    await writeSnapshot(nextSnapshot);
    return nextSnapshot;
  },
  async recordError(error: unknown, nowIso = new Date().toISOString()) {
    const snapshot = await this.getSnapshot();
    const nextSnapshot: BackgroundTaskDiagnosticsSnapshot = {
      ...snapshot,
      lastError: getErrorMessage(error),
      lastErrorAt: nowIso,
    };
    await writeSnapshot(nextSnapshot);
    return nextSnapshot;
  },
  async clearError() {
    const snapshot = await this.getSnapshot();
    if (!snapshot.lastError) {
      return snapshot;
    }

    const nextSnapshot: BackgroundTaskDiagnosticsSnapshot = {
      ...snapshot,
      lastError: null,
      lastErrorAt: null,
    };
    await writeSnapshot(nextSnapshot);
    return nextSnapshot;
  },
};

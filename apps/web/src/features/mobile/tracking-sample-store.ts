import { getAppPersistenceProvider } from "@/features/mobile/persistence";
import type { TripTrackingPosition } from "@/features/mobile/tracking-provider";

export type TrackingSampleSource = "react-foreground" | "native-foreground" | "native-background";

export type TrackingSampleRecord = TripTrackingPosition & {
  sessionId: string;
  recordedAt: string;
  source: TrackingSampleSource;
  originId?: string;
  sequence: number;
};

export type TrackingSampleStore = {
  kind: "app-persistence-json";
  appendSample: (sample: Omit<TrackingSampleRecord, "sequence">) => Promise<TrackingSampleRecord>;
  listSamples: (sessionId: string, options?: { afterSequence?: number }) => Promise<TrackingSampleRecord[]>;
  getLastSample: (sessionId: string) => Promise<TrackingSampleRecord | null>;
  clearSession: (sessionId: string) => Promise<void>;
};

function getSampleStoreKey(sessionId: string) {
  return `gigeze.trip-tracking-samples.v1:${sessionId}`;
}

function readSamples(sessionId: string): TrackingSampleRecord[] {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return [];
  }

  const raw = persistence.getItem(getSampleStoreKey(sessionId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as TrackingSampleRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSamples(sessionId: string, samples: TrackingSampleRecord[]) {
  const persistence = getAppPersistenceProvider();
  if (!persistence.isStorageAvailable()) {
    return;
  }

  persistence.setItem(getSampleStoreKey(sessionId), JSON.stringify(samples));
}

export function createTrackingSampleStore(): TrackingSampleStore {
  return {
    kind: "app-persistence-json",
    appendSample: async (sample) => {
      const samples = readSamples(sample.sessionId);
      const existingSample = sample.originId
        ? samples.find((storedSample) => storedSample.source === sample.source && storedSample.originId === sample.originId)
        : null;

      if (existingSample) {
        return existingSample;
      }

      const nextSample: TrackingSampleRecord = {
        ...sample,
        sequence: (samples.at(-1)?.sequence ?? 0) + 1,
      };

      writeSamples(sample.sessionId, [...samples, nextSample]);
      return nextSample;
    },
    listSamples: async (sessionId, options = {}) => {
      const samples = readSamples(sessionId);
      if (options.afterSequence === undefined) {
        return samples;
      }

      return samples.filter((sample) => sample.sequence > options.afterSequence!);
    },
    getLastSample: async (sessionId) => readSamples(sessionId).at(-1) ?? null,
    clearSession: async (sessionId) => {
      const persistence = getAppPersistenceProvider();
      if (!persistence.isStorageAvailable()) {
        return;
      }

      persistence.removeItem(getSampleStoreKey(sessionId));
    },
  };
}

import { mobileStorage } from "../../../lib/storage/mobile-storage";
import type { TrackingSampleRecord } from "./types";

export const maxNativeBufferedTrackingSamples = 1200;

function nativeBufferKey(sessionId: string) {
  return `gigeze.mobile.tracking.native-buffer.${sessionId}`;
}

function readBuffer(raw: string | null): Omit<TrackingSampleRecord, "sequence">[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Omit<TrackingSampleRecord, "sequence">[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function compactNativeBufferSamples(
  samples: Omit<TrackingSampleRecord, "sequence">[],
  limit = maxNativeBufferedTrackingSamples,
) {
  if (samples.length <= limit) {
    return samples;
  }

  if (limit <= 2) {
    return samples.slice(-Math.max(1, limit));
  }

  const lastIndex = samples.length - 1;
  const step = lastIndex / (limit - 1);
  const selectedIndexes = new Set<number>([0, lastIndex]);

  for (let index = 1; index < limit - 1; index += 1) {
    selectedIndexes.add(Math.round(index * step));
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => samples[index])
    .filter((sample): sample is Omit<TrackingSampleRecord, "sequence"> => Boolean(sample));
}

export const trackingNativeBufferStore = {
  async appendSample(sample: Omit<TrackingSampleRecord, "sequence">) {
    const samples = await this.listSamples(sample.sessionId);
    if (samples.some((storedSample) => storedSample.source === sample.source && storedSample.originId === sample.originId)) {
      return;
    }

    await mobileStorage.setItem(nativeBufferKey(sample.sessionId), JSON.stringify(compactNativeBufferSamples([...samples, sample])));
  },
  async listSamples(sessionId: string) {
    return readBuffer(await mobileStorage.getItem(nativeBufferKey(sessionId)));
  },
  async getSampleCount(sessionId: string) {
    return (await this.listSamples(sessionId)).length;
  },
  async clearSession(sessionId: string) {
    await mobileStorage.removeItem(nativeBufferKey(sessionId));
  },
};

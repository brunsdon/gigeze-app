import { mobileStorage } from "../../../lib/storage/mobile-storage";
import type { TrackingSampleRecord } from "./types";

export const maxStoredTrackingSamples = 3600;

function sessionSamplesKey(sessionId: string) {
  return `gigeze.mobile.tracking.samples.${sessionId}`;
}

function readSamples(raw: string | null): TrackingSampleRecord[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TrackingSampleRecord>[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (sample): sample is TrackingSampleRecord =>
        Boolean(sample.sessionId && sample.originId && sample.recordedAt && typeof sample.sequence === "number"),
    );
  } catch {
    return [];
  }
}

async function listSamples(sessionId: string) {
  return readSamples(await mobileStorage.getItem(sessionSamplesKey(sessionId)));
}

async function writeSamples(sessionId: string, samples: TrackingSampleRecord[]) {
  await mobileStorage.setItem(sessionSamplesKey(sessionId), JSON.stringify(compactStoredSamples(samples)));
}

export function compactStoredSamples(samples: TrackingSampleRecord[], limit = maxStoredTrackingSamples) {
  if (samples.length <= limit) {
    return samples;
  }

  if (limit <= 2) {
    return samples.slice(-Math.max(1, limit));
  }

  const sortedSamples = [...samples].sort((left, right) => left.sequence - right.sequence);
  const lastIndex = sortedSamples.length - 1;
  const step = lastIndex / (limit - 1);
  const selectedIndexes = new Set<number>([0, lastIndex]);

  for (let index = 1; index < limit - 1; index += 1) {
    selectedIndexes.add(Math.round(index * step));
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .map((index) => sortedSamples[index])
    .filter((sample): sample is TrackingSampleRecord => Boolean(sample));
}

export const trackingSampleStore = {
  async appendSample(sample: Omit<TrackingSampleRecord, "sequence">) {
    const samples = await listSamples(sample.sessionId);
    const existingSample = samples.find(
      (storedSample) => storedSample.source === sample.source && storedSample.originId === sample.originId,
    );

    if (existingSample) {
      return {
        sample: existingSample,
        imported: false,
      };
    }

    const nextSample: TrackingSampleRecord = {
      ...sample,
      sequence: (samples.at(-1)?.sequence ?? 0) + 1,
    };

    await writeSamples(sample.sessionId, [...samples, nextSample]);

    return {
      sample: nextSample,
      imported: true,
    };
  },
  async appendSamples(samples: Omit<TrackingSampleRecord, "sequence">[]) {
    if (samples.length === 0) {
      return {
        importedCount: 0,
        lastSample: null,
        importedSampleCount: 0,
      };
    }

    const sessionId = samples[0]?.sessionId ?? "";
    const storedSamples = await listSamples(sessionId);
    const existingKeys = new Set(storedSamples.map((sample) => `${sample.source}:${sample.originId}`));
    const nextSamples = [...storedSamples];
    let importedCount = 0;
    let lastSample: TrackingSampleRecord | null = null;
    let nextSequence = storedSamples.at(-1)?.sequence ?? 0;

    for (const sample of samples) {
      const sampleKey = `${sample.source}:${sample.originId}`;
      const existingSample = existingKeys.has(sampleKey)
        ? nextSamples.find((storedSample) => storedSample.source === sample.source && storedSample.originId === sample.originId) ?? null
        : null;

      if (existingSample) {
        lastSample = existingSample;
        continue;
      }

      nextSequence += 1;
      const nextSample: TrackingSampleRecord = {
        ...sample,
        sequence: nextSequence,
      };
      nextSamples.push(nextSample);
      existingKeys.add(sampleKey);
      importedCount += 1;
      lastSample = nextSample;
    }

    await writeSamples(sessionId, nextSamples);
    const compactedSamples = await listSamples(sessionId);

    return {
      importedCount,
      lastSample: compactedSamples.at(-1) ?? lastSample,
      importedSampleCount: compactedSamples.length,
    };
  },
  listSamples,
  async getLastSample(sessionId: string) {
    return (await listSamples(sessionId)).at(-1) ?? null;
  },
  async clearSession(sessionId: string) {
    await mobileStorage.removeItem(sessionSamplesKey(sessionId));
  },
};

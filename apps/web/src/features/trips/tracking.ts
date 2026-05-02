export type TripSample = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string;
};

export type TripStopSuggestion = {
  id: string;
  latitude: number;
  longitude: number;
  startedAt: string;
  endedAt: string;
  dwellMinutes: number;
  title: string;
};

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function segmentDistanceKm(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(toLat - fromLat);
  const lonDelta = toRadians(toLon - fromLon);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function calculateTripDistanceKm(samples: TripSample[]) {
  let total = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    total += segmentDistanceKm(previous.latitude, previous.longitude, current.latitude, current.longitude);
  }

  return total;
}

export function appendTripSample(
  samples: TripSample[],
  nextSample: TripSample,
  maxJumpKm = 5,
): { samples: TripSample[]; distanceIncrementKm: number } {
  const previous = samples[samples.length - 1];
  if (!previous) {
    return { samples: [nextSample], distanceIncrementKm: 0 };
  }

  const jumpKm = segmentDistanceKm(
    previous.latitude,
    previous.longitude,
    nextSample.latitude,
    nextSample.longitude,
  );

  if (!Number.isFinite(jumpKm) || jumpKm < 0 || jumpKm > maxJumpKm) {
    return { samples, distanceIncrementKm: 0 };
  }

  return {
    samples: [...samples, nextSample],
    distanceIncrementKm: jumpKm,
  };
}

export function buildRoutePolyline(samples: TripSample[], maxPoints = 120) {
  if (samples.length <= maxPoints) {
    return samples.map((sample) => ({ latitude: sample.latitude, longitude: sample.longitude }));
  }

  const step = Math.max(1, Math.ceil(samples.length / maxPoints));
  const reduced = samples.filter((_, index) => index % step === 0);
  const last = samples[samples.length - 1];

  if (reduced[reduced.length - 1]?.recordedAt !== last.recordedAt) {
    reduced.push(last);
  }

  return reduced.map((sample) => ({ latitude: sample.latitude, longitude: sample.longitude }));
}

type DetectStopOptions = {
  clusterRadiusMeters?: number;
  minDwellMinutes?: number;
  minSamplesPerStop?: number;
};

export function detectStopSuggestions(samples: TripSample[], options: DetectStopOptions = {}) {
  const clusterRadiusMeters = options.clusterRadiusMeters ?? 120;
  const minDwellMinutes = options.minDwellMinutes ?? 5;
  const minSamplesPerStop = options.minSamplesPerStop ?? 3;

  if (samples.length < minSamplesPerStop) {
    return [] as TripStopSuggestion[];
  }

  const suggestions: TripStopSuggestion[] = [];

  let clusterStart = 0;
  let clusterAnchor = samples[0];

  const maybeCommitCluster = (endIndexInclusive: number) => {
    const cluster = samples.slice(clusterStart, endIndexInclusive + 1);
    if (cluster.length < minSamplesPerStop) {
      return;
    }

    const startTime = new Date(cluster[0].recordedAt).getTime();
    const endTime = new Date(cluster[cluster.length - 1].recordedAt).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      return;
    }

    const dwellMinutes = (endTime - startTime) / (1000 * 60);
    if (dwellMinutes < minDwellMinutes) {
      return;
    }

    const midpoint = cluster[Math.floor(cluster.length / 2)];
    suggestions.push({
      id: `Gig-${cluster[0].recordedAt}`,
      latitude: midpoint.latitude,
      longitude: midpoint.longitude,
      startedAt: cluster[0].recordedAt,
      endedAt: cluster[cluster.length - 1].recordedAt,
      dwellMinutes: Math.round(dwellMinutes),
      title: `Suggested Gig (${Math.round(dwellMinutes)} min)`,
    });
  };

  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index];
    const distanceMeters =
      segmentDistanceKm(clusterAnchor.latitude, clusterAnchor.longitude, sample.latitude, sample.longitude) * 1000;

    if (distanceMeters <= clusterRadiusMeters) {
      continue;
    }

    maybeCommitCluster(index - 1);
    clusterStart = index;
    clusterAnchor = sample;
  }

  maybeCommitCluster(samples.length - 1);
  return suggestions;
}

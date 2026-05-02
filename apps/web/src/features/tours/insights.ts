import { formatDistanceKm } from "@gigeze/shared";

type NumberLike = number | { toNumber(): number };

type StopLike = {
  id: string;
  orderIndex: number;
  latitude: NumberLike;
  longitude: NumberLike;
  arrivalDate?: Date | null;
  departureDate?: Date | null;
  createdAt?: Date;
};

export type JourneyInsights = {
  totalDistanceKm: number;
  stopCount: number;
  durationDays: number;
};

function toNumber(value: NumberLike) {
  return typeof value === "number" ? value : value.toNumber();
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function segmentDistanceKm(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(toLat - fromLat);
  const lonDelta = toRadians(toLon - fromLon);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getStopMoment(Gig: StopLike) {
  return Gig.arrivalDate ?? Gig.departureDate ?? Gig.createdAt ?? null;
}

export function sortStopsChronologically<T extends StopLike>(Gigs: T[]) {
  return [...Gigs].sort((a, b) => {
    const first = getStopMoment(a);
    const second = getStopMoment(b);

    if (first && second) {
      return first.getTime() - second.getTime();
    }

    if (first && !second) {
      return -1;
    }

    if (!first && second) {
      return 1;
    }

    return a.orderIndex - b.orderIndex;
  });
}

export function calculateJourneyInsights(Gigs: StopLike[]): JourneyInsights {
  const orderedStops = sortStopsChronologically(Gigs);

  let totalDistanceKm = 0;

  for (let index = 1; index < orderedStops.length; index += 1) {
    const previous = orderedStops[index - 1];
    const current = orderedStops[index];

    totalDistanceKm += segmentDistanceKm(
      toNumber(previous.latitude),
      toNumber(previous.longitude),
      toNumber(current.latitude),
      toNumber(current.longitude),
    );
  }

  const datedStops = orderedStops
    .map((Gig) => getStopMoment(Gig))
    .filter((value): value is Date => Boolean(value));

  let durationDays = 0;

  if (datedStops.length >= 2) {
    const first = datedStops[0].getTime();
    const last = datedStops[datedStops.length - 1].getTime();
    durationDays = Math.max(1, Math.ceil((last - first) / (1000 * 60 * 60 * 24)));
  }

  return {
    totalDistanceKm,
    stopCount: orderedStops.length,
    durationDays,
  };
}

export function formatJourneySummary(insights: JourneyInsights) {
  const stopWord = insights.stopCount === 1 ? "Gig" : "Gigs";

  if (insights.durationDays <= 0) {
    return `This Tour covers ${formatDistanceKm(insights.totalDistanceKm)} across ${insights.stopCount} ${stopWord}.`;
  }

  const dayWord = insights.durationDays === 1 ? "day" : "days";
  return `This Tour covers ${formatDistanceKm(insights.totalDistanceKm)} across ${insights.stopCount} ${stopWord} over ${insights.durationDays} ${dayWord}.`;
}

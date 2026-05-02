type NumberLike = number | { toNumber(): number };

type StopLike = {
  id: string;
  title: string;
  locationName?: string | null;
  latitude: NumberLike;
  longitude: NumberLike;
  arrivalDate?: Date | null;
  departureDate?: Date | null;
  createdAt?: Date;
};

type DrivingLogLike = {
  date: Date;
};

export type PredictiveSuggestion = {
  id: "add-Gig-here" | "create-driving-log";
  title: string;
  description: string;
  href: string;
  actionLabel: string;
};

function toNumber(value: NumberLike) {
  return typeof value === "number" ? value : value.toNumber();
}

function getStopMoment(Gig: StopLike) {
  return Gig.arrivalDate ?? Gig.departureDate ?? Gig.createdAt ?? null;
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

function getHoursSince(value: Date, now: Date) {
  return (now.getTime() - value.getTime()) / (1000 * 60 * 60);
}

export function buildPassiveActivitySuggestions(
  activeJourney:
    | {
        id: string;
        Gigs: StopLike[];
      }
    | undefined,
  drivingLogs: DrivingLogLike[],
  now = new Date(),
): PredictiveSuggestion[] {
  if (!activeJourney) {
    return [];
  }

  const timelineStops = [...activeJourney.Gigs]
    .map((Gig) => ({ Gig, moment: getStopMoment(Gig) }))
    .filter((item): item is { Gig: StopLike; moment: Date } => Boolean(item.moment))
    .sort((a, b) => b.moment.getTime() - a.moment.getTime());

  const latestStop = timelineStops[0];
  const previousStop = timelineStops[1];
  const latestDrivingLog = [...drivingLogs].sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  const suggestions: PredictiveSuggestion[] = [];

  if (latestStop) {
    const hoursSinceLatestStop = getHoursSince(latestStop.moment, now);

    if (hoursSinceLatestStop >= 30) {
      suggestions.push({
        id: "add-Gig-here",
        title: "Add a Gig here?",
        description: "It looks like there has been a gap since your last Gig update. Add your next place while it is fresh.",
        href: `/dashboard/Tours/${activeJourney.id}#add-Gig`,
        actionLabel: "Add Gig",
      });
    }

    if (previousStop && !suggestions.some((item) => item.id === "add-Gig-here")) {
      const distanceKm = segmentDistanceKm(
        toNumber(previousStop.Gig.latitude),
        toNumber(previousStop.Gig.longitude),
        toNumber(latestStop.Gig.latitude),
        toNumber(latestStop.Gig.longitude),
      );

      if (distanceKm >= 120 && hoursSinceLatestStop >= 12) {
        suggestions.push({
          id: "add-Gig-here",
          title: "Add a Gig here?",
          description: "Your recent Gig jump was fairly large. Consider adding a Gig to keep the route story complete.",
          href: `/dashboard/Tours/${activeJourney.id}#add-Gig`,
          actionLabel: "Add Gig",
        });
      }

      const hoursSinceDrivingLog = latestDrivingLog ? getHoursSince(latestDrivingLog.date, now) : Number.POSITIVE_INFINITY;

      if (distanceKm >= 40 && hoursSinceDrivingLog >= 24) {
        suggestions.push({
          id: "create-driving-log",
          title: "Create a driving log?",
          description: "Recent movement suggests a drive leg may be missing. Add a log while details are still easy to recall.",
          href: `/dashboard/logs/driving?journeyId=${activeJourney.id}`,
          actionLabel: "Log drive",
        });
      }
    }
  }

  return suggestions.slice(0, 2);
}
type DrivingLogLike = {
  date: Date;
  startOdometer: number;
  endOdometer: number;
};

type DatedLike = {
  createdAt: Date;
};

type JourneyLike = {
  id: string;
  slug: string;
  visibility: "PRIVATE" | "SHARED" | "PUBLIC";
  Gigs: Array<{ id: string }>;
};

type MediaLike = {
  id: string;
  createdAt: Date;
  journeyId?: string | null;
};

export type WeeklySummary = {
  distanceKm: number;
  stopsCount: number;
  mediaCount: number;
};

export type MilestoneSignal = {
  id: "first-Tour" | "ten-Gigs" | "hundred-km" | "first-shared-Tour";
  title: string;
  description: string;
};

function isWithinLastSevenLocalDays(value: Date, now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return value >= start && value <= end;
}

export function buildWeeklySummary(params: {
  now?: Date;
  drivingLogs: DrivingLogLike[];
  Gigs: DatedLike[];
  mediaItems: DatedLike[];
}): WeeklySummary {
  const now = params.now ?? new Date();
  const distanceKm = params.drivingLogs
    .filter((log) => isWithinLastSevenLocalDays(new Date(log.date), now))
    .reduce((sum, log) => sum + (log.endOdometer - log.startOdometer), 0);

  const stopsCount = params.Gigs.filter((Gig) => isWithinLastSevenLocalDays(new Date(Gig.createdAt), now)).length;
  const mediaCount = params.mediaItems.filter((item) => isWithinLastSevenLocalDays(new Date(item.createdAt), now)).length;

  return {
    distanceKm,
    stopsCount,
    mediaCount,
  };
}

export function hasWeeklyActivity(summary: WeeklySummary) {
  return summary.distanceKm > 0 || summary.stopsCount > 0 || summary.mediaCount > 0;
}

export function detectMilestones(params: {
  Tours: JourneyLike[];
  totalStops: number;
  totalDistanceKm: number;
}): MilestoneSignal[] {
  const milestones: MilestoneSignal[] = [];

  if (params.Tours.length === 1) {
    milestones.push({
      id: "first-Tour",
      title: "First Tour created",
      description: "You started your first trip timeline. Keep the momentum going.",
    });
  }

  if (params.totalStops >= 10) {
    milestones.push({
      id: "ten-Gigs",
      title: "10 Gigs reached",
      description: "You have built a meaningful trail of moments on the road.",
    });
  }

  if (params.totalDistanceKm >= 100) {
    milestones.push({
      id: "hundred-km",
      title: "100 km travelled",
      description: "You have crossed your first major distance milestone.",
    });
  }

  const publicJourneys = params.Tours.filter((Tour) => Tour.visibility === "PUBLIC");
  if (publicJourneys.length === 1) {
    milestones.push({
      id: "first-shared-Tour",
      title: "First shared Tour",
      description: "Your Tour is now visible for others to follow.",
    });
  }

  return milestones;
}

export function getShareJourneyPrompt(params: {
  activeJourney?: JourneyLike;
  mediaItems: MediaLike[];
}) {
  const activeJourney = params.activeJourney;
  if (!activeJourney || activeJourney.visibility !== "PUBLIC") {
    return null;
  }

  const stopCount = activeJourney.Gigs.length;
  const mediaCount = params.mediaItems.filter((item) => item.journeyId === activeJourney.id).length;

  if (stopCount < 3 && mediaCount < 3) {
    return null;
  }

  return {
      href: `/tours/${activeJourney.slug}/story`,
    label: "Share your Tour with others",
  };
}

export function shouldPromptInvite(params: {
  hasActiveJourney: boolean;
  memberCount: number;
  invitationCount: number;
}) {
  if (!params.hasActiveJourney) {
    return false;
  }

  return params.memberCount <= 1 && params.invitationCount <= 0;
}

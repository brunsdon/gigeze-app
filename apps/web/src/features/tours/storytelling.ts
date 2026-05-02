import { formatAppDateKey, formatInAppTimeZone } from "@/lib/datetime";

type StopLike = {
  id: string;
  title: string;
  orderIndex: number;
  locationName?: string | null;
  arrivalDate?: Date | null;
  departureDate?: Date | null;
  createdAt?: Date;
};

type MediaLike = {
  id: string;
  stopId?: string | null;
  publicUrl?: string | null;
  createdAt: Date;
  caption?: string | null;
};

type DrivingLogLike = {
  date: Date;
  startOdometer: number;
  endOdometer: number;
  startLocation?: string | null;
  endLocation?: string | null;
};

type ActivityNoteLike = {
  date: Date;
};

export type StopDayGroup<TStop extends StopLike> = {
  dayLabel: string;
  dateLabel: string;
  dateKey: string;
  Gigs: TStop[];
};

export type JourneyHighlights = {
  longestDrive: {
    distanceKm: number;
    dateLabel: string;
    routeLabel: string;
  } | null;
  stopWithMostMedia: {
    stopId: string;
    stopTitle: string;
    mediaCount: number;
  } | null;
  busiestDay: {
    dateLabel: string;
    activityCount: number;
  } | null;
};

export type HeroMediaMoment = {
  mediaUrl: string;
  caption: string;
  stopTitle: string | null;
  strategy: "busiest-Gig" | "latest" | "first";
};

function getStopMoment(Gig: StopLike) {
  return Gig.arrivalDate ?? Gig.departureDate ?? Gig.createdAt ?? null;
}

function formatDateLabel(value: Date) {
  return formatInAppTimeZone(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDayKey(value: Date) {
  return formatAppDateKey(value);
}

export function groupStopsByDay<TStop extends StopLike>(Gigs: TStop[]): StopDayGroup<TStop>[] {
  const orderedStops = [...Gigs].sort((a, b) => {
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
  const groupsByKey = new Map<string, { date: Date; Gigs: TStop[] }>();

  orderedStops.forEach((Gig) => {
    const moment = getStopMoment(Gig);
    const fallback = Gig.createdAt ?? new Date(0);
    const date = moment ?? fallback;
    const dayKey = toDayKey(date);

    const existing = groupsByKey.get(dayKey);
    if (existing) {
      existing.Gigs.push(Gig);
      return;
    }

    groupsByKey.set(dayKey, { date, Gigs: [Gig] });
  });

  return Array.from(groupsByKey.entries())
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .map(([dateKey, value], index) => ({
      dayLabel: `Day ${index + 1}`,
      dateLabel: formatDateLabel(value.date),
      dateKey,
      Gigs: value.Gigs,
    }));
}

export function calculateJourneyHighlights(params: {
  Gigs: StopLike[];
  mediaItems?: MediaLike[];
  drivingLogs?: DrivingLogLike[];
  activityNotes?: ActivityNoteLike[];
}): JourneyHighlights {
  const { Gigs, mediaItems = [], drivingLogs = [], activityNotes = [] } = params;

  const longestDriveEntry = drivingLogs.reduce<DrivingLogLike | null>((current, log) => {
    const distance = Math.max(0, log.endOdometer - log.startOdometer);

    if (!current) {
      return log;
    }

    const currentDistance = Math.max(0, current.endOdometer - current.startOdometer);
    return distance > currentDistance ? log : current;
  }, null);

  const mediaCountByStop = new Map<string, number>();
  mediaItems.forEach((item) => {
    if (!item.stopId) {
      return;
    }

    mediaCountByStop.set(item.stopId, (mediaCountByStop.get(item.stopId) ?? 0) + 1);
  });

  const stopWithMostMedia = Gigs.reduce<{ stopId: string; stopTitle: string; mediaCount: number } | null>((top, Gig) => {
    const count = mediaCountByStop.get(Gig.id) ?? 0;
    if (count === 0) {
      return top;
    }

    if (!top || count > top.mediaCount) {
      return {
        stopId: Gig.id,
        stopTitle: Gig.title,
        mediaCount: count,
      };
    }

    return top;
  }, null);

  const activityByDay = new Map<string, { date: Date; count: number }>();
  const incrementDay = (date: Date) => {
    const key = toDayKey(date);
    const existing = activityByDay.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }

    activityByDay.set(key, { date, count: 1 });
  };

  Gigs.forEach((Gig) => {
    const moment = getStopMoment(Gig);
    if (moment) {
      incrementDay(moment);
    }
  });

  mediaItems.forEach((item) => incrementDay(item.createdAt));
  drivingLogs.forEach((log) => incrementDay(log.date));
  activityNotes.forEach((note) => incrementDay(note.date));

  const busiestDay = Array.from(activityByDay.values()).reduce<{ date: Date; count: number } | null>((top, day) => {
    if (!top || day.count > top.count) {
      return day;
    }

    return top;
  }, null);

  return {
    longestDrive: longestDriveEntry
      ? {
          distanceKm: Math.max(0, longestDriveEntry.endOdometer - longestDriveEntry.startOdometer),
          dateLabel: formatDateLabel(longestDriveEntry.date),
          routeLabel: `${longestDriveEntry.startLocation || "Unknown start"} to ${longestDriveEntry.endLocation || "Unknown end"}`,
        }
      : null,
    stopWithMostMedia,
    busiestDay: busiestDay
      ? {
          dateLabel: formatDateLabel(busiestDay.date),
          activityCount: busiestDay.count,
        }
      : null,
  };
}

export function selectHeroMediaMoment(params: {
  Gigs: StopLike[];
  mediaItems?: MediaLike[];
}): HeroMediaMoment | null {
  const mediaWithPublicUrl = (params.mediaItems ?? []).filter((item) => item.publicUrl);
  if (!mediaWithPublicUrl.length) {
    return null;
  }

  const mediaByStop = new Map<string, MediaLike[]>();
  mediaWithPublicUrl.forEach((item) => {
    if (!item.stopId) {
      return;
    }

    const existing = mediaByStop.get(item.stopId) ?? [];
    existing.push(item);
    mediaByStop.set(item.stopId, existing);
  });

  let topStopId: string | null = null;
  let topCount = 0;
  mediaByStop.forEach((value, stopId) => {
    if (value.length > topCount) {
      topCount = value.length;
      topStopId = stopId;
    }
  });

  const resolveStopTitle = (stopId?: string | null) => {
    if (!stopId) {
      return null;
    }

    return params.Gigs.find((Gig) => Gig.id === stopId)?.title ?? null;
  };

  if (topStopId) {
    const stopMedia = [...(mediaByStop.get(topStopId) ?? [])].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const picked = stopMedia[0];

    if (picked?.publicUrl) {
      return {
        mediaUrl: picked.publicUrl,
        caption: picked.caption || "A highlight from this Tour",
        stopTitle: resolveStopTitle(topStopId),
        strategy: "busiest-Gig",
      };
    }
  }

  const latest = [...mediaWithPublicUrl].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (latest?.publicUrl) {
    return {
      mediaUrl: latest.publicUrl,
      caption: latest.caption || "Most recent memory",
      stopTitle: resolveStopTitle(latest.stopId),
      strategy: "latest",
    };
  }

  const first = [...mediaWithPublicUrl].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  if (!first?.publicUrl) {
    return null;
  }

  return {
    mediaUrl: first.publicUrl,
    caption: first.caption || "First captured memory",
    stopTitle: resolveStopTitle(first.stopId),
    strategy: "first",
  };
}

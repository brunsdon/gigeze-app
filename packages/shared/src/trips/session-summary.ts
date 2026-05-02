import type { TripSession, TripSummary } from "../types/trips";
import { minutesBetweenIso } from "../utils/datetime";

export function summarizeTripSession(session: TripSession, nowIso = new Date().toISOString()): TripSummary {
  const endedAt = session.endedAt ?? (session.status === "active" ? nowIso : undefined);

  return {
    sessionId: session.id,
    status: session.status,
    startedAt: session.startedAt,
    endedAt,
    durationMinutes: minutesBetweenIso(session.startedAt, endedAt ?? session.startedAt),
    distanceKilometers:
      typeof session.distanceMeters === "number" ? Math.round((session.distanceMeters / 1000) * 10) / 10 : undefined,
  };
}

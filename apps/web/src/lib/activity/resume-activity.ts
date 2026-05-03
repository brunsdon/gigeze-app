export const RESUME_ACTIVITY_STORAGE_KEY = "gigeze.resume-activity";
const MAX_ACTIVITY_AGE_MS = 1000 * 60 * 60 * 24 * 14;

export type ResumeActivity = {
  href: string;
  label: string;
  updatedAt: number;
};

function normalizePathname(pathname: string) {
  const [cleanPath] = pathname.split("?");
  return cleanPath.replace(/\/$/, "") || "/";
}

export function toTrackedActivity(pathname: string, now = Date.now()): ResumeActivity | null {
  const cleanPath = normalizePathname(pathname);

  if (/^\/dashboard\/tours\/[^/]+\/edit$/.test(cleanPath)) {
    return {
      href: cleanPath,
      label: "Continue editing a Tour",
      updatedAt: now,
    };
  }

  if (/^\/dashboard\/tours\/[^/]+\/gigs\/[^/]+\/edit$/.test(cleanPath)) {
    return {
      href: cleanPath,
      label: "Continue editing a Gig",
      updatedAt: now,
    };
  }

  if (/^\/dashboard\/logs\/driving\/[^/]+\/edit$/.test(cleanPath)) {
    return {
      href: cleanPath,
      label: "Continue editing a driving log",
      updatedAt: now,
    };
  }

  if (/^\/dashboard\/activity\/[^/]+\/edit$/.test(cleanPath)) {
    return {
      href: cleanPath,
      label: "Continue editing activity",
      updatedAt: now,
    };
  }

  if (cleanPath === "/dashboard/media") {
    return {
      href: cleanPath,
      label: "Continue adding moments",
      updatedAt: now,
    };
  }

  if (/^\/dashboard\/media\/[^/]+\/edit$/.test(cleanPath)) {
    return {
      href: cleanPath,
      label: "Continue editing uploaded moment details",
      updatedAt: now,
    };
  }

  return null;
}

export function isActivityFresh(activity: ResumeActivity, now = Date.now()) {
  return now - activity.updatedAt <= MAX_ACTIVITY_AGE_MS;
}

export function parseStoredActivity(raw: string | null, now = Date.now()): ResumeActivity | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ResumeActivity>;
    if (
      typeof parsed.href !== "string" ||
      typeof parsed.label !== "string" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    const activity: ResumeActivity = {
      href: normalizePathname(parsed.href),
      label: parsed.label,
      updatedAt: parsed.updatedAt,
    };

    if (!isActivityFresh(activity, now)) {
      return null;
    }

    return activity;
  } catch {
    return null;
  }
}

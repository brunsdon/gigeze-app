"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type JourneyFollowToggleProps = {
  journeyKey: string;
  journeyTitle: string;
};

const FOLLOWING_KEY = "gigeze.following.Tours.v1";

function loadFollowing() {
  try {
    const raw = localStorage.getItem(FOLLOWING_KEY);
    if (!raw) {
      return [] as string[];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }

    return [] as string[];
  } catch {
    return [] as string[];
  }
}

function saveFollowing(ids: string[]) {
  localStorage.setItem(FOLLOWING_KEY, JSON.stringify(ids));
}

export function JourneyFollowToggle({ journeyKey, journeyTitle }: JourneyFollowToggleProps) {
  const [followingIds, setFollowingIds] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadFollowing(),
  );

  const isFollowing = useMemo(() => followingIds.includes(journeyKey), [followingIds, journeyKey]);

  function toggle() {
    setFollowingIds((current) => {
      const next = current.includes(journeyKey)
        ? current.filter((id) => id !== journeyKey)
        : [...current, journeyKey];
      saveFollowing(next);
      return next;
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={toggle}>
        {isFollowing ? "Following this Tour" : "Follow this Tour"}
      </Button>
      {isFollowing ? <p className="text-xs text-muted-foreground">Saved locally for quick return to {journeyTitle}.</p> : null}
    </div>
  );
}

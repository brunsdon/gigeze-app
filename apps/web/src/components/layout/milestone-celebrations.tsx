"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";

type Milestone = {
  id: string;
  title: string;
  description: string;
};

type MilestoneCelebrationsProps = {
  milestones: Milestone[];
  shareJourneyHref?: string;
};

const SEEN_KEY = "gigeze.milestones.seen.v1";
const DISMISSED_KEY = "gigeze.milestones.dismissed.v1";

function loadIds(key: string) {
  try {
    const value = localStorage.getItem(key);
    if (!value) {
      return [] as string[];
    }

    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }

    return [] as string[];
  } catch {
    return [] as string[];
  }
}

function saveIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids));
}

export function MilestoneCelebrations({ milestones, shareJourneyHref }: MilestoneCelebrationsProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadIds(DISMISSED_KEY),
  );

  useEffect(() => {
    const seen = loadIds(SEEN_KEY);
    const unseen = milestones.filter((milestone) => !seen.includes(milestone.id));

    if (!unseen.length) {
      return;
    }

    unseen.slice(0, 1).forEach((milestone) => {
      toast.success(`Milestone reached: ${milestone.title}`, {
        description: milestone.description,
      });
    });

    saveIds(SEEN_KEY, [...new Set([...seen, ...unseen.map((item) => item.id)])]);
  }, [milestones]);

  const visibleMilestones = useMemo(
    () => milestones.filter((milestone) => !dismissedIds.includes(milestone.id)),
    [dismissedIds, milestones],
  );

  function dismiss(milestoneId: string) {
    setDismissedIds((current) => {
      if (current.includes(milestoneId)) {
        return current;
      }

      const next = [...current, milestoneId];
      saveIds(DISMISSED_KEY, next);
      return next;
    });
  }

  if (!visibleMilestones.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleMilestones.slice(0, 2).map((milestone) => (
        <Alert key={milestone.id} className="bg-card/96 transition-[transform,opacity] duration-200 animate-in fade-in-0 slide-in-from-top-1">
          <AlertTitle>{milestone.title}</AlertTitle>
          <AlertDescription>{milestone.description}</AlertDescription>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {shareJourneyHref ? (
              <Link href={shareJourneyHref} className={buttonVariants({ size: "sm" })}>
                Share your Tour
              </Link>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => dismiss(milestone.id)}>
              Dismiss
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
}

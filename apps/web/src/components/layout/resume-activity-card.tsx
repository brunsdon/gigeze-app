"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  parseStoredActivity,
  RESUME_ACTIVITY_STORAGE_KEY,
  type ResumeActivity,
} from "@/lib/activity/resume-activity";

type ResumeActivityCardProps = {
  fallbackHref?: string;
  fallbackTitle?: string;
  fallbackStopCount?: number;
};

export function ResumeActivityCard({ fallbackHref, fallbackTitle, fallbackStopCount }: ResumeActivityCardProps) {
  const [activity] = useState<ResumeActivity | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return parseStoredActivity(window.localStorage.getItem(RESUME_ACTIVITY_STORAGE_KEY));
  });

  if (!activity && !fallbackHref) {
    return null;
  }

  const href = activity?.href ?? fallbackHref!;
  const title = activity?.label ?? "Continue your latest Tour";
  const detail = activity
    ? "Pick up where you left off from your most recent editing or upload flow."
    : `${fallbackTitle ?? "Latest Tour"}${typeof fallbackStopCount === "number" ? ` • ${fallbackStopCount} Gigs` : ""}`;

  return (
    <Card className="border-primary/30 bg-primary/6">
      <CardHeader>
        <CardTitle className="text-base">Continue where you left off</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
        <Link href={href} className={buttonVariants({ size: "lg" })}>
          Continue
        </Link>
      </CardContent>
    </Card>
  );
}

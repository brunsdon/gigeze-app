"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { RESUME_ACTIVITY_STORAGE_KEY, toTrackedActivity } from "@/lib/activity/resume-activity";

export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const activity = toTrackedActivity(pathname);
    if (!activity) {
      return;
    }

    localStorage.setItem(RESUME_ACTIVITY_STORAGE_KEY, JSON.stringify(activity));
  }, [pathname]);

  return null;
}
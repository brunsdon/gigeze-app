"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const DISMISSED_REMINDERS_KEY = "gigeze.dismissed-reminders.v1";
const MAX_VISIBLE_REMINDERS = 2;

type Reminder = {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
};

type SmartRemindersProps = {
  hasJourneys: boolean;
  hasActiveJourney: boolean;
  activeJourneyId?: string;
  activeJourneyHasStops: boolean;
  hasDrivingLogs: boolean;
  lastWeekDrivingKm: number;
  lastWeekActivityHours: number;
  mediaCount: number;
  shareJourneyHref?: string;
  showInvitePrompt?: boolean;
};

export function buildSmartReminders(props: SmartRemindersProps): Reminder[] {
  const reminders: Reminder[] = [];

  if (props.hasJourneys && !props.hasActiveJourney) {
    reminders.push({
      id: "set-active-Tour",
      title: "Pick your current Tour",
      description: "Choose one Tour as active so quick actions and moments stay focused on the trip you are on.",
      href: "/dashboard/Tours",
      actionLabel: "Choose Tour",
    });
  }

  if (props.hasActiveJourney && !props.activeJourneyHasStops && props.activeJourneyId) {
    reminders.push({
      id: "add-first-Gig",
      title: "Add your first Gig",
      description: "You are all set to start this trip, you just need your first Gig.",
      href: `/dashboard/Tours/${props.activeJourneyId}#add-Gig`,
      actionLabel: "Add Gig",
    });
  }

  if (props.hasActiveJourney && props.lastWeekDrivingKm < 30) {
    reminders.push({
      id: "log-week-driving",
      title: props.hasDrivingLogs ? "Quiet week on the road" : "No driving logs yet",
      description: props.hasDrivingLogs
        ? "Add your next leg so your distance tracking and weekly trends stay accurate."
        : "Add your first trip to start your odometer-based distance history.",
      href: "/dashboard/logs/driving",
      actionLabel: "Add trip",
    });
  }

  if (props.hasActiveJourney && props.lastWeekActivityHours <= 0) {
    reminders.push({
      id: "log-week-activity",
      title: "No activity notes logged this week",
      description: "Add a quick activity note so useful details from the road stay with the Tour.",
      href: "/dashboard/activity",
      actionLabel: "Add activity",
    });
  }

  if (props.mediaCount < 3) {
    reminders.push({
      id: "capture-moment",
      title: "Add moments",
      description: "Add a Flickr photo or YouTube video so important Gigs are easier to remember later.",
      href: "/dashboard/media#add-moment",
      actionLabel: "Add moment",
    });
  }

  if (props.shareJourneyHref) {
    reminders.push({
      id: "share-Tour",
      title: "Ready to share this trip?",
      description: "Share your Tour with others and let them follow your story as it unfolds.",
      href: props.shareJourneyHref,
      actionLabel: "Share your Tour with others",
    });
  }

  if (props.showInvitePrompt) {
    reminders.push({
      id: "invite-others",
      title: "Invite others to follow",
      description: "You have an active Tour. Invite family or friends to stay in the loop.",
      href: "/dashboard/sharing",
      actionLabel: "Invite others to follow your Tour",
    });
  }

  return reminders;
}

export function SmartReminders(props: SmartRemindersProps) {
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    const stored = window.localStorage.getItem(DISMISSED_REMINDERS_KEY);
    if (!stored) {
      return [];
    }

    try {
      const parsed = JSON.parse(stored) as unknown;
      return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
    } catch {
      return [];
    }
  });
  const [showAll, setShowAll] = useState(false);

  const reminders = useMemo(() => {
    const all = buildSmartReminders(props);
    return all.filter((reminder) => !dismissedIds.includes(reminder.id));
  }, [dismissedIds, props]);

  const visibleReminders = showAll ? reminders : reminders.slice(0, MAX_VISIBLE_REMINDERS);

  function dismissReminder(reminderId: string) {
    setDismissedIds((previous) => {
      if (previous.includes(reminderId)) {
        return previous;
      }

      const next = [...previous, reminderId];
      localStorage.setItem(DISMISSED_REMINDERS_KEY, JSON.stringify(next));
      return next;
    });
  }

  if (!reminders.length) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleReminders.map((reminder) => (
        <Alert key={reminder.id} className="bg-card/96">
          <AlertTitle>{reminder.title}</AlertTitle>
          <AlertDescription>{reminder.description}</AlertDescription>
          <AlertAction className="static mt-2 flex flex-wrap gap-2 sm:absolute sm:top-2 sm:right-2 sm:mt-0">
            <Link href={reminder.href} className={buttonVariants({ size: "sm", variant: "outline" })}>
              {reminder.actionLabel}
            </Link>
            <Button size="sm" variant="ghost" onClick={() => dismissReminder(reminder.id)}>
              Dismiss
            </Button>
          </AlertAction>
        </Alert>
      ))}
      {reminders.length > MAX_VISIBLE_REMINDERS ? (
        <Button
          size="sm"
          variant="ghost"
          className="w-fit"
          onClick={() => setShowAll((previous) => !previous)}
        >
          {showAll ? "Show fewer tips" : `Show ${reminders.length - MAX_VISIBLE_REMINDERS} more tips`}
        </Button>
      ) : null}
    </div>
  );
}

import { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { type ActivityNoteCreateInput } from "@/lib/validation";
import { AppError } from "@/lib/utils/app-error";

export const activityTypes = [
  ActivityType.WORK,
  ActivityType.MAINTENANCE,
  ActivityType.ADMIN,
  ActivityType.PERSONAL,
] as const;

export type ActivityNoteServiceContext = {
  workspaceId: string;
  userId: string;
};

async function assertJourneyInWorkspace(workspaceId: string, journeyId: string) {
  const Tour = await prisma.tour.findFirst({
    where: { id: journeyId, workspaceId },
    select: { id: true },
  });

  if (!Tour) {
    throw new AppError("activity-note-invalid-Tour-reference", "ACTIVITY_NOTE_INVALID_JOURNEY_REFERENCE");
  }
}

async function assertStopInJourney(workspaceId: string, journeyId: string, stopId?: string) {
  if (!stopId) {
    return;
  }

  const Gig = await prisma.gig.findFirst({
    where: { id: stopId, workspaceId },
    select: { id: true, journeyId: true },
  });

  if (!Gig) {
    throw new AppError("activity-note-invalid-Gig-reference", "ACTIVITY_NOTE_INVALID_STOP_REFERENCE");
  }

  if (Gig.journeyId !== journeyId) {
    throw new AppError("activity-note-Gig-Tour-mismatch", "ACTIVITY_NOTE_STOP_JOURNEY_MISMATCH");
  }
}

export function getActivityTypeLabel(type: ActivityType) {
  switch (type) {
    case ActivityType.WORK:
      return "Work";
    case ActivityType.MAINTENANCE:
      return "Maintenance";
    case ActivityType.ADMIN:
      return "Admin";
    case ActivityType.PERSONAL:
      return "Personal";
  }
}

export function formatActivityDuration(durationMinutes?: number | null) {
  if (!durationMinutes) {
    return null;
  }

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours && minutes) {
    return `${hours} h ${minutes} min`;
  }

  if (hours) {
    return `${hours} h`;
  }

  return `${minutes} min`;
}

export async function listActivityNotes(workspaceId: string) {
  return prisma.activityNote.findMany({
    where: { workspaceId },
    include: {
      Tour: {
        select: { id: true, title: true, slug: true },
      },
      Gig: {
        select: { id: true, title: true, journeyId: true },
      },
    },
    orderBy: { date: "desc" },
  });
}

export async function listActivityNotesForJourney(workspaceId: string, journeyId: string) {
  return prisma.activityNote.findMany({
    where: { workspaceId, journeyId },
    include: {
      Gig: {
        select: { id: true, title: true, journeyId: true },
      },
    },
    orderBy: { date: "desc" },
  });
}

export async function getActivityNoteById(noteId: string, workspaceId: string) {
  return prisma.activityNote.findFirst({
    where: { id: noteId, workspaceId },
    include: {
      Tour: {
        select: { id: true, title: true, slug: true },
      },
      Gig: {
        select: { id: true, title: true, journeyId: true },
      },
    },
  });
}

export async function createActivityNote(input: ActivityNoteCreateInput, context: ActivityNoteServiceContext) {
  await assertJourneyInWorkspace(context.workspaceId, input.journeyId);
  await assertStopInJourney(context.workspaceId, input.journeyId, input.stopId);

  return prisma.activityNote.create({
    data: {
      workspaceId: context.workspaceId,
      createdByUserId: context.userId,
      journeyId: input.journeyId,
      stopId: input.stopId,
      type: input.type,
      date: input.date,
      durationMinutes: input.durationMinutes,
      location: input.location,
      notes: input.notes,
      visibility: input.visibility,
    },
  });
}

export async function updateActivityNote(noteId: string, input: ActivityNoteCreateInput, workspaceId: string) {
  const existing = await prisma.activityNote.findFirst({
    where: { id: noteId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("activity-note-not-found", "ACTIVITY_NOTE_NOT_FOUND");
  }

  await assertJourneyInWorkspace(workspaceId, input.journeyId);
  await assertStopInJourney(workspaceId, input.journeyId, input.stopId);

  return prisma.activityNote.update({
    where: { id: noteId },
    data: {
      journeyId: input.journeyId,
      stopId: input.stopId,
      type: input.type,
      date: input.date,
      durationMinutes: input.durationMinutes,
      location: input.location,
      notes: input.notes,
      visibility: input.visibility,
    },
  });
}

export async function deleteActivityNote(noteId: string, workspaceId: string) {
  const existing = await prisma.activityNote.findFirst({
    where: { id: noteId, workspaceId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError("activity-note-not-found", "ACTIVITY_NOTE_NOT_FOUND");
  }

  return prisma.activityNote.delete({
    where: { id: noteId },
  });
}

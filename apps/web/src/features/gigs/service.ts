import { Prisma, type Visibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { type StopCreateInput, type StopUpdateInput } from "@/lib/validation";
import { AppError } from "@/lib/utils/app-error";

export type StopServiceContext = {
  workspaceId: string;
  userId: string;
};

async function getOrderedStopsTx(tx: Prisma.TransactionClient, workspaceId: string, journeyId: string) {
  return tx.gig.findMany({
    where: { workspaceId, journeyId },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
}

async function rewriteStopOrderTx(tx: Prisma.TransactionClient, orderedStops: Array<{ id: string }>) {
  await Promise.all(
    orderedStops.map((Gig, index) =>
      tx.gig.update({
        where: { id: Gig.id },
        data: { orderIndex: index + 1 },
      }),
    ),
  );
}

async function normalizeStopOrderTx(tx: Prisma.TransactionClient, workspaceId: string, journeyId: string) {
  const orderedStops = await getOrderedStopsTx(tx, workspaceId, journeyId);
  await rewriteStopOrderTx(tx, orderedStops);
}

async function moveStopByOffsetTx(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  stopId: string,
  direction: -1 | 1,
) {
  const Gig = await tx.gig.findFirst({
    where: { id: stopId, workspaceId },
    select: { id: true, journeyId: true },
  });

  if (!Gig) {
    throw new AppError("Gig-not-found", "STOP_NOT_FOUND");
  }

  const orderedStops = await getOrderedStopsTx(tx, workspaceId, Gig.journeyId);
  const currentIndex = orderedStops.findIndex((item) => item.id === Gig.id);
  const targetIndex = currentIndex + direction;

  if (currentIndex >= 0 && targetIndex >= 0 && targetIndex < orderedStops.length) {
    const swapTarget = orderedStops[targetIndex];
    orderedStops[targetIndex] = orderedStops[currentIndex];
    orderedStops[currentIndex] = swapTarget;
    await rewriteStopOrderTx(tx, orderedStops);
  }

  return Gig;
}

function clampOrderIndex(rawIndex: number, max: number) {
  const normalized = Number.isFinite(rawIndex) ? Math.trunc(rawIndex) : max;
  return Math.max(1, Math.min(normalized, max));
}

export async function listStopsForJourney(
  workspaceId: string,
  journeyId: string,
  allowedVisibilities?: Visibility[],
) {
  return prisma.gig.findMany({
    where: {
      workspaceId,
      journeyId,
      ...(allowedVisibilities?.length ? { visibility: { in: allowedVisibilities } } : {}),
    },
    orderBy: { orderIndex: "asc" },
  });
}

export async function getStopById(workspaceId: string, stopId: string) {
  return prisma.gig.findFirst({
    where: { id: stopId, workspaceId },
  });
}

export async function createStop(input: StopCreateInput, context: StopServiceContext) {
  return prisma.$transaction(async (tx) => {
    const Tour = await tx.tour.findFirst({
      where: { id: input.journeyId, workspaceId: context.workspaceId },
      select: { id: true },
    });

    if (!Tour) {
      throw new AppError("Gig-Tour-mismatch", "STOP_JOURNEY_MISMATCH");
    }

    const stopCount = await tx.gig.count({
      where: { workspaceId: context.workspaceId, journeyId: input.journeyId },
    });

    const Gig = await tx.gig.create({
      data: {
        workspaceId: context.workspaceId,
        createdByUserId: context.userId,
        journeyId: input.journeyId,
        title: input.title,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        locationName: input.locationName,
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        visibility: input.visibility,
        orderIndex: clampOrderIndex(
          input.orderIndex > 0 ? input.orderIndex : stopCount + 1,
          stopCount + 1,
        ),
      },
    });

    await normalizeStopOrderTx(tx, context.workspaceId, input.journeyId);
    return Gig;
  });
}

export async function updateStop(stopId: string, input: StopUpdateInput, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const existingStop = await tx.gig.findFirst({
      where: { id: stopId, workspaceId },
      select: { id: true, journeyId: true },
    });

    if (!existingStop) {
      throw new AppError("Gig-not-found", "STOP_NOT_FOUND");
    }

    if (existingStop.journeyId !== input.journeyId) {
      throw new AppError("Gig-Tour-mismatch", "STOP_JOURNEY_MISMATCH");
    }

    const totalStops = await tx.gig.count({
      where: { workspaceId, journeyId: existingStop.journeyId },
    });

    const updatedStop = await tx.gig.update({
      where: { id: stopId },
      data: {
        title: input.title,
        description: input.description,
        latitude: input.latitude,
        longitude: input.longitude,
        locationName: input.locationName,
        arrivalDate: input.arrivalDate,
        departureDate: input.departureDate,
        visibility: input.visibility,
        orderIndex: clampOrderIndex(input.orderIndex, totalStops),
      },
    });

    await normalizeStopOrderTx(tx, workspaceId, existingStop.journeyId);
    return updatedStop;
  });
}

export async function deleteStop(stopId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    const existingStop = await tx.gig.findFirst({
      where: { id: stopId, workspaceId },
      select: { id: true, journeyId: true },
    });

    if (!existingStop) {
      throw new AppError("Gig-not-found", "STOP_NOT_FOUND");
    }

    await tx.externalMediaLink.updateMany({
      where: {
        workspaceId,
        entityType: "MOMENT",
        entityId: stopId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    const deletedStop = await tx.gig.delete({
      where: { id: stopId },
    });

    await normalizeStopOrderTx(tx, workspaceId, existingStop.journeyId);
    return deletedStop;
  });
}

export async function moveStopUp(stopId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    return moveStopByOffsetTx(tx, workspaceId, stopId, -1);
  });
}

export async function moveStopDown(stopId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    return moveStopByOffsetTx(tx, workspaceId, stopId, 1);
  });
}

export async function normalizeStopOrder(journeyId: string, workspaceId: string) {
  return prisma.$transaction(async (tx) => {
    await normalizeStopOrderTx(tx, workspaceId, journeyId);
  });
}

export async function duplicateStop(stopId: string, context: StopServiceContext) {
  return prisma.$transaction(async (tx) => {
    const existingStop = await tx.gig.findFirst({
      where: { id: stopId, workspaceId: context.workspaceId },
    });

    if (!existingStop) {
      throw new AppError("Gig-not-found", "STOP_NOT_FOUND");
    }

    const totalStops = await tx.gig.count({
      where: { workspaceId: context.workspaceId, journeyId: existingStop.journeyId },
    });

    const duplicatedStop = await tx.gig.create({
      data: {
        workspaceId: context.workspaceId,
        createdByUserId: context.userId,
        journeyId: existingStop.journeyId,
        title: `${existingStop.title} (Copy)`,
        description: existingStop.description,
        latitude: existingStop.latitude,
        longitude: existingStop.longitude,
        locationName: existingStop.locationName,
        arrivalDate: existingStop.arrivalDate,
        departureDate: existingStop.departureDate,
        visibility: existingStop.visibility,
        orderIndex: clampOrderIndex(existingStop.orderIndex + 1, totalStops + 1),
      },
    });

    await normalizeStopOrderTx(tx, context.workspaceId, existingStop.journeyId);
    return duplicatedStop;
  });
}

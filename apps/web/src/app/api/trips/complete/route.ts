import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { tripModes } from "@gigeze/shared";
import { z } from "zod";
import {
  appendDrivingLogGpsSamples,
  createDrivingLogWithGpsSamples,
  findMatchingTripCompletionDraftByMobileTripId,
  findMatchingTripCompletionDraft,
  getDeletedDrivingLogById,
  getStartOdometerForVehicle,
  updateDrivingLogTripMetadata,
} from "@/features/driving-logs/service";
import { getVehicleById } from "@/features/vehicles/service";
import { getOrCreateCurrentUserFromSessionUser, getWorkspaceOwnerForUser, requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { reverseGeocodeTripEndpoints } from "@/lib/maps/geocoding";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { getErrorMessage } from "@/lib/utils/app-error";

const completeTripSchema = z.object({
  mobileTripId: z.string().trim().max(120).optional(),
  journeyId: z.string().optional(),
  journeyTitle: z.string().optional(),
  tripMode: z.enum(tripModes).default("DRIVE"),
  vehicleId: z.string().optional(),
  backendTripId: z.string().optional(),
  tripPurpose: z.enum(["PRIVATE", "BUSINESS"]).optional(),
  purpose: z.string().trim().max(200).optional(),
  startOdometer: z.number().int().nonnegative().optional(),
  endOdometer: z.number().int().nonnegative().optional(),
  startedAt: z.string(),
  endedAt: z.string(),
  distanceKm: z.number().nonnegative(),
  samples: z.array(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
      accuracyMeters: z.number().nullable(),
      recordedAt: z.string(),
    }),
  ).default([]),
  routePolyline: z.array(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
    }),
  ),
  stopSuggestions: z.array(
    z.object({
      title: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      dwellMinutes: z.number(),
    }),
  ),
});

function toDateOrNow(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }

  return parsed;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function mapGpsSamples(samples: { latitude: number; longitude: number; accuracyMeters: number | null; recordedAt: string }[]) {
  return samples.map((sample) => ({
    latitude: sample.latitude,
    longitude: sample.longitude,
    accuracyMeters: sample.accuracyMeters,
    recordedAt: toDateOrNow(sample.recordedAt),
  }));
}

async function getSafeTripEndpointLocations(
  samples: { latitude: number; longitude: number }[],
  fallbackStartLabel: string,
  fallbackEndLabel: string,
) {
  try {
    const geocodedEndpoints = await reverseGeocodeTripEndpoints(samples);
    return {
      startLabel: geocodedEndpoints.startLocation || fallbackStartLabel,
      endLabel: geocodedEndpoints.endLocation || fallbackEndLabel,
      startFormattedAddress: geocodedEndpoints.startLocation ?? undefined,
      endFormattedAddress: geocodedEndpoints.endLocation ?? undefined,
    };
  } catch {
    return {
      startLabel: fallbackStartLabel,
      endLabel: fallbackEndLabel,
      startFormattedAddress: undefined,
      endFormattedAddress: undefined,
    };
  }
}

async function getTripCompletionAuthContext(request: Request) {
  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    const user = await requireAuthenticatedUser();
    const workspace = await requireWorkspaceOwner();
    return { user, workspace };
  }

  const { url, anonKey } = getSupabasePublicEnv();
  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(bearerToken);

  if (error || !data.user) {
    return null;
  }

  const user = await getOrCreateCurrentUserFromSessionUser({
    id: data.user.id,
    email: data.user.email,
    user_metadata: data.user.user_metadata,
  });

  if (!user) {
    return null;
  }

  const workspace = await getWorkspaceOwnerForUser(user.id);
  if (!workspace) {
    return null;
  }

  return { user, workspace };
}

export async function POST(request: Request) {
  const authContext = await getTripCompletionAuthContext(request);

  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { user, workspace } = authContext;

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = completeTripSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-trip-payload" }, { status: 400 });
  }

  const distanceKm = Math.max(0, Math.round(parsed.data.distanceKm));
  const tripMode = parsed.data.tripMode;
  const startedAt = toDateOrNow(parsed.data.startedAt);
  const completedAt = toDateOrNow(parsed.data.endedAt);
  const fallbackStartLabel = parsed.data.stopSuggestions[0]?.title || "GPS route recorded";
  const fallbackEndLabel = parsed.data.stopSuggestions.at(-1)?.title || "GPS route recorded";
  const { startLabel, endLabel, startFormattedAddress, endFormattedAddress } = await getSafeTripEndpointLocations(
    parsed.data.samples,
    fallbackStartLabel,
    fallbackEndLabel,
  );
  const routePointCount = parsed.data.routePolyline.length;
  const hasRouteSamples = parsed.data.samples.length > 0 || routePointCount > 0;
  const notePrefix = parsed.data.journeyTitle ? `Tour: ${parsed.data.journeyTitle}` : "Tour: Unlinked";
  const mobileTripNote = parsed.data.mobileTripId ? ` Mobile trip: ${parsed.data.mobileTripId}.` : "";

  try {
    if (tripMode === "WALK" && parsed.data.vehicleId) {
      return NextResponse.json({ error: "driving-log-walk-trip-does-not-allow-vehicle" }, { status: 400 });
    }

    const vehicle = parsed.data.vehicleId
      && tripMode !== "WALK"
      ? await getVehicleById(parsed.data.vehicleId, workspace.id)
      : null;

    if (parsed.data.vehicleId && !vehicle) {
      return NextResponse.json({ error: "driving-log-invalid-vehicle-reference" }, { status: 400 });
    }

    if (vehicle && vehicle.vehicleMode !== tripMode) {
      return NextResponse.json({ error: "driving-log-vehicle-mode-mismatch" }, { status: 400 });
    }
    const businessSplitEnabled = tripMode !== "WALK" && vehicle?.enableBusinessSplit === true;
    const isBusinessUse = businessSplitEnabled
      ? (parsed.data.tripPurpose ? parsed.data.tripPurpose === "BUSINESS" : vehicle?.defaultUse === "BUSINESS")
      : false;
    const businessKm = isBusinessUse ? distanceKm : 0;
    const personalKm = isBusinessUse ? 0 : distanceKm;
    const notes =
      `[Trip draft] Passive GPS session captured. Mode: ${tripMode}. ${notePrefix}. ` +
      `Estimated distance ${distanceKm} km. Route samples: ${routePointCount}. ` +
      `Started ${parsed.data.startedAt}. Ended ${parsed.data.endedAt}.${mobileTripNote}`;

    if (parsed.data.backendTripId) {
      const deletedDraft = await getDeletedDrivingLogById(parsed.data.backendTripId, {
        workspaceId: workspace.id,
        userId: user.id,
      });

      if (deletedDraft) {
        return NextResponse.json({
          draftLogId: deletedDraft.id,
          deletedAt: deletedDraft.deletedAt.toISOString(),
        });
      }

      const updatedDraft = await updateDrivingLogTripMetadata(
        parsed.data.backendTripId,
        {
          journeyId: parsed.data.journeyId ?? null,
          tripMode,
          vehicleId: tripMode === "WALK" ? null : (parsed.data.vehicleId ?? null),
          startLocation: startLabel,
          endLocation: endLabel,
          startFormattedAddress,
          endFormattedAddress,
          startOdometer: parsed.data.startOdometer,
          endOdometer: parsed.data.endOdometer,
          businessKm,
          personalKm,
          purpose: parsed.data.purpose,
          hasRouteSamples,
        },
        {
          workspaceId: workspace.id,
          userId: user.id,
        },
      );

      if (updatedDraft.deletedAt) {
        return NextResponse.json({
          draftLogId: updatedDraft.id,
          deletedAt: updatedDraft.deletedAt.toISOString(),
        });
      }

      await appendDrivingLogGpsSamples(updatedDraft.id, mapGpsSamples(parsed.data.samples), {
        workspaceId: workspace.id,
        userId: user.id,
      });

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/logs/driving");
      revalidatePath("/dashboard/Tours");

      return NextResponse.json({
        draftLogId: updatedDraft.id,
        editHref: `/dashboard/logs/driving/${updatedDraft.id}/edit`,
        distanceKm,
      });
    }

    const existingDraftByMobileTripId = parsed.data.mobileTripId
      ? await findMatchingTripCompletionDraftByMobileTripId(parsed.data.mobileTripId, {
          workspaceId: workspace.id,
          userId: user.id,
        })
      : null;
    const existingDraft = existingDraftByMobileTripId ?? await findMatchingTripCompletionDraft(
      {
        journeyId: parsed.data.journeyId,
        tripMode,
        vehicleId: tripMode === "WALK" ? undefined : parsed.data.vehicleId,
        date: completedAt,
        startTime: startedAt,
        endTime: completedAt,
        startLocation: startLabel,
        endLocation: endLabel,
        businessKm,
        personalKm,
        notes,
      },
      {
        workspaceId: workspace.id,
        userId: user.id,
      },
    );

    if (existingDraft) {
      await appendDrivingLogGpsSamples(existingDraft.id, mapGpsSamples(parsed.data.samples), {
        workspaceId: workspace.id,
        userId: user.id,
      });

      revalidatePath("/dashboard/logs/driving");

      return NextResponse.json({
        draftLogId: existingDraft.id,
        editHref: `/dashboard/logs/driving/${existingDraft.id}/edit`,
        distanceKm,
      });
    }

    const startOdometer = tripMode === "WALK"
      ? 0
      : (parsed.data.startOdometer ?? await getStartOdometerForVehicle(workspace.id, parsed.data.vehicleId));
    const endOdometer = tripMode === "WALK"
      ? distanceKm
      : (parsed.data.endOdometer ?? startOdometer + distanceKm);

    const draftInput = tripMode === "WALK"
      ? {
          journeyId: parsed.data.journeyId,
          tripMode: "WALK" as const,
          vehicleId: undefined,
          date: completedAt,
          startTime: startedAt,
          endTime: completedAt,
          startLocation: startLabel,
          endLocation: endLabel,
          startFormattedAddress,
          endFormattedAddress,
          startOdometer,
          endOdometer,
          businessKm,
          personalKm,
          purpose: parsed.data.purpose,
          hasRouteSamples,
          notes,
        }
      : {
          journeyId: parsed.data.journeyId,
          tripMode,
          vehicleId: parsed.data.vehicleId,
          date: completedAt,
          startTime: startedAt,
          endTime: completedAt,
          startLocation: startLabel,
          endLocation: endLabel,
          startFormattedAddress,
          endFormattedAddress,
          startOdometer,
          endOdometer,
          businessKm,
          personalKm,
          purpose: parsed.data.purpose,
          hasRouteSamples,
          notes,
        };

    const draft = await createDrivingLogWithGpsSamples(
      draftInput,
      mapGpsSamples(parsed.data.samples),
      {
        workspaceId: workspace.id,
        userId: user.id,
      },
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/logs/driving");
    revalidatePath("/dashboard/Tours");

    return NextResponse.json({
      draftLogId: draft.id,
      editHref: `/dashboard/logs/driving/${draft.id}/edit`,
      distanceKm,
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

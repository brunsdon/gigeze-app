import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDrivingLogRoutePreview } from "@/features/driving-logs/service";
import { getCurrentUser, getCurrentWorkspaceForUser, getOrCreateCurrentUserFromSessionUser, getWorkspaceOwnerForUser } from "@/lib/auth/workspace";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function getRouteAuthContext(request: Request) {
  const bearerToken = getBearerToken(request);
  if (!bearerToken) {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const workspace = await getCurrentWorkspaceForUser(user.id);
    return workspace ? { user, workspace } : null;
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
  return workspace ? { user, workspace } : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ logId: string }> },
) {
  const authContext = await getRouteAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { logId } = await params;
  if (!logId) {
    return NextResponse.json({ error: "invalid-log-reference" }, { status: 400 });
  }

  const preview = await getDrivingLogRoutePreview(logId, authContext.workspace.id);
  if (!preview) {
    return NextResponse.json({ error: "driving-log-not-found" }, { status: 404 });
  }

  return NextResponse.json({
    id: preview.id,
    date: preview.date.toISOString(),
    startTime: preview.startTime?.toISOString() ?? null,
    endTime: preview.endTime?.toISOString() ?? null,
    startLocation: preview.startLocation,
    endLocation: preview.endLocation,
    startOdometer: preview.startOdometer,
    endOdometer: preview.endOdometer,
    businessKm: preview.businessKm,
    personalKm: preview.personalKm,
    computedDistanceKm: preview.computedDistanceKm,
    vehicle: preview.vehicle,
    Tour: preview.Tour,
    samples: preview.samples.map((sample) => ({
      id: sample.id,
      latitude: sample.latitude,
      longitude: sample.longitude,
      accuracyMeters: sample.accuracyMeters,
      recordedAt: sample.recordedAt.toISOString(),
    })),
  });
}

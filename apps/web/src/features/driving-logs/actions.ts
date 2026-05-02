"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { parseAppDateStart, parseAppDateTime } from "@/lib/datetime";
import { drivingLogCreateSchema } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils/app-error";
import { createDrivingLog, deleteDrivingLog, updateDrivingLog } from "@/features/driving-logs/service";

function parseFormDate(dateValue: FormDataEntryValue | null) {
  return parseAppDateStart(String(dateValue ?? "").trim());
}

function parseFormDateTime(dateValue: FormDataEntryValue | null, timeValue: FormDataEntryValue | null) {
  return parseAppDateTime(String(dateValue ?? "").trim(), String(timeValue ?? "").trim());
}

export async function createDrivingLogAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();
  const date = formData.get("date");

  const parsed = drivingLogCreateSchema.safeParse({
    journeyId: formData.get("journeyId") || undefined,
    tripMode: formData.get("tripMode") || undefined,
    vehicleId: formData.get("vehicleId") || undefined,
    date: parseFormDate(date),
    startTime: parseFormDateTime(date, formData.get("startTime")),
    endTime: parseFormDateTime(date, formData.get("endTime")),
    startLocation: formData.get("startLocation") || undefined,
    endLocation: formData.get("endLocation") || undefined,
    startLatitude: formData.get("startLatitude") || undefined,
    startLongitude: formData.get("startLongitude") || undefined,
    endLatitude: formData.get("endLatitude") || undefined,
    endLongitude: formData.get("endLongitude") || undefined,
    startPlaceId: formData.get("startPlaceId") || undefined,
    endPlaceId: formData.get("endPlaceId") || undefined,
    startFormattedAddress: formData.get("startFormattedAddress") || undefined,
    endFormattedAddress: formData.get("endFormattedAddress") || undefined,
    startOdometer: formData.get("startOdometer"),
    endOdometer: formData.get("endOdometer"),
    totalDistanceKm: formData.get("totalDistanceKm"),
    businessKm: formData.get("businessKm"),
    personalKm: formData.get("personalKm"),
    purpose: formData.get("purpose") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    redirect("/dashboard/logs/driving?error=driving-log-invalid-input");
  }

  try {
    await createDrivingLog(parsed.data, { workspaceId: workspace.id, userId: user.id });
  } catch (error) {
    redirect(`/dashboard/logs/driving?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/logs/driving");
  revalidatePath("/dashboard");
  redirect("/dashboard/logs/driving?success=driving-log-created");
}

export async function updateDrivingLogAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();
  const date = formData.get("date");

  const logId = String(formData.get("logId") ?? "").trim();
  if (!logId) {
    redirect("/dashboard/logs/driving?error=invalid-log-reference");
  }

  const parsed = drivingLogCreateSchema.safeParse({
    journeyId: formData.get("journeyId") || undefined,
    tripMode: formData.get("tripMode") || undefined,
    vehicleId: formData.get("vehicleId") || undefined,
    date: parseFormDate(date),
    startTime: parseFormDateTime(date, formData.get("startTime")),
    endTime: parseFormDateTime(date, formData.get("endTime")),
    startLocation: formData.get("startLocation") || undefined,
    endLocation: formData.get("endLocation") || undefined,
    startLatitude: formData.get("startLatitude") || undefined,
    startLongitude: formData.get("startLongitude") || undefined,
    endLatitude: formData.get("endLatitude") || undefined,
    endLongitude: formData.get("endLongitude") || undefined,
    startPlaceId: formData.get("startPlaceId") || undefined,
    endPlaceId: formData.get("endPlaceId") || undefined,
    startFormattedAddress: formData.get("startFormattedAddress") || undefined,
    endFormattedAddress: formData.get("endFormattedAddress") || undefined,
    startOdometer: formData.get("startOdometer"),
    endOdometer: formData.get("endOdometer"),
    totalDistanceKm: formData.get("totalDistanceKm"),
    businessKm: formData.get("businessKm"),
    personalKm: formData.get("personalKm"),
    purpose: formData.get("purpose") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    redirect("/dashboard/logs/driving?error=driving-log-invalid-input");
  }

  try {
    await updateDrivingLog(logId, parsed.data, workspace.id);
  } catch (error) {
    redirect(`/dashboard/logs/driving?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/logs/driving");
  revalidatePath("/dashboard");
  redirect("/dashboard/logs/driving?success=driving-log-updated");
}

export async function deleteDrivingLogAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const logId = String(formData.get("logId") ?? "").trim();
  if (!logId) {
    redirect("/dashboard/logs/driving?error=invalid-log-reference");
  }

  try {
    await deleteDrivingLog(logId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/logs/driving?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/logs/driving");
  revalidatePath("/dashboard");
  redirect("/dashboard/logs/driving?success=driving-log-deleted");
}

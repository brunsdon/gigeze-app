"use server"

import { revalidatePath } from "next/cache"
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace"
import { currentDateInputValue as getCurrentDateInputValue } from "@/lib/datetime"
import {
  activityNoteCreateSchema,
  drivingLogCreateSchema,
  stopCreateSchema,
} from "@/lib/validation"
import { getErrorMessage } from "@/lib/utils/app-error"
import { parseVisibility } from "@/lib/visibility"
import { createDrivingLog } from "@/features/driving-logs/service"
import { createStop } from "@/features/gigs/service"
import { createActivityNote } from "@/features/activity-notes/service"

export type QuickEntryActionResult =
  | { ok: true; successCode: string }
  | { ok: false; errorCode: string }

function fail(errorCode: string): QuickEntryActionResult {
  return { ok: false, errorCode }
}

function success(successCode: string): QuickEntryActionResult {
  return { ok: true, successCode }
}

function currentDateInputValue() {
  return getCurrentDateInputValue()
}

export async function createQuickStopAction(formData: FormData): Promise<QuickEntryActionResult> {
  const user = await requireAuthenticatedUser()
  const workspace = await requireWorkspaceOwner()

  const parsed = stopCreateSchema.safeParse({
    journeyId: String(formData.get("journeyId") ?? "").trim(),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
    locationName: formData.get("locationName") || undefined,
    arrivalDate: formData.get("arrivalDate") || undefined,
    departureDate: formData.get("departureDate") || undefined,
    visibility: parseVisibility(formData.get("visibility") ?? workspace.defaultJourneyVisibility),
    orderIndex: 1,
  })

  if (!parsed.success) {
    return fail("Gig-invalid-input")
  }

  try {
    await createStop(parsed.data, { workspaceId: workspace.id, userId: user.id })
  } catch (error) {
    return fail(getErrorMessage(error))
  }

  revalidatePath(`/dashboard/tours/${parsed.data.journeyId}`)
  revalidatePath("/dashboard/tours")
  revalidatePath("/dashboard")

  return success("Gig-created")
}

export async function createQuickDrivingLogAction(formData: FormData): Promise<QuickEntryActionResult> {
  const user = await requireAuthenticatedUser()
  const workspace = await requireWorkspaceOwner()

  const parsed = drivingLogCreateSchema.safeParse({
    journeyId: String(formData.get("journeyId") ?? "").trim() || undefined,
    vehicleId: String(formData.get("vehicleId") ?? "").trim() || undefined,
    date: String(formData.get("date") ?? "").trim() || currentDateInputValue(),
    startLocation: formData.get("startLocation") || undefined,
    endLocation: formData.get("endLocation") || undefined,
    startOdometer: formData.get("startOdometer"),
    endOdometer: formData.get("endOdometer"),
    businessKm: String(formData.get("businessKm") ?? "").trim() || "0",
    personalKm: String(formData.get("personalKm") ?? "").trim() || "0",
    notes: formData.get("notes") || undefined,
  })

  if (!parsed.success) {
    return fail("driving-log-invalid-input")
  }

  try {
    await createDrivingLog(parsed.data, { workspaceId: workspace.id, userId: user.id })
  } catch (error) {
    return fail(getErrorMessage(error))
  }

  revalidatePath("/dashboard/logs/driving")
  revalidatePath("/dashboard")

  return success("driving-log-created")
}

export async function createQuickActivityNoteAction(formData: FormData): Promise<QuickEntryActionResult> {
  const user = await requireAuthenticatedUser()
  const workspace = await requireWorkspaceOwner()

  const parsed = activityNoteCreateSchema.safeParse({
    journeyId: String(formData.get("journeyId") ?? "").trim(),
    stopId: String(formData.get("stopId") ?? "").trim() || undefined,
    type: formData.get("type"),
    date: String(formData.get("date") ?? "").trim() || currentDateInputValue(),
    durationMinutes: formData.get("durationMinutes") || undefined,
    location: formData.get("location") || undefined,
    notes: formData.get("notes") || undefined,
    visibility: parseVisibility(formData.get("visibility") ?? workspace.defaultJourneyVisibility),
  })

  if (!parsed.success) {
    return fail("activity-note-invalid-input")
  }

  try {
    await createActivityNote(parsed.data, { workspaceId: workspace.id, userId: user.id })
  } catch (error) {
    return fail(getErrorMessage(error))
  }

  revalidatePath("/dashboard/activity")
  revalidatePath("/dashboard")

  return success("activity-note-created")
}

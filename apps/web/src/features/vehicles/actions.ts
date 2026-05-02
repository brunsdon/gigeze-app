"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { vehicleCreateSchema } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils/app-error";
import { createVehicle, deleteVehicle, updateVehicle } from "@/features/vehicles/service";

export async function createVehicleAction(formData: FormData) {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();

  const parsed = vehicleCreateSchema.safeParse({
    name: formData.get("name"),
    registration: formData.get("registration") || undefined,
    fuelType: formData.get("fuelType") || undefined,
    notes: formData.get("notes") || undefined,
    startingOdometer: formData.get("startingOdometer"),
    vehicleMode: formData.get("vehicleMode") || undefined,
    enableBusinessSplit: formData.get("enableBusinessSplit") === "on",
    defaultUse: formData.get("defaultUse") || undefined,
    isDefault: formData.get("isDefault") === "on",
  });

  if (!parsed.success) {
    redirect("/dashboard/vehicles?error=vehicle-invalid-input");
  }

  try {
    await createVehicle(parsed.data, workspace.id, user.id);
  } catch (error) {
    redirect(`/dashboard/vehicles?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/logs/driving");
  revalidatePath("/dashboard");
  redirect("/dashboard/vehicles?success=vehicle-created");
}

export async function updateVehicleAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  if (!vehicleId) {
    redirect("/dashboard/vehicles?error=invalid-vehicle-reference");
  }

  const parsed = vehicleCreateSchema.safeParse({
    name: formData.get("name"),
    registration: formData.get("registration") || undefined,
    fuelType: formData.get("fuelType") || undefined,
    notes: formData.get("notes") || undefined,
    startingOdometer: formData.get("startingOdometer"),
    vehicleMode: formData.get("vehicleMode") || undefined,
    enableBusinessSplit: formData.get("enableBusinessSplit") === "on",
    defaultUse: formData.get("defaultUse") || undefined,
    isDefault: formData.get("isDefault") === "on",
  });

  if (!parsed.success) {
    redirect(`/dashboard/vehicles/${vehicleId}/edit?error=vehicle-invalid-input`);
  }

  try {
    await updateVehicle(vehicleId, parsed.data, workspace.id);
  } catch (error) {
    redirect(`/dashboard/vehicles/${vehicleId}/edit?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/logs/driving");
  revalidatePath("/dashboard");
  redirect("/dashboard/vehicles?success=vehicle-updated");
}

export async function deleteVehicleAction(formData: FormData) {
  const workspace = await requireWorkspaceOwner();

  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  if (!vehicleId) {
    redirect("/dashboard/vehicles?error=invalid-vehicle-reference");
  }

  try {
    await deleteVehicle(vehicleId, workspace.id);
  } catch (error) {
    redirect(`/dashboard/vehicles?error=${encodeURIComponent(getErrorMessage(error))}`);
  }

  revalidatePath("/dashboard/vehicles");
  revalidatePath("/dashboard/logs/driving");
  revalidatePath("/dashboard");
  redirect("/dashboard/vehicles?success=vehicle-deleted");
}

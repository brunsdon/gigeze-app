import { type VehicleMode } from "@gigeze/shared";
import { getNormalizedWebApiBaseUrl } from "./sync-client";
import type { MobileJourneyOption, MobileVehicleOption, VehicleDefaultUse } from "../trip-setup";

type VehicleOptionsResponse = {
  vehicles?: {
    id?: unknown;
    name?: unknown;
    vehicleMode?: unknown;
    enableBusinessSplit?: unknown;
    registration?: unknown;
    fuelType?: unknown;
    notes?: unknown;
    startingOdometer?: unknown;
    isDefault?: unknown;
    defaultUse?: unknown;
    latestOdometer?: unknown;
  }[];
};

type VehicleMutationResponse = {
  vehicle?: NonNullable<VehicleOptionsResponse["vehicles"]>[number];
  vehicleId?: unknown;
  deleted?: unknown;
  error?: unknown;
};

export type MobileVehicleInput = {
  name: string;
  vehicleMode: VehicleMode;
  enableBusinessSplit: boolean;
  registration?: string;
  fuelType?: string;
  notes?: string;
  startingOdometer: number;
  defaultUse: VehicleDefaultUse;
  isDefault: boolean;
};

type JourneyOptionsResponse = {
  Tours?: {
    id?: unknown;
    title?: unknown;
    description?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    status?: unknown;
    visibility?: unknown;
    coverImageUrl?: unknown;
  }[];
};

type JourneyMutationResponse = {
  Tour?: NonNullable<JourneyOptionsResponse["Tours"]>[number];
  journeyId?: unknown;
  deleted?: unknown;
  error?: unknown;
};

export type MobileJourneyInput = {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  visibility: "PRIVATE" | "SHARED" | "PUBLIC";
  coverImageUrl?: string;
};

function normalizeDefaultUse(value: unknown): VehicleDefaultUse {
  return value === "BUSINESS" ? "BUSINESS" : "PERSONAL";
}

function normalizeVehicleMode(value: unknown): VehicleMode {
  return value === "RIDE" ? "RIDE" : "DRIVE";
}

function normalizeVehicleOption(value: NonNullable<VehicleOptionsResponse["vehicles"]>[number]): MobileVehicleOption | null {
  if (typeof value.id !== "string" || typeof value.name !== "string") {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    vehicleMode: normalizeVehicleMode(value.vehicleMode),
    enableBusinessSplit: value.enableBusinessSplit !== false,
    registration: typeof value.registration === "string" ? value.registration : null,
    fuelType: typeof value.fuelType === "string" ? value.fuelType : null,
    notes: typeof value.notes === "string" ? value.notes : null,
    startingOdometer: typeof value.startingOdometer === "number" && Number.isFinite(value.startingOdometer) ? value.startingOdometer : null,
    isDefault: value.isDefault === true,
    defaultUse: normalizeDefaultUse(value.defaultUse),
    latestOdometer: typeof value.latestOdometer === "number" && Number.isFinite(value.latestOdometer) ? value.latestOdometer : null,
  };
}

function normalizeJourneyOption(value: NonNullable<JourneyOptionsResponse["Tours"]>[number]): MobileJourneyOption | null {
  if (typeof value.id !== "string" || typeof value.title !== "string") {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    description: typeof value.description === "string" ? value.description : null,
    startDate: typeof value.startDate === "string" ? value.startDate : null,
    endDate: typeof value.endDate === "string" ? value.endDate : null,
    status: typeof value.status === "string" ? value.status : undefined,
    visibility: typeof value.visibility === "string" ? value.visibility : undefined,
    coverImageUrl: typeof value.coverImageUrl === "string" ? value.coverImageUrl : null,
  };
}

function getSetupOptionsErrorMessage(label: "Vehicle" | "Tour", status?: number) {
  if (status === 401 || status === 403) {
    return "Your sign-in needs refreshing before setup options can load. You can still start a trip without selecting one.";
  }

  if (status === 404) {
    return `${label} options are unavailable from the website right now. You can still start a trip without selecting one.`;
  }

  if (typeof status === "number") {
    return `The website could not load ${label.toLowerCase()} options right now. You can still start a trip without selecting one.`;
  }

  return `The website is unavailable right now, so ${label.toLowerCase()} options could not load. You can still start a trip without selecting one.`;
}

async function fetchSetupOptions(url: string, accessToken: string, label: "Vehicle" | "Tour") {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(getSetupOptionsErrorMessage(label, response.status));
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes("You can still start a trip")) {
      throw error;
    }

    throw new Error(getSetupOptionsErrorMessage(label));
  }
}

export async function fetchMobileVehicleOptions(accessToken: string): Promise<MobileVehicleOption[]> {
  if (!accessToken.trim()) {
    return [];
  }

  const response = await fetchSetupOptions(`${getNormalizedWebApiBaseUrl()}/api/mobile/vehicles`, accessToken, "Vehicle");

  const body = (await response.json().catch(() => null)) as VehicleOptionsResponse | null;
  if (!body || !Array.isArray(body.vehicles)) {
    return [];
  }

  return body.vehicles
    .map((vehicle) => normalizeVehicleOption(vehicle))
    .filter((vehicle): vehicle is MobileVehicleOption => Boolean(vehicle));
}

function getVehicleMutationErrorMessage(status?: number) {
  if (status === 401 || status === 403) {
    return "Your sign-in needs refreshing before vehicles can be saved.";
  }

  if (status === 400) {
    return "Check the vehicle details and try again.";
  }

  if (typeof status === "number") {
    return "The website could not save this vehicle right now. Try again shortly.";
  }

  return "The website is unavailable right now, so this vehicle could not be saved.";
}

async function sendVehicleMutation(
  url: string,
  accessToken: string,
  method: "POST" | "PUT",
  input: MobileVehicleInput,
): Promise<MobileVehicleOption> {
  if (!accessToken.trim()) {
    throw new Error("Signed-in session is not available for vehicle changes. Sign in again, then retry.");
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const body = (await response.json().catch(() => null)) as VehicleMutationResponse | null;

    if (!response.ok) {
      throw new Error(typeof body?.error === "string" ? body.error : getVehicleMutationErrorMessage(response.status));
    }

    const vehicle = body?.vehicle ? normalizeVehicleOption(body.vehicle) : null;
    if (!vehicle) {
      throw new Error("Vehicle save returned an unexpected response.");
    }

    return vehicle;
  } catch (error) {
    if (error instanceof Error && !error.message.includes("Network request failed")) {
      throw error;
    }

    throw new Error(getVehicleMutationErrorMessage());
  }
}

export async function createMobileVehicle(accessToken: string, input: MobileVehicleInput): Promise<MobileVehicleOption> {
  return sendVehicleMutation(`${getNormalizedWebApiBaseUrl()}/api/mobile/vehicles`, accessToken, "POST", input);
}

export async function updateMobileVehicle(accessToken: string, vehicleId: string, input: MobileVehicleInput): Promise<MobileVehicleOption> {
  return sendVehicleMutation(`${getNormalizedWebApiBaseUrl()}/api/mobile/vehicles/${encodeURIComponent(vehicleId)}`, accessToken, "PUT", input);
}

export async function deleteMobileVehicle(accessToken: string, vehicleId: string): Promise<void> {
  if (!accessToken.trim()) {
    throw new Error("Signed-in session is not available for vehicle changes. Sign in again, then retry.");
  }

  try {
    const response = await fetch(`${getNormalizedWebApiBaseUrl()}/api/mobile/vehicles/${encodeURIComponent(vehicleId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as VehicleMutationResponse | null;
      throw new Error(typeof body?.error === "string" ? body.error : getVehicleMutationErrorMessage(response.status));
    }
  } catch (error) {
    if (error instanceof Error && !error.message.includes("Network request failed")) {
      throw error;
    }

    throw new Error("The website is unavailable right now, so this vehicle could not be deleted.");
  }
}

export async function fetchMobileJourneyOptions(accessToken: string): Promise<MobileJourneyOption[]> {
  if (!accessToken.trim()) {
    return [];
  }

  const response = await fetchSetupOptions(`${getNormalizedWebApiBaseUrl()}/api/mobile/tours`, accessToken, "Tour");

  const body = (await response.json().catch(() => null)) as JourneyOptionsResponse | null;
  if (!body || !Array.isArray(body.Tours)) {
    return [];
  }

  return body.Tours
    .map((Tour) => normalizeJourneyOption(Tour))
    .filter((Tour): Tour is MobileJourneyOption => Boolean(Tour));
}

function getJourneyMutationErrorMessage(status?: number) {
  if (status === 401 || status === 403) {
    return "Your sign-in needs refreshing before Tours can be saved.";
  }

  if (status === 400) {
    return "Check the Tour details and try again. Tours linked to trips cannot be deleted from mobile.";
  }

  if (typeof status === "number") {
    return "The website could not save this Tour right now. Try again shortly.";
  }

  return "The website is unavailable right now, so this Tour could not be saved.";
}

function getJourneyApiErrorMessage(error: unknown, status?: number) {
  if (error === "Tour-has-dependent-records" || error === "JOURNEY_HAS_DEPENDENCIES") {
    return "This Tour is already linked to trips or media, so it cannot be deleted.";
  }

  return typeof error === "string" ? error : getJourneyMutationErrorMessage(status);
}

async function sendJourneyMutation(
  url: string,
  accessToken: string,
  method: "POST" | "PUT",
  input: MobileJourneyInput,
): Promise<MobileJourneyOption> {
  if (!accessToken.trim()) {
    throw new Error("Signed-in session is not available for Tour changes. Sign in again, then retry.");
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    const body = (await response.json().catch(() => null)) as JourneyMutationResponse | null;

    if (!response.ok) {
      throw new Error(getJourneyApiErrorMessage(body?.error, response.status));
    }

    const Tour = body?.Tour ? normalizeJourneyOption(body.Tour) : null;
    if (!Tour) {
      throw new Error("Tour save returned an unexpected response.");
    }

    return Tour;
  } catch (error) {
    if (error instanceof Error && !error.message.includes("Network request failed")) {
      throw error;
    }

    throw new Error(getJourneyMutationErrorMessage());
  }
}

export async function createMobileJourney(accessToken: string, input: MobileJourneyInput): Promise<MobileJourneyOption> {
  return sendJourneyMutation(`${getNormalizedWebApiBaseUrl()}/api/mobile/tours`, accessToken, "POST", input);
}

export async function updateMobileJourney(accessToken: string, journeyId: string, input: MobileJourneyInput): Promise<MobileJourneyOption> {
  return sendJourneyMutation(`${getNormalizedWebApiBaseUrl()}/api/mobile/tours/${encodeURIComponent(journeyId)}`, accessToken, "PUT", input);
}

export async function deleteMobileJourney(accessToken: string, journeyId: string): Promise<void> {
  if (!accessToken.trim()) {
    throw new Error("Signed-in session is not available for Tour changes. Sign in again, then retry.");
  }

  try {
    const response = await fetch(`${getNormalizedWebApiBaseUrl()}/api/mobile/tours/${encodeURIComponent(journeyId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as JourneyMutationResponse | null;
      throw new Error(getJourneyApiErrorMessage(body?.error, response.status));
    }
  } catch (error) {
    if (error instanceof Error && !error.message.includes("Network request failed")) {
      throw error;
    }

    throw new Error("The website is unavailable right now, so this Tour could not be deleted.");
  }
}

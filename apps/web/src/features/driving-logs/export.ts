import { formatDateInputValue, formatTimeInputValue } from "@/lib/datetime";

const GPS_EVIDENCE_NOTE = "GPS route evidence captured";
const TRIP_DRAFT_MARKER = "[Trip draft] Passive GPS session captured.";
const GENERIC_START_LOCATIONS = new Set(["gps trip start", "gps route recorded"]);
const GENERIC_END_LOCATIONS = new Set(["gps trip end", "gps route recorded"]);

type ExportVehicle = {
  name?: string | null;
  registration?: string | null;
} | null;

type ExportJourney = {
  title?: string | null;
} | null;

type ExportGpsSample = {
  id?: unknown;
  address?: string | null;
  displayAddress?: string | null;
  locationName?: string | null;
  reverseGeocodedAddress?: string | null;
};

export type DrivingLogExportRowSource = {
  date: Date;
  startTime?: Date | null;
  endTime?: Date | null;
  startLocation?: string | null;
  endLocation?: string | null;
  startFormattedAddress?: string | null;
  endFormattedAddress?: string | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
  businessKm?: number | null;
  personalKm?: number | null;
  purpose?: string | null;
  notes?: string | null;
  hasRouteSamples?: boolean | null;
  vehicle?: ExportVehicle;
  Tour?: ExportJourney;
  gpsSamples?: ExportGpsSample[] | null;
};

export type DrivingLogExportSummary = {
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  tripsInRange: number;
  totalDistance: number;
  businessKm: number;
  personalKm: number;
  businessUsePercentage: number;
  vehiclesIncluded: string[];
  gpsEvidenceCount: number;
  missingLocationsCount: number;
  missingPurposeCount: number;
  missingOdometerCount: number;
  missingSplitCount: number;
  isUnderTwelveWeeks: boolean;
};

export type DrivingLogExportSummaryOptions = {
  periodStart?: Date;
  periodEnd?: Date;
  generatedAt?: Date;
  workspaceName?: string | null;
};

export const drivingLogExportHeader = [
  "Date",
  "Start Time",
  "End Time",
  "Vehicle",
  "Registration",
  "Tour",
  "Start Location",
  "End Location",
  "Start Odometer",
  "End Odometer",
  "Distance Travelled",
  "Business KM",
  "Personal KM",
  "Use Type",
  "Purpose",
  "Notes",
] as const;

function isPresent(value?: string | null) {
  return Boolean(value?.trim());
}

function normalizeLocation(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function isGenericDrivingLogLocation(value: string | null | undefined, endpoint: "start" | "end") {
  const normalized = normalizeLocation(value);
  if (!normalized) {
    return false;
  }

  return endpoint === "start" ? GENERIC_START_LOCATIONS.has(normalized) : GENERIC_END_LOCATIONS.has(normalized);
}

export function isMeaningfulDrivingLogLocation(value: string | null | undefined, endpoint: "start" | "end") {
  return isPresent(value) && !isGenericDrivingLogLocation(value, endpoint);
}

function getSampleDisplayAddress(sample?: ExportGpsSample) {
  return (
    sample?.displayAddress?.trim() ||
    sample?.reverseGeocodedAddress?.trim() ||
    sample?.address?.trim() ||
    sample?.locationName?.trim() ||
    ""
  );
}

export function getDrivingLogExportStartLocation(log: DrivingLogExportRowSource) {
  if (isMeaningfulDrivingLogLocation(log.startFormattedAddress, "start")) {
    return log.startFormattedAddress?.trim() ?? "";
  }

  if (isMeaningfulDrivingLogLocation(log.startLocation, "start")) {
    return log.startLocation?.trim() ?? "";
  }

  const sampleAddress = getSampleDisplayAddress(log.gpsSamples?.[0]);
  return sampleAddress || log.startLocation?.trim() || "";
}

export function getDrivingLogExportEndLocation(log: DrivingLogExportRowSource) {
  if (isMeaningfulDrivingLogLocation(log.endFormattedAddress, "end")) {
    return log.endFormattedAddress?.trim() ?? "";
  }

  if (isMeaningfulDrivingLogLocation(log.endLocation, "end")) {
    return log.endLocation?.trim() ?? "";
  }

  const sampleAddress = getSampleDisplayAddress(log.gpsSamples?.at(-1));
  return sampleAddress || log.endLocation?.trim() || "";
}

export function hasDrivingLogGpsEvidence(log: Pick<DrivingLogExportRowSource, "notes" | "gpsSamples" | "hasRouteSamples">) {
  return Boolean(log.hasRouteSamples) || Boolean(log.gpsSamples?.length) || Boolean(log.notes?.includes(TRIP_DRAFT_MARKER));
}

export function getDrivingLogUseType(log: Pick<DrivingLogExportRowSource, "businessKm" | "personalKm">) {
  const businessKm = log.businessKm ?? 0;
  const personalKm = log.personalKm ?? 0;

  if (businessKm > 0 && personalKm === 0) {
    return "Business";
  }

  if (personalKm > 0 && businessKm === 0) {
    return "Personal";
  }

  if (businessKm > 0 && personalKm > 0) {
    return "Mixed";
  }

  return "";
}

export function getDrivingLogExportDistance(log: Pick<DrivingLogExportRowSource, "startOdometer" | "endOdometer" | "businessKm" | "personalKm">) {
  const startOdometer = log.startOdometer ?? 0;
  const endOdometer = log.endOdometer ?? 0;
  const odometerDistance = Math.max(0, endOdometer - startOdometer);
  const splitDistance = Math.max(0, (log.businessKm ?? 0) + (log.personalKm ?? 0));

  return Math.max(odometerDistance, splitDistance);
}

export function cleanDrivingLogExportNotes(log: Pick<DrivingLogExportRowSource, "notes" | "gpsSamples" | "hasRouteSamples">) {
  const notes = log.notes?.trim() ?? "";
  const userNotes = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes(TRIP_DRAFT_MARKER))
    .join(" ");
  const exportNotes = [];

  if (userNotes) {
    exportNotes.push(userNotes);
  }

  if (hasDrivingLogGpsEvidence(log)) {
    exportNotes.push(GPS_EVIDENCE_NOTE);
  }

  return exportNotes.join("; ");
}

export function getDrivingLogExportPurpose(log: DrivingLogExportRowSource) {
  return log.purpose?.trim() || log.Tour?.title?.trim() || "";
}

export function hasMissingDrivingLogLocation(log: DrivingLogExportRowSource) {
  return (
    !isMeaningfulDrivingLogLocation(log.startFormattedAddress || log.startLocation, "start") ||
    !isMeaningfulDrivingLogLocation(log.endFormattedAddress || log.endLocation, "end")
  );
}

export function hasMissingDrivingLogPurpose(log: DrivingLogExportRowSource) {
  return !isPresent(log.purpose);
}

export function hasMissingDrivingLogOdometer(log: DrivingLogExportRowSource) {
  return typeof log.startOdometer !== "number" || typeof log.endOdometer !== "number" || log.endOdometer <= log.startOdometer;
}

export function hasMissingDrivingLogSplit(log: DrivingLogExportRowSource) {
  return (log.businessKm ?? 0) <= 0 && (log.personalKm ?? 0) <= 0;
}

export function buildDrivingLogExportRow(log: DrivingLogExportRowSource) {
  return [
    formatDateInputValue(log.date),
    formatTimeInputValue(log.startTime),
    formatTimeInputValue(log.endTime),
    log.vehicle?.name ?? "",
    log.vehicle?.registration ?? "",
    log.Tour?.title ?? "",
    getDrivingLogExportStartLocation(log),
    getDrivingLogExportEndLocation(log),
    log.startOdometer ?? "",
    log.endOdometer ?? "",
    getDrivingLogExportDistance(log),
    log.businessKm ?? "",
    log.personalKm ?? "",
    getDrivingLogUseType(log),
    getDrivingLogExportPurpose(log),
    cleanDrivingLogExportNotes(log),
  ];
}

function getPeriodBoundary(logs: DrivingLogExportRowSource[], field: "first" | "last", explicitDate?: Date) {
  if (explicitDate) {
    return explicitDate;
  }

  const sortedDates = logs
    .map((log) => log.date)
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  return field === "first" ? sortedDates[0] : sortedDates.at(-1);
}

function getInclusivePeriodDays(periodStart?: Date, periodEnd?: Date) {
  if (!periodStart || !periodEnd) {
    return 0;
  }

  const [startYear, startMonth, startDay] = formatDateInputValue(periodStart).split("-").map(Number);
  const [endYear, endMonth, endDay] = formatDateInputValue(periodEnd).split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);

  if (end < start) {
    return 0;
  }

  return Math.floor((end - start) / 86400000) + 1;
}

function getVehicleExportLabel(vehicle?: ExportVehicle) {
  const name = vehicle?.name?.trim();
  const registration = vehicle?.registration?.trim();

  if (name && registration) {
    return `${name} (${registration})`;
  }

  return name || registration || "";
}

export function getDrivingLogExportSummary(
  logs: DrivingLogExportRowSource[],
  options: DrivingLogExportSummaryOptions = {},
): DrivingLogExportSummary {
  const periodStartDate = getPeriodBoundary(logs, "first", options.periodStart);
  const periodEndDate = getPeriodBoundary(logs, "last", options.periodEnd);
  const totalDays = getInclusivePeriodDays(periodStartDate, periodEndDate);
  const totalDistance = logs.reduce((sum, log) => sum + getDrivingLogExportDistance(log), 0);
  const businessKm = logs.reduce((sum, log) => sum + (log.businessKm ?? 0), 0);
  const personalKm = logs.reduce((sum, log) => sum + (log.personalKm ?? 0), 0);
  const businessUsePercentage = totalDistance > 0 ? Math.round((businessKm / totalDistance) * 1000) / 10 : 0;
  const vehiclesIncluded = Array.from(
    new Set(logs.map((log) => getVehicleExportLabel(log.vehicle)).filter((label) => label.length > 0)),
  );

  return {
    periodStart: periodStartDate ? formatDateInputValue(periodStartDate) : "",
    periodEnd: periodEndDate ? formatDateInputValue(periodEndDate) : "",
    totalDays,
    tripsInRange: logs.length,
    totalDistance,
    businessKm,
    personalKm,
    businessUsePercentage,
    vehiclesIncluded,
    gpsEvidenceCount: logs.filter(hasDrivingLogGpsEvidence).length,
    missingLocationsCount: logs.filter(hasMissingDrivingLogLocation).length,
    missingPurposeCount: logs.filter(hasMissingDrivingLogPurpose).length,
    missingOdometerCount: logs.filter(hasMissingDrivingLogOdometer).length,
    missingSplitCount: logs.filter(hasMissingDrivingLogSplit).length,
    isUnderTwelveWeeks: totalDays > 0 && totalDays < 84,
  };
}

export function buildDrivingLogExportSummaryRows(
  logs: DrivingLogExportRowSource[],
  options: DrivingLogExportSummaryOptions = {},
) {
  const summary = getDrivingLogExportSummary(logs, options);
  const generatedAt = options.generatedAt ?? new Date();

  return [
    ["ATO-style driving log period summary"],
    ["Generated", `${formatDateInputValue(generatedAt)} ${formatTimeInputValue(generatedAt)}`],
    ["Workspace", options.workspaceName ?? ""],
    ["Period start", summary.periodStart],
    ["Period end", summary.periodEnd],
    ["Total days", summary.totalDays],
    ["Total trips", summary.tripsInRange],
    ["Total km", summary.totalDistance],
    ["Business km", summary.businessKm],
    ["Personal km", summary.personalKm],
    ["Business use %", summary.businessUsePercentage.toFixed(1)],
    ["Vehicles included", summary.vehiclesIncluded.join("; ")],
    ["Missing purpose count", summary.missingPurposeCount],
    ["Missing location count", summary.missingLocationsCount],
    ["Missing odometer count", summary.missingOdometerCount],
    ["GPS evidence count", summary.gpsEvidenceCount],
    summary.isUnderTwelveWeeks
      ? [
          "Period note",
          "ATO logbooks are commonly based on a continuous 12-week representative period. Confirm your record-keeping requirements with your accountant.",
        ]
      : ["Period note", ""],
    [],
    ["Driving log detail rows"],
  ];
}

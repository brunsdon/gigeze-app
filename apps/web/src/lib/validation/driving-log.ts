import { z } from "zod";
import { tripModes } from "@gigeze/shared";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().min(min).max(max).optional(),
  );

export const drivingLogCreateSchema = z
  .object({
    journeyId: z.string().optional(),
    tripMode: z.enum(tripModes).default("DRIVE"),
    vehicleId: z.string().optional(),
    date: z.coerce.date(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    startLocation: optionalText(200),
    endLocation: optionalText(200),
    startLatitude: optionalCoordinate(-90, 90),
    startLongitude: optionalCoordinate(-180, 180),
    endLatitude: optionalCoordinate(-90, 90),
    endLongitude: optionalCoordinate(-180, 180),
    startPlaceId: optionalText(300),
    endPlaceId: optionalText(300),
    startFormattedAddress: optionalText(500),
    endFormattedAddress: optionalText(500),
    totalDistanceKm: z.coerce.number().int().nonnegative().optional(),
    startOdometer: z.coerce.number().int().nonnegative().optional(),
    endOdometer: z.coerce.number().int().nonnegative().optional(),
    businessKm: z.coerce.number().int().nonnegative().optional(),
    personalKm: z.coerce.number().int().nonnegative().optional(),
    purpose: z.string().trim().max(200).optional(),
    hasRouteSamples: z.coerce.boolean().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    const businessKm = value.businessKm ?? 0;
    const personalKm = value.personalKm ?? 0;

    if (value.tripMode === "WALK") {
      if (value.totalDistanceKm === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Total distance is required for walk trips",
          path: ["totalDistanceKm"],
        });
      }
    } else {
      if (value.startOdometer === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Start odometer is required",
          path: ["startOdometer"],
        });
      }

      if (value.endOdometer === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "End odometer is required",
          path: ["endOdometer"],
        });
      }

      if (value.startOdometer !== undefined && value.endOdometer !== undefined) {
        if (value.endOdometer < value.startOdometer) {
          ctx.addIssue({
            code: "custom",
            message: "End odometer must be greater than or equal to start odometer",
            path: ["endOdometer"],
          });
        }

        const totalDistance = value.endOdometer - value.startOdometer;
        const hasExplicitSplit = value.businessKm !== undefined || value.personalKm !== undefined;
        if (hasExplicitSplit && businessKm + personalKm !== totalDistance) {
          ctx.addIssue({
            code: "custom",
            message: "Business and personal km must equal total distance",
            path: ["businessKm"],
          });
        }
      }
    }

    if (!value.startTime || !value.endTime) {
      return;
    }

    if (value.endTime.getTime() < value.startTime.getTime()) {
      ctx.addIssue({
        code: "custom",
        message: "End time must be later than start time",
        path: ["endTime"],
      });
    }
  })
  .transform((value) => {
    if (value.tripMode === "WALK") {
      const totalDistanceKm = value.totalDistanceKm ?? value.businessKm ?? value.personalKm ?? 0;

      return {
        journeyId: value.journeyId,
        tripMode: value.tripMode,
        vehicleId: undefined,
        date: value.date,
        startTime: value.startTime,
        endTime: value.endTime,
        startLocation: value.startFormattedAddress ?? value.startLocation,
        endLocation: value.endFormattedAddress ?? value.endLocation,
        ...(value.startLatitude !== undefined ? { startLatitude: value.startLatitude } : {}),
        ...(value.startLongitude !== undefined ? { startLongitude: value.startLongitude } : {}),
        ...(value.endLatitude !== undefined ? { endLatitude: value.endLatitude } : {}),
        ...(value.endLongitude !== undefined ? { endLongitude: value.endLongitude } : {}),
        ...(value.startPlaceId !== undefined ? { startPlaceId: value.startPlaceId } : {}),
        ...(value.endPlaceId !== undefined ? { endPlaceId: value.endPlaceId } : {}),
        ...(value.startFormattedAddress !== undefined ? { startFormattedAddress: value.startFormattedAddress } : {}),
        ...(value.endFormattedAddress !== undefined ? { endFormattedAddress: value.endFormattedAddress } : {}),
        startOdometer: 0,
        endOdometer: totalDistanceKm,
        businessKm: 0,
        personalKm: totalDistanceKm,
        purpose: value.purpose,
        ...(value.hasRouteSamples !== undefined ? { hasRouteSamples: value.hasRouteSamples } : {}),
        notes: value.notes,
      };
    }

    const totalDistanceKm = Math.max(0, (value.endOdometer ?? 0) - (value.startOdometer ?? 0));
    const businessKm = value.businessKm ?? 0;
    const personalKm = value.personalKm ?? totalDistanceKm - businessKm;

    return {
      journeyId: value.journeyId,
      tripMode: value.tripMode,
      vehicleId: value.vehicleId,
      date: value.date,
      startTime: value.startTime,
      endTime: value.endTime,
      startLocation: value.startFormattedAddress ?? value.startLocation,
      endLocation: value.endFormattedAddress ?? value.endLocation,
      ...(value.startLatitude !== undefined ? { startLatitude: value.startLatitude } : {}),
      ...(value.startLongitude !== undefined ? { startLongitude: value.startLongitude } : {}),
      ...(value.endLatitude !== undefined ? { endLatitude: value.endLatitude } : {}),
      ...(value.endLongitude !== undefined ? { endLongitude: value.endLongitude } : {}),
      ...(value.startPlaceId !== undefined ? { startPlaceId: value.startPlaceId } : {}),
      ...(value.endPlaceId !== undefined ? { endPlaceId: value.endPlaceId } : {}),
      ...(value.startFormattedAddress !== undefined ? { startFormattedAddress: value.startFormattedAddress } : {}),
      ...(value.endFormattedAddress !== undefined ? { endFormattedAddress: value.endFormattedAddress } : {}),
      startOdometer: value.startOdometer ?? 0,
      endOdometer: value.endOdometer ?? 0,
      businessKm,
      personalKm,
      purpose: value.purpose,
      ...(value.hasRouteSamples !== undefined ? { hasRouteSamples: value.hasRouteSamples } : {}),
      notes: value.notes,
    };
  });

export type DrivingLogCreateInput = z.infer<typeof drivingLogCreateSchema>;

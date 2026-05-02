import { describe, expect, it } from "vitest";
import {
  applyTripModeToTripSetup,
  applyVehicleToTripSetup,
  businessUseOptionLabel,
  businessUseSectionLabel,
  applyJourneyToTripSetup,
  createTripSetupState,
  filterVehicleOptionsForTripMode,
  getBestVehicleOptionForTripMode,
  getVehicleEmptyStateMessage,
  getTripPurposeFromVehicleDefault,
  personalUseOptionLabel,
  parseOdometerInput,
  sanitizeWholeNumberInput,
  syncTripSetupVehicleSelection,
  type MobileVehicleOption,
} from "./trip-setup";

function createVehicle(overrides: Partial<MobileVehicleOption> = {}): MobileVehicleOption {
  return {
    id: "vehicle-1",
    name: "Tour Van",
    vehicleMode: "DRIVE",
    enableBusinessSplit: true,
    isDefault: false,
    defaultUse: "PERSONAL",
    latestOdometer: 12000,
    ...overrides,
  };
}

describe("trip setup defaults", () => {
  it("maps web vehicle default use to mobile trip purpose labels", () => {
    expect(getTripPurposeFromVehicleDefault("PERSONAL")).toBe("PRIVATE");
    expect(getTripPurposeFromVehicleDefault("BUSINESS")).toBe("BUSINESS");
    expect(getTripPurposeFromVehicleDefault(undefined)).toBe("PRIVATE");
  });

  it("uses the Business use wording labels for split controls", () => {
    expect(businessUseSectionLabel).toBe("Business use");
    expect(personalUseOptionLabel).toBe("Personal");
    expect(businessUseOptionLabel).toBe("Business");
  });

  it("uses the default vehicle to initialize purpose and odometer", () => {
    const setup = createTripSetupState([
      createVehicle({ id: "vehicle-1", name: "Van", latestOdometer: 100 }),
      createVehicle({ id: "vehicle-2", name: "Work Truck", isDefault: true, defaultUse: "BUSINESS", latestOdometer: 900 }),
    ]);

    expect(setup).toMatchObject({
      tripMode: "DRIVE",
      vehicleId: "vehicle-2",
      vehicleName: "Work Truck",
      businessSplitEnabled: true,
      tripPurpose: "BUSINESS",
      startOdometer: 900,
    });
  });

  it("allows purpose override before trip start", () => {
    const setup = applyVehicleToTripSetup(
      {
        ...createTripSetupState(),
        tripPurpose: "PRIVATE",
        purposeEdited: true,
      },
      createVehicle({ defaultUse: "BUSINESS" }),
    );

    expect(setup.tripPurpose).toBe("PRIVATE");
  });

  it("does not overwrite a manually edited odometer when vehicle changes", () => {
    const setup = applyVehicleToTripSetup(
      {
        ...createTripSetupState(),
        startOdometer: 123,
        odometerEdited: true,
      },
      createVehicle({ latestOdometer: 999 }),
    );

    expect(setup.startOdometer).toBe(123);
  });

  it("stores an optional selected Tour in setup state", () => {
    const setup = applyJourneyToTripSetup(createTripSetupState(), {
      id: "Tour-1",
      title: "NSW Coast Run",
      status: "ACTIVE",
    });

    expect(setup).toMatchObject({
      journeyId: "Tour-1",
      journeyTitle: "NSW Coast Run",
    });
    expect(applyJourneyToTripSetup(setup, undefined)).toMatchObject({
      journeyId: undefined,
      journeyTitle: undefined,
    });
  });

  it("clears vehicle and odometer when switching to walk mode", () => {
    const setup = applyTripModeToTripSetup({
      ...createTripSetupState([createVehicle({ id: "vehicle-2", name: "Van", latestOdometer: 900 })]),
      vehicleId: "vehicle-2",
      vehicleName: "Van",
      startOdometer: 900,
      odometerEdited: true,
    }, "WALK");

    expect(setup).toMatchObject({
      tripMode: "WALK",
      vehicleId: undefined,
      vehicleName: undefined,
      businessSplitEnabled: false,
      startOdometer: undefined,
      odometerEdited: false,
    });
  });

  it("restores a default vehicle when switching back to ride or drive", () => {
    const vehicles = [createVehicle({ id: "vehicle-3", name: "Bike", vehicleMode: "RIDE", isDefault: true, latestOdometer: 50 })];
    const setup = applyTripModeToTripSetup({
      ...createTripSetupState(),
      tripMode: "WALK",
    }, "RIDE", vehicles);

    expect(setup).toMatchObject({
      tripMode: "RIDE",
      vehicleId: "vehicle-3",
      vehicleName: "Bike",
      businessSplitEnabled: true,
      startOdometer: 50,
    });
  });

  it("filters vehicle options by ride and drive mode", () => {
    const vehicles = [
      createVehicle({ id: "drive-1", name: "Camper", vehicleMode: "DRIVE" }),
      createVehicle({ id: "ride-1", name: "Scooter", vehicleMode: "RIDE" }),
    ];

    expect(filterVehicleOptionsForTripMode(vehicles, "WALK")).toEqual([]);
    expect(filterVehicleOptionsForTripMode(vehicles, "RIDE").map((vehicle) => vehicle.id)).toEqual(["ride-1"]);
    expect(filterVehicleOptionsForTripMode(vehicles, "DRIVE").map((vehicle) => vehicle.id)).toEqual(["drive-1"]);
  });

  it("returns helpful empty-state messages for ride and drive vehicle setup", () => {
    expect(getVehicleEmptyStateMessage("RIDE")).toBe("No ride vehicles configured");
    expect(getVehicleEmptyStateMessage("DRIVE")).toBe("No drive vehicles configured");
    expect(getVehicleEmptyStateMessage("WALK")).toBeUndefined();
  });

  it("switching walk to ride selects a ride vehicle", () => {
    const vehicles = [
      createVehicle({ id: "drive-1", name: "Camper", vehicleMode: "DRIVE", latestOdometer: 1200 }),
      createVehicle({ id: "ride-1", name: "Scooter", vehicleMode: "RIDE", isDefault: true, latestOdometer: 48 }),
    ];

    const setup = applyTripModeToTripSetup({ ...createTripSetupState(), tripMode: "WALK" }, "RIDE", vehicles);

    expect(setup).toMatchObject({
      tripMode: "RIDE",
      vehicleId: "ride-1",
      vehicleName: "Scooter",
      startOdometer: 48,
      odometerEdited: false,
    });
  });

  it("switching ride to drive selects a drive vehicle", () => {
    const vehicles = [
      createVehicle({ id: "ride-1", name: "Scooter", vehicleMode: "RIDE", isDefault: true, latestOdometer: 50 }),
      createVehicle({ id: "drive-1", name: "Camper", vehicleMode: "DRIVE", isDefault: true, latestOdometer: 1200 }),
    ];

    const setup = applyTripModeToTripSetup({
      ...createTripSetupState(),
      tripMode: "RIDE",
      vehicleId: "ride-1",
      vehicleName: "Scooter",
      startOdometer: 50,
      odometerEdited: true,
    }, "DRIVE", vehicles);

    expect(setup).toMatchObject({
      tripMode: "DRIVE",
      vehicleId: "drive-1",
      vehicleName: "Camper",
      startOdometer: 1200,
      odometerEdited: false,
    });
  });

  it("switching drive to ride does not keep an invalid drive vehicle", () => {
    const vehicles = [
      createVehicle({ id: "drive-1", name: "Tour Van", vehicleMode: "DRIVE", latestOdometer: 900 }),
      createVehicle({ id: "ride-1", name: "Bike", vehicleMode: "RIDE", latestOdometer: 25 }),
    ];

    const setup = applyTripModeToTripSetup({
      ...createTripSetupState(),
      vehicleId: "drive-1",
      vehicleName: "Tour Van",
      startOdometer: 901,
      odometerEdited: true,
    }, "RIDE", vehicles);

    expect(setup).toMatchObject({
      tripMode: "RIDE",
      vehicleId: "ride-1",
      vehicleName: "Bike",
      startOdometer: 25,
      odometerEdited: false,
    });
  });

  it("preserves a valid current vehicle selection for the selected mode", () => {
    const vehicles = [
      createVehicle({ id: "ride-1", name: "Bike", vehicleMode: "RIDE", latestOdometer: 25 }),
      createVehicle({ id: "ride-2", name: "E-bike", vehicleMode: "RIDE", isDefault: true, latestOdometer: 80 }),
    ];

    const setup = syncTripSetupVehicleSelection({
      ...createTripSetupState(),
      tripMode: "RIDE",
      vehicleId: "ride-1",
      vehicleName: "Bike",
      startOdometer: 41,
      odometerEdited: true,
    }, vehicles);

    expect(setup).toMatchObject({
      tripMode: "RIDE",
      vehicleId: "ride-1",
      vehicleName: "Bike",
      startOdometer: 41,
      odometerEdited: true,
    });
  });

  it("uses the most recently used vehicle for a mode when no default exists", () => {
    const vehicles = [
      createVehicle({ id: "ride-1", name: "Bike", vehicleMode: "RIDE", isDefault: false, latestOdometer: 15 }),
      createVehicle({ id: "ride-2", name: "Scooter", vehicleMode: "RIDE", isDefault: false, latestOdometer: 35 }),
    ];

    const selected = getBestVehicleOptionForTripMode(vehicles, "RIDE", [
      { tripMode: "RIDE", vehicleId: "ride-1", endedAt: "2026-04-20T08:00:00.000Z" },
      { tripMode: "RIDE", vehicleId: "ride-2", endedAt: "2026-04-22T08:00:00.000Z" },
    ]);

    expect(selected?.id).toBe("ride-2");
  });

  it("returns no vehicle when no matching vehicle exists for a mode", () => {
    const vehicles = [createVehicle({ id: "drive-1", vehicleMode: "DRIVE" })];

    const setup = applyTripModeToTripSetup(createTripSetupState(vehicles), "RIDE", vehicles);

    expect(setup).toMatchObject({
      tripMode: "RIDE",
      vehicleId: undefined,
      vehicleName: undefined,
      businessSplitEnabled: false,
      startOdometer: undefined,
    });
  });

  it("disables purpose selection for vehicles without business split", () => {
    const setup = applyVehicleToTripSetup(createTripSetupState(), createVehicle({
      id: "vehicle-2",
      enableBusinessSplit: false,
      defaultUse: "BUSINESS",
    }));

    expect(setup).toMatchObject({
      vehicleId: "vehicle-2",
      businessSplitEnabled: false,
      tripPurpose: "PRIVATE",
      purposeEdited: false,
    });
  });

  it("clears stale business selection when switching to a split-disabled vehicle", () => {
    const setup = applyVehicleToTripSetup({
      ...createTripSetupState(),
      tripMode: "DRIVE",
      tripPurpose: "BUSINESS",
      purposeEdited: true,
    }, createVehicle({
      id: "vehicle-3",
      enableBusinessSplit: false,
      defaultUse: "BUSINESS",
    }));

    expect(setup).toMatchObject({
      vehicleId: "vehicle-3",
      businessSplitEnabled: false,
      tripPurpose: "PRIVATE",
      purposeEdited: false,
    });
  });

  it("keeps older setup state without Tour data usable", () => {
    const setup = createTripSetupState();

    expect(setup.tripPurpose).toBe("PRIVATE");
    expect(setup).not.toHaveProperty("journeyId");
    expect(setup).not.toHaveProperty("journeyTitle");
  });

  it("parses odometer input safely", () => {
    expect(parseOdometerInput("12345")).toBe(12345);
    expect(parseOdometerInput("")).toBeUndefined();
    expect(parseOdometerInput("-1")).toBeUndefined();
  });

  it("sanitizes odometer inputs to whole-number digits", () => {
    expect(sanitizeWholeNumberInput("5000kasdf")).toBe("5000");
    expect(sanitizeWholeNumberInput("12,345 km")).toBe("12345");
    expect(sanitizeWholeNumberInput("-1.5")).toBe("15");
    expect(sanitizeWholeNumberInput("")).toBe("");
  });
});

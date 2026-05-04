import { PrismaPg } from "@prisma/adapter-pg";
import {
  ActivityType,
  ExternalMediaEntityType,
  ExternalMediaPlatform,
  JourneyStatus,
  LogUseType,
  PrismaClient,
  PublicPostStatus,
  TripMode,
  VehicleMode,
  Visibility,
  WorkspaceRole,
} from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, scryptSync } from "node:crypto";

function resolvePgConnectionString(databaseUrl) {
  if (!databaseUrl.startsWith("prisma+postgres://")) {
    return databaseUrl;
  }

  const url = new URL(databaseUrl);
  const apiKey = url.searchParams.get("api_key");

  if (!apiKey) {
    throw new Error("Invalid prisma+postgres DATABASE_URL: missing api_key query parameter.");
  }

  const parts = apiKey.split(".");
  const encodedPayload = parts.length >= 2 ? parts[1] : apiKey;
  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const nestedDatabaseUrl = typeof payload?.databaseUrl === "string" ? payload.databaseUrl.trim() : "";

  if (!nestedDatabaseUrl) {
    throw new Error("Invalid prisma+postgres DATABASE_URL: databaseUrl was not found in api_key payload.");
  }

  const normalized = new URL(nestedDatabaseUrl);
  if (normalized.hostname === "localhost") {
    normalized.hostname = "127.0.0.1";
  }

  return normalized.toString();
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for seeding.");
}

const adapter = new PrismaPg({
  connectionString: resolvePgConnectionString(databaseUrl),
});

const prisma = new PrismaClient({ adapter });
const seedAdminEmail = "admin@gigeze.app";
const seedAdminFullName = "GigEze Admin";
const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || "dev-admin-password";

function hashLocalDevPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString("base64url")}`;
}

function getSeedAuthConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    password: seedAdminPassword,
  };
}

async function findAuthUserByEmail(supabase, email) {
  let page = 1;

  while (page) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });

    if (error) {
      throw error;
    }

    const existingUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return existingUser;
    }

    page = data.nextPage ?? null;
  }

  return null;
}

async function syncSeedAdminAuthUser() {
  if (process.env.SEED_SUPABASE_AUTH !== "true") {
    console.warn(
      `Skipped Supabase auth seed for ${seedAdminEmail}. Set SEED_SUPABASE_AUTH=true to opt in.`,
    );
    return "skipped";
  }

  const { supabaseUrl, serviceRoleKey, password } = getSeedAuthConfig();
  const missingVars = [
    ["NEXT_PUBLIC_SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["SEED_ADMIN_PASSWORD", password],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVars.length > 0) {
    console.warn(
      `Skipped Supabase auth seed for ${seedAdminEmail}. Missing env: ${missingVars.join(", ")}.`,
    );
    return "skipped";
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const existingUser = await findAuthUserByEmail(supabase, seedAdminEmail);

  if (existingUser) {
    const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
      email_confirm: true,
      password,
      user_metadata: { full_name: seedAdminFullName },
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error(`Failed to update Supabase auth user for ${seedAdminEmail}.`);
    }

    console.log(`Seed synced Supabase auth user: ${seedAdminEmail}`);
    return "updated";
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: seedAdminEmail,
    email_confirm: true,
    password,
    user_metadata: { full_name: seedAdminFullName },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error(`Failed to create Supabase auth user for ${seedAdminEmail}.`);
  }

  console.log(`Seed created Supabase auth user: ${seedAdminEmail}`);
  return "created";
}

async function main() {
  await prisma.user.upsert({
    where: { email: seedAdminEmail },
    update: {
      fullName: seedAdminFullName,
      localPasswordHash: hashLocalDevPassword(seedAdminPassword),
    },
    create: {
      email: seedAdminEmail,
      fullName: seedAdminFullName,
      localPasswordHash: hashLocalDevPassword(seedAdminPassword),
    },
  });

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: seedAdminEmail },
    select: { id: true, email: true, fullName: true },
  });

  const workspace = await prisma.workspace.upsert({
    where: { ownerUserId: owner.id },
    update: {
      name: "GigEze Backline Workspace",
      slug: "gigeze-backline",
      description: "Tour operations, gig movement, media drops, and public story publishing.",
      defaultJourneyVisibility: Visibility.SHARED,
      defaultPostVisibility: Visibility.PRIVATE,
      defaultMediaVisibility: Visibility.SHARED,
      gpsSamplingIntervalSeconds: 10,
    },
    create: {
      ownerUserId: owner.id,
      name: "GigEze Backline Workspace",
      slug: "gigeze-backline",
      description: "Tour operations, gig movement, media drops, and public story publishing.",
      defaultJourneyVisibility: Visibility.SHARED,
      defaultPostVisibility: Visibility.PRIVATE,
      defaultMediaVisibility: Visibility.SHARED,
      gpsSamplingIntervalSeconds: 10,
    },
  });

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: owner.id,
      },
    },
    update: { role: WorkspaceRole.OWNER },
    create: {
      workspaceId: workspace.id,
      userId: owner.id,
      role: WorkspaceRole.OWNER,
    },
  });

  const legacyTour = await prisma.Tour.findUnique({
    where: { slug: "nsw-coast-run" },
    select: { id: true },
  });

  if (legacyTour) {
    const legacyGigs = await prisma.Gig.findMany({
      where: { journeyId: legacyTour.id },
      select: { id: true },
    });
    const legacyGigIds = legacyGigs.map((Gig) => Gig.id);

    await prisma.externalMediaLink.deleteMany({
      where: {
        workspaceId: workspace.id,
        OR: [
          { entityType: ExternalMediaEntityType.Tour, entityId: legacyTour.id },
          ...(legacyGigIds.length
            ? [{ entityType: ExternalMediaEntityType.MOMENT, entityId: { in: legacyGigIds } }]
            : []),
        ],
      },
    });
    await prisma.publicPost.deleteMany({ where: { journeyId: legacyTour.id } });
    await prisma.media.deleteMany({ where: { journeyId: legacyTour.id } });
    await prisma.activityNote.deleteMany({ where: { journeyId: legacyTour.id } });
    await prisma.drivingLog.deleteMany({ where: { journeyId: legacyTour.id } });
    await prisma.Gig.deleteMany({ where: { journeyId: legacyTour.id } });
    await prisma.Tour.delete({ where: { id: legacyTour.id } });
  }

  const van = await prisma.vehicle.upsert({
    where: { id: "seed-sprinter-van" },
    update: {
      workspaceId: workspace.id,
      userId: owner.id,
      name: "Sprinter Van - Backline",
      vehicleMode: VehicleMode.DRIVE,
      enableBusinessSplit: true,
      registration: "GIG 247",
      fuelType: "Diesel",
      notes: "Primary vehicle for PA, merch tubs, and backline cases.",
      isDefault: true,
      startingOdometer: 84210,
      defaultUse: LogUseType.BUSINESS,
    },
    create: {
      id: "seed-sprinter-van",
      workspaceId: workspace.id,
      userId: owner.id,
      name: "Sprinter Van - Backline",
      vehicleMode: VehicleMode.DRIVE,
      enableBusinessSplit: true,
      registration: "GIG 247",
      fuelType: "Diesel",
      notes: "Primary vehicle for PA, merch tubs, and backline cases.",
      isDefault: true,
      startingOdometer: 84210,
      defaultUse: LogUseType.BUSINESS,
    },
  });

  await prisma.vehicle.upsert({
    where: { id: "seed-crew-e-bike" },
    update: {
      workspaceId: workspace.id,
      userId: owner.id,
      name: "Crew E-bike",
      vehicleMode: VehicleMode.RIDE,
      enableBusinessSplit: false,
      registration: null,
      fuelType: "Electric",
      notes: "Short venue errands, flyer drops, and last-mile crew movement.",
      isDefault: false,
      startingOdometer: 320,
      defaultUse: LogUseType.BUSINESS,
    },
    create: {
      id: "seed-crew-e-bike",
      workspaceId: workspace.id,
      userId: owner.id,
      name: "Crew E-bike",
      vehicleMode: VehicleMode.RIDE,
      enableBusinessSplit: false,
      registration: null,
      fuelType: "Electric",
      notes: "Short venue errands, flyer drops, and last-mile crew movement.",
      isDefault: false,
      startingOdometer: 320,
      defaultUse: LogUseType.BUSINESS,
    },
  });

  const Tour = await prisma.Tour.upsert({
    where: { slug: "east-coast-launch-run" },
    update: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      title: "East Coast Launch Run",
      description: "Three-city single launch with rehearsals, load-ins, merch drops, and public tour updates.",
      status: JourneyStatus.ACTIVE,
      visibility: Visibility.PUBLIC,
      startDate: new Date("2026-05-08"),
      endDate: new Date("2026-05-18"),
      coverImageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a",
    },
    create: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      slug: "east-coast-launch-run",
      title: "East Coast Launch Run",
      description: "Three-city single launch with rehearsals, load-ins, merch drops, and public tour updates.",
      status: JourneyStatus.ACTIVE,
      visibility: Visibility.PUBLIC,
      startDate: new Date("2026-05-08"),
      endDate: new Date("2026-05-18"),
      coverImageUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a",
    },
  });

  const existingGigs = await prisma.Gig.findMany({
    where: { journeyId: Tour.id },
    select: { id: true },
  });
  const existingGigIds = existingGigs.map((Gig) => Gig.id);

  await prisma.externalMediaLink.deleteMany({
    where: {
      workspaceId: workspace.id,
      OR: [
        { entityType: ExternalMediaEntityType.Tour, entityId: Tour.id },
        ...(existingGigIds.length
          ? [{ entityType: ExternalMediaEntityType.MOMENT, entityId: { in: existingGigIds } }]
          : []),
      ],
    },
  });
  await prisma.publicPost.deleteMany({ where: { journeyId: Tour.id } });
  await prisma.media.deleteMany({ where: { journeyId: Tour.id } });
  await prisma.activityNote.deleteMany({ where: { journeyId: Tour.id } });
  await prisma.drivingLog.deleteMany({ where: { journeyId: Tour.id } });
  await prisma.Gig.deleteMany({ where: { journeyId: Tour.id } });

  const melbourneGig = await prisma.Gig.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      journeyId: Tour.id,
      title: "Northcote Social Club",
      description: "Launch rehearsal, support handover, and first public show of the run.",
      latitude: -37.766778,
      longitude: 144.999611,
      locationName: "Northcote Social Club, Melbourne VIC",
      visibility: Visibility.PUBLIC,
      orderIndex: 1,
      arrivalDate: new Date("2026-05-08T08:30:00+10:00"),
      departureDate: new Date("2026-05-09T01:00:00+10:00"),
    },
  });

  const canberraGig = await prisma.Gig.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      journeyId: Tour.id,
      title: "Smith's Alternative",
      description: "All-ages matinee, radio drop-in, and stripped-back evening set.",
      latitude: -35.278286,
      longitude: 149.129256,
      locationName: "Smith's Alternative, Canberra ACT",
      visibility: Visibility.SHARED,
      orderIndex: 2,
      arrivalDate: new Date("2026-05-11T11:00:00+10:00"),
      departureDate: new Date("2026-05-12T10:00:00+10:00"),
    },
  });

  const sydneyGig = await prisma.Gig.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      journeyId: Tour.id,
      title: "Oxford Art Factory",
      description: "Sydney headline night with press photos, merch count, and late pack-down.",
      latitude: -33.879514,
      longitude: 151.213393,
      locationName: "Oxford Art Factory, Sydney NSW",
      visibility: Visibility.PUBLIC,
      orderIndex: 3,
      arrivalDate: new Date("2026-05-15T10:30:00+10:00"),
      departureDate: new Date("2026-05-16T02:00:00+10:00"),
    },
  });

  await prisma.drivingLog.createMany({
    data: [
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        tripMode: TripMode.DRIVE,
        vehicleId: van.id,
        date: new Date("2026-05-10"),
        startTime: new Date("2026-05-10T08:15:00+10:00"),
        endTime: new Date("2026-05-10T16:45:00+10:00"),
        startLocation: "Northcote Social Club, Melbourne VIC",
        endLocation: "Smith's Alternative, Canberra ACT",
        startOdometer: 84210,
        endOdometer: 84878,
        businessKm: 668,
        personalKm: 0,
        purpose: "Tour transfer: Melbourne to Canberra",
        hasRouteSamples: false,
        notes: "Backline, merch tubs, and lighting cases loaded. Fuel and driver swap at Glenrowan.",
      },
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        tripMode: TripMode.RIDE,
        vehicleId: "seed-crew-e-bike",
        date: new Date("2026-05-11"),
        startTime: new Date("2026-05-11T15:20:00+10:00"),
        endTime: new Date("2026-05-11T16:05:00+10:00"),
        startLocation: "Smith's Alternative",
        endLocation: "2XX FM",
        startOdometer: 320,
        endOdometer: 326,
        businessKm: 6,
        personalKm: 0,
        purpose: "Promo drop: radio interview run",
        hasRouteSamples: false,
        notes: "Dropped press kit, two posters, and acoustic guitar for afternoon segment.",
      },
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        tripMode: TripMode.DRIVE,
        vehicleId: van.id,
        date: new Date("2026-05-14"),
        startTime: new Date("2026-05-14T09:00:00+10:00"),
        endTime: new Date("2026-05-14T13:25:00+10:00"),
        startLocation: "Canberra ACT",
        endLocation: "Oxford Art Factory, Sydney NSW",
        startOdometer: 84878,
        endOdometer: 85166,
        businessKm: 288,
        personalKm: 0,
        purpose: "Tour transfer: Canberra to Sydney",
        hasRouteSamples: false,
        notes: "Arrived early for dock access. Merch float reconciled before soundcheck.",
      },
    ],
  });

  await prisma.activityNote.createMany({
    data: [
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        stopId: melbourneGig.id,
        type: ActivityType.ADMIN,
        date: new Date("2026-05-08T14:00:00+10:00"),
        durationMinutes: 75,
        location: "Northcote Social Club green room",
        notes: "Finalised door split, guest list, photographer access, and settlement contact.",
        visibility: Visibility.PRIVATE,
      },
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        stopId: canberraGig.id,
        type: ActivityType.WORK,
        date: new Date("2026-05-11T12:30:00+10:00"),
        durationMinutes: 110,
        location: "Smith's Alternative",
        notes: "Compact stage plot: keys DI left, vocal wedge centre, acoustic DI spare.",
        visibility: Visibility.SHARED,
      },
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        stopId: sydneyGig.id,
        type: ActivityType.MAINTENANCE,
        date: new Date("2026-05-15T16:00:00+10:00"),
        durationMinutes: 45,
        location: "Oxford Art Factory loading dock",
        notes: "Replaced two XLRs, taped pedalboard power, checked spare strings and drum key.",
        visibility: Visibility.PRIVATE,
      },
    ],
  });

  await prisma.media.createMany({
    data: [
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        stopId: melbourneGig.id,
        filePath: "seed/east-coast-launch-run/northcote-soundcheck.jpg",
        publicUrl: "https://images.unsplash.com/photo-1506157786151-b8491531f063",
        fileName: "northcote-soundcheck.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 184000,
        caption: "Northcote soundcheck before doors.",
        visibility: Visibility.PUBLIC,
      },
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        stopId: canberraGig.id,
        filePath: "seed/east-coast-launch-run/canberra-green-room.jpg",
        publicUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f",
        fileName: "canberra-green-room.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 156000,
        caption: "Quiet ten before the all-ages matinee.",
        visibility: Visibility.SHARED,
      },
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        stopId: sydneyGig.id,
        filePath: "seed/east-coast-launch-run/sydney-doors.jpg",
        publicUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7",
        fileName: "sydney-doors.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 212000,
        caption: "Sydney doors queue building early.",
        visibility: Visibility.PUBLIC,
      },
    ],
  });

  await prisma.publicPost.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      journeyId: Tour.id,
      stopId: melbourneGig.id,
      slug: "east-coast-launch-run-week-one",
      title: "East Coast Launch Run: week one",
      excerpt: "Melbourne kicked off the run with a tight room, fast pack-down, and a clean handoff to Canberra.",
      content: [
        "The launch run opened at Northcote with a full backline check, a tidy guest list, and merch moving before support finished.",
        "Next up: Canberra for the matinee set, then Sydney for the headline room and press photos.",
      ].join("\n\n"),
      status: PublicPostStatus.PUBLISHED,
      visibility: Visibility.PUBLIC,
      coverImageUrl: "https://images.unsplash.com/photo-1506157786151-b8491531f063",
      publishedAt: new Date("2026-05-09T10:00:00+10:00"),
    },
  });

  await prisma.externalMediaLink.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      entityType: ExternalMediaEntityType.Tour,
      entityId: Tour.id,
      url: "https://www.youtube.com/watch?v=seed-gigeze-tour-diary",
      platform: ExternalMediaPlatform.YOUTUBE,
      title: "Tour diary: load-in to lights down",
      caption: "Seed placeholder for a public-facing tour diary clip.",
      thumbnailUrl: "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14",
      embedUrl: "https://www.youtube.com/embed/seed-gigeze-tour-diary",
      externalId: "seed-gigeze-tour-diary",
    },
  });

  const authSeedStatus = await syncSeedAdminAuthUser();

  console.log(`Seed completed: admin auth ${authSeedStatus} + sample workspace dataset.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

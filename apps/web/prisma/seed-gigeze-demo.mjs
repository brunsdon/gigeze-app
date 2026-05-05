import { PrismaPg } from "@prisma/adapter-pg";
import {
  ActivityType,
  JourneyStatus,
  LogUseType,
  PrismaClient,
  PublicPostStatus,
  TripMode,
  VehicleMode,
  Visibility,
  WorkspaceRole,
} from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function getCliOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function loadEnvFile(filePath) {
  const resolvedPath = resolve(process.cwd(), filePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Environment file not found: ${resolvedPath}`);
  }

  for (const rawLine of readFileSync(resolvedPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

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

const envFile = getCliOption("--env-file") ?? ".env";
let envSource = "process environment";

if (!process.env.DATABASE_URL && existsSync(resolve(process.cwd(), envFile))) {
  loadEnvFile(envFile);
  envSource = envFile;
}

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the GigEze demo seed.");
}

const adapter = new PrismaPg({
  connectionString: resolvePgConnectionString(databaseUrl),
});

const prisma = new PrismaClient({ adapter });

const demoOwnerEmail = "brunsdon@engineer.com";
const demoOwnerName = "Matty B";
const demoWorkspaceSlug = "brunsdon-engineer";
const tourSlug = "neon-vultures-east-coast-run-2026";
const tasmaniaTourSlug = "neon-vultures-tasmania-circuit-2026";

function demoId(scope, slug) {
  return `demo-neon-vultures-${scope}-${slug}`;
}

function localDateTime(date, time, offset = "+11:00") {
  return new Date(`${date}T${time}:00${offset}`);
}

function minutesAfter(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function getOrCreateDemoWorkspace(owner) {
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { ownerUserId: owner.id },
  });

  if (existingWorkspace) {
    return existingWorkspace;
  }

  const slugOwner = await prisma.workspace.findUnique({
    where: { slug: demoWorkspaceSlug },
    select: { id: true, ownerUserId: true },
  });

  if (slugOwner && slugOwner.ownerUserId !== owner.id) {
    throw new Error(
      `Cannot create demo workspace: workspace slug "${demoWorkspaceSlug}" is already owned by another user.`,
    );
  }

  return prisma.workspace.create({
    data: {
      ownerUserId: owner.id,
      slug: demoWorkspaceSlug,
      name: "Brunsdon GigEze Workspace",
      description: "Personal GigEze workspace for demo and portfolio tour data.",
      defaultJourneyVisibility: Visibility.SHARED,
      defaultPostVisibility: Visibility.PRIVATE,
      defaultMediaVisibility: Visibility.SHARED,
      gpsSamplingIntervalSeconds: 10,
    },
  });
}

const gigs = [
  {
    slug: "neon-vultures-the-forum-2026-03-12",
    title: "Neon Vultures @ The Forum",
    date: "2026-03-12",
    city: "Melbourne",
    venue: "The Forum",
    status: "Completed",
    latitude: -37.8165,
    longitude: 144.9691,
  },
  {
    slug: "neon-vultures-enmore-theatre-2026-03-15",
    title: "Neon Vultures @ Enmore Theatre",
    date: "2026-03-15",
    city: "Sydney",
    venue: "Enmore Theatre",
    status: "Completed",
    latitude: -33.8996,
    longitude: 151.1730,
  },
  {
    slug: "neon-vultures-the-tivoli-2026-03-18",
    title: "Neon Vultures @ The Tivoli",
    date: "2026-03-18",
    city: "Brisbane",
    venue: "The Tivoli",
    status: "Completed",
    latitude: -27.4538,
    longitude: 153.0335,
  },
  {
    slug: "neon-vultures-uc-hub-2026-03-20",
    title: "Neon Vultures @ UC Hub",
    date: "2026-03-20",
    city: "Canberra",
    venue: "UC Hub",
    status: "Completed",
    latitude: -35.2387,
    longitude: 149.0831,
  },
  {
    slug: "neon-vultures-corner-hotel-2026-03-23",
    title: "Neon Vultures @ Corner Hotel",
    date: "2026-03-23",
    city: "Melbourne",
    venue: "Corner Hotel",
    status: "Completed",
    latitude: -37.8247,
    longitude: 144.9916,
  },
  {
    slug: "neon-vultures-oxford-art-factory-2026-03-26",
    title: "Neon Vultures @ Oxford Art Factory",
    date: "2026-03-26",
    city: "Sydney",
    venue: "Oxford Art Factory",
    status: "Completed",
    latitude: -33.8795,
    longitude: 151.2134,
  },
  {
    slug: "neon-vultures-the-triffid-2026-03-29",
    title: "Neon Vultures @ The Triffid",
    date: "2026-03-29",
    city: "Brisbane",
    venue: "The Triffid",
    status: "Upcoming",
    latitude: -27.4528,
    longitude: 153.0441,
  },
  {
    slug: "neon-vultures-beach-hotel-2026-04-02",
    title: "Neon Vultures @ Beach Hotel",
    date: "2026-04-02",
    city: "Byron Bay",
    venue: "Beach Hotel",
    status: "Upcoming",
    latitude: -28.6418,
    longitude: 153.6134,
  },
  {
    slug: "neon-vultures-unibar-2026-04-06",
    title: "Neon Vultures @ UniBar",
    date: "2026-04-06",
    city: "Adelaide",
    venue: "UniBar",
    status: "Upcoming",
    latitude: -34.9208,
    longitude: 138.6043,
    offset: "+10:00",
  },
  {
    slug: "neon-vultures-metro-city-2026-04-10",
    title: "Neon Vultures @ Metro City",
    date: "2026-04-10",
    city: "Perth",
    venue: "Metro City",
    status: "Upcoming",
    latitude: -31.9465,
    longitude: 115.8570,
    offset: "+08:00",
  },
];

const activityNotes = [
  ["Load-in delayed due to lighting rig transport arriving late.", ActivityType.WORK, 90],
  ["Soundcheck ran over by 20 minutes due to monitor issues.", ActivityType.WORK, 80],
  ["FOH mix adjusted mid-set after vocal clipping on track 3.", ActivityType.MAINTENANCE, 25],
  ["Venue power fluctuation during setup, resolved before doors.", ActivityType.MAINTENANCE, 45],
  ["Crowd capacity reached early, additional security requested.", ActivityType.ADMIN, 35],
  ["Merch sales strong - sold out of black tour tees.", ActivityType.ADMIN, 30],
  ["Support act changeover required extra 10 minutes.", ActivityType.WORK, 20],
  ["Lighting cues updated after rehearsal feedback.", ActivityType.WORK, 50],
  ["Bus departure delayed due to late pack-down.", ActivityType.ADMIN, 40],
  ["Weather impacted outdoor queue management at Byron Bay show.", ActivityType.ADMIN, 55],
];

const trips = [
  {
    id: "melbourne-sydney-2026-03-13",
    date: "2026-03-13",
    start: "Melbourne",
    end: "Sydney",
    km: 878,
    purpose: "Travel to Enmore Theatre show",
    startOdometer: 84210,
    route: [
      [-37.8165, 144.9691],
      [-37.5674, 144.7293],
      [-36.1216, 146.8880],
      [-35.1189, 147.3690],
      [-34.7546, 149.7203],
      [-34.4248, 150.8931],
      [-33.8996, 151.1730],
    ],
  },
  {
    id: "sydney-brisbane-2026-03-16",
    date: "2026-03-16",
    start: "Sydney",
    end: "Brisbane",
    km: 917,
    purpose: "Tour leg transport",
    startOdometer: 85088,
    route: [
      [-33.8996, 151.1730],
      [-33.4269, 151.3420],
      [-32.9283, 151.7817],
      [-31.4333, 152.9000],
      [-30.2963, 153.1135],
      [-28.0167, 153.4000],
      [-27.4538, 153.0335],
    ],
  },
  {
    id: "brisbane-canberra-2026-03-19",
    date: "2026-03-19",
    start: "Brisbane",
    end: "Canberra",
    km: 1193,
    purpose: "Festival routing",
    startOdometer: 86005,
    route: [
      [-27.4538, 153.0335],
      [-28.0167, 153.4000],
      [-30.2963, 153.1135],
      [-31.2532, 146.9211],
      [-32.2569, 148.6011],
      [-34.7546, 149.7203],
      [-35.2387, 149.0831],
    ],
  },
  {
    id: "canberra-melbourne-2026-03-21",
    date: "2026-03-21",
    start: "Canberra",
    end: "Melbourne",
    km: 663,
    purpose: "Return leg",
    startOdometer: 87198,
    route: [
      [-35.2387, 149.0831],
      [-35.3550, 149.2330],
      [-35.1189, 147.3690],
      [-36.1216, 146.8880],
      [-36.3833, 145.4000],
      [-37.2090, 145.4245],
      [-37.8247, 144.9916],
    ],
  },
  {
    id: "sydney-byron-bay-2026-03-31",
    date: "2026-03-31",
    start: "Sydney",
    end: "Byron Bay",
    km: 770,
    purpose: "Regional show travel",
    startOdometer: 87861,
    route: [
      [-33.8795, 151.2134],
      [-33.4269, 151.3420],
      [-32.9283, 151.7817],
      [-31.4333, 152.9000],
      [-30.2963, 153.1135],
      [-29.4577, 153.2040],
      [-28.6418, 153.6134],
    ],
  },
];

const stories = [
  {
    slug: "neon-vultures-melbourne-forum-load-in",
    title: "Melbourne: dark circuits under The Forum",
    excerpt: "Opening night started with a late lighting rig, a patient crew, and a room that filled faster than expected.",
    content: [
      "The East Coast Run opened in Melbourne with the familiar mix of precision and panic: dock access was tight, the lighting rig rolled in late, and the first real test of the day was keeping the crew calm while the schedule compressed.",
      "By doors, the room had shifted from work light to voltage. Neon Vultures hit the first chorus with everything locked in, and the earlier delay became invisible to the crowd.",
      "The useful note for the next show: protect the lighting window, keep monitor checks moving, and get merch counted before support hits stage.",
    ].join("\n\n"),
    status: PublicPostStatus.PUBLISHED,
    visibility: Visibility.PUBLIC,
    publishedAt: localDateTime("2026-03-13", "10:00"),
    gigIndex: 0,
  },
  {
    slug: "neon-vultures-enmore-to-tivoli",
    title: "Sydney to Brisbane: the long hum north",
    excerpt: "A packed Enmore night rolled straight into highway hours, monitor notes, and a sharper Brisbane setup.",
    content: [
      "Sydney gave the band a loud, close room and one of the first moments where the tour felt properly awake. The Enmore set needed a mid-show FOH adjustment after vocal clipping on track 3, but the fix landed quickly.",
      "The next leg north was all distance and discipline: cases repacked, black tees already moving fast, and the van rolling out with enough time to keep Brisbane from becoming a scramble.",
      "By The Tivoli, the team had tightened the handoff between soundcheck and doors. Less drama, better notes, louder room.",
    ].join("\n\n"),
    status: PublicPostStatus.PUBLISHED,
    visibility: Visibility.PUBLIC,
    publishedAt: localDateTime("2026-03-19", "09:30"),
    gigIndex: 2,
  },
  {
    slug: "neon-vultures-corner-hotel-sold-out-tees",
    title: "Corner Hotel: black tees, bright room",
    excerpt: "The Melbourne return brought a fast crowd build, a merch sellout, and a reminder to restock before the west.",
    content: [
      "The Corner Hotel show felt like a second hometown opening night. Capacity built early, extra security was requested, and the merch table burned through the last of the black tour tees before the encore.",
      "Operationally, the night was clean: no power surprises, a faster support changeover than Canberra, and a sharper pack-down target for the bus call.",
      "The lesson is boring but useful: bestselling sizes need a buffer, and the merch count has to happen before adrenaline rewrites everyone’s memory.",
    ].join("\n\n"),
    status: PublicPostStatus.PUBLISHED,
    visibility: Visibility.SHARED,
    publishedAt: localDateTime("2026-03-24", "11:00"),
    gigIndex: 4,
  },
  {
    slug: "neon-vultures-byron-weather-queue-notes",
    title: "Draft: Byron queue and weather notes",
    excerpt: "Outdoor queue planning for Byron needs a tighter wet-weather fallback before the Beach Hotel show.",
    content: [
      "Draft notes for Byron Bay: weather is the main operational risk. Queue cover, security placement, and the timing of the sunset set all need one more pass.",
      "Confirm whether the venue wants barriers adjusted before doors, and make sure the crew has a dry fallback for guest list and wristband checks.",
    ].join("\n\n"),
    status: PublicPostStatus.DRAFT,
    visibility: Visibility.PRIVATE,
    publishedAt: null,
    gigIndex: 7,
  },
];

const tasmaniaGigs = [
  {
    slug: "neon-vultures-odeon-theatre-2026-06-05",
    title: "Neon Vultures @ Odeon Theatre",
    date: "2026-06-05",
    city: "Hobart",
    venue: "Odeon Theatre",
    status: "Upcoming",
    latitude: -42.8806,
    longitude: 147.3257,
    offset: "+10:00",
  },
  {
    slug: "neon-vultures-republic-bar-2026-06-07",
    title: "Neon Vultures @ Republic Bar",
    date: "2026-06-07",
    city: "Hobart",
    venue: "Republic Bar",
    status: "Upcoming",
    latitude: -42.8747,
    longitude: 147.3154,
    offset: "+10:00",
  },
  {
    slug: "neon-vultures-royal-oak-2026-06-10",
    title: "Neon Vultures @ Royal Oak",
    date: "2026-06-10",
    city: "Launceston",
    venue: "Royal Oak",
    status: "Upcoming",
    latitude: -41.4388,
    longitude: 147.1370,
    offset: "+10:00",
  },
  {
    slug: "neon-vultures-forth-pub-2026-06-12",
    title: "Neon Vultures @ Forth Pub",
    date: "2026-06-12",
    city: "Forth",
    venue: "Forth Pub",
    status: "Upcoming",
    latitude: -41.1935,
    longitude: 146.2501,
    offset: "+10:00",
  },
  {
    slug: "neon-vultures-paragon-theatre-2026-06-14",
    title: "Neon Vultures @ Paragon Theatre",
    date: "2026-06-14",
    city: "Queenstown",
    venue: "Paragon Theatre",
    status: "Upcoming",
    latitude: -42.0805,
    longitude: 145.5567,
    offset: "+10:00",
  },
  {
    slug: "neon-vultures-salerno-gallery-2026-06-17",
    title: "Neon Vultures @ Salerno Gallery",
    date: "2026-06-17",
    city: "Triabunna",
    venue: "Salerno Gallery",
    status: "Upcoming",
    latitude: -42.5096,
    longitude: 147.9110,
    offset: "+10:00",
  },
];

const tasmaniaActivityNotes = [
  ["Ferry freight manifest confirmed for backline cases and merch tubs.", ActivityType.ADMIN, 45],
  ["Compact Hobart club setup needs reduced lighting floor package.", ActivityType.WORK, 60],
  ["Launceston monitor world requires extra DI check for keys rig.", ActivityType.MAINTENANCE, 40],
  ["North-west routing leaves narrow load-in window after coastal drive.", ActivityType.ADMIN, 35],
  ["Queenstown stage access confirmed; pack-down must clear by midnight.", ActivityType.WORK, 55],
  ["Triabunna weather plan drafted for outdoor queue and van parking.", ActivityType.ADMIN, 30],
];

const tasmaniaTrips = [
  {
    id: "hobart-launceston-2026-06-09",
    date: "2026-06-09",
    start: "Hobart",
    end: "Launceston",
    km: 201,
    purpose: "Tasmania northbound tour transfer",
    startOdometer: 88631,
    offset: "+10:00",
    sampleStartTime: "08:30",
    route: [
      [-42.8806, 147.3257],
      [-42.6965, 147.2676],
      [-42.3000, 147.3700],
      [-41.9200, 147.4900],
      [-41.6000, 147.1200],
      [-41.4388, 147.1370],
    ],
  },
  {
    id: "launceston-forth-2026-06-11",
    date: "2026-06-11",
    start: "Launceston",
    end: "Forth",
    km: 111,
    purpose: "North-west regional show travel",
    startOdometer: 88832,
    offset: "+10:00",
    sampleStartTime: "08:30",
    route: [
      [-41.4388, 147.1370],
      [-41.5250, 146.8350],
      [-41.5240, 146.6570],
      [-41.4710, 146.3240],
      [-41.1935, 146.2501],
    ],
  },
  {
    id: "forth-queenstown-2026-06-13",
    date: "2026-06-13",
    start: "Forth",
    end: "Queenstown",
    km: 173,
    purpose: "West coast routing",
    startOdometer: 88943,
    offset: "+10:00",
    sampleStartTime: "08:30",
    route: [
      [-41.1935, 146.2501],
      [-41.1760, 146.3560],
      [-41.3830, 145.8750],
      [-41.7500, 145.5400],
      [-42.0805, 145.5567],
    ],
  },
  {
    id: "queenstown-triabunna-2026-06-16",
    date: "2026-06-16",
    start: "Queenstown",
    end: "Triabunna",
    km: 333,
    purpose: "East coast closing leg",
    startOdometer: 89116,
    offset: "+10:00",
    sampleStartTime: "08:30",
    route: [
      [-42.0805, 145.5567],
      [-42.2990, 146.4460],
      [-42.8821, 147.3272],
      [-42.7400, 147.4400],
      [-42.5096, 147.9110],
    ],
  },
];

const tasmaniaStories = [
  {
    slug: "neon-vultures-tasmania-ferry-manifest",
    title: "Tasmania circuit: getting the gear across",
    excerpt: "The island run starts before the first show, with freight timing, ferry manifests, and a leaner lighting package.",
    content: [
      "Tasmania changes the shape of a tour before a single note is played. The backline has to be counted twice, the ferry manifest has to match the cases, and every loose merch tub suddenly matters.",
      "For Hobart, the crew is trimming the lighting floor package without losing the mood of the East Coast Run. Less footprint, same voltage.",
      "The goal is simple: arrive with enough margin that the first Odeon Theatre load-in feels like a show day, not a rescue mission.",
    ].join("\n\n"),
    status: PublicPostStatus.PUBLISHED,
    visibility: Visibility.PUBLIC,
    publishedAt: localDateTime("2026-06-04", "10:00", "+10:00"),
    gigIndex: 0,
  },
  {
    slug: "neon-vultures-launceston-monitor-notes",
    title: "Launceston: monitor notes and small-room pressure",
    excerpt: "A tighter room means cleaner stage volume, faster changeovers, and no hiding from the keys rig.",
    content: [
      "The Royal Oak stop is the kind of room where every monitor decision matters. Stage volume has to stay disciplined, especially once the synth rig and vocal chain start competing for air.",
      "The crew note is practical: extra DI check for keys, vocal wedge first, and no late changes to the support act patch unless something is actually broken.",
    ].join("\n\n"),
    status: PublicPostStatus.PUBLISHED,
    visibility: Visibility.SHARED,
    publishedAt: localDateTime("2026-06-10", "11:30", "+10:00"),
    gigIndex: 2,
  },
  {
    slug: "neon-vultures-west-coast-drive-draft",
    title: "Draft: west coast drive notes",
    excerpt: "Queenstown routing needs extra weather margin and a stricter pack-down clock.",
    content: [
      "Draft routing notes for the west coast leg: build in extra weather margin, confirm van parking near the Paragon Theatre, and keep the midnight clear-out visible to the whole crew.",
      "The drive is part of the story, but it should not become the problem.",
    ].join("\n\n"),
    status: PublicPostStatus.DRAFT,
    visibility: Visibility.PRIVATE,
    publishedAt: null,
    gigIndex: 4,
  },
];

async function upsertRouteSamples(logId, trip) {
  const startedAt = localDateTime(trip.date, trip.sampleStartTime ?? "08:00", trip.offset);
  const sampleSpacingMinutes = Math.floor((9 * 60 + 30) / Math.max(trip.route.length - 1, 1));

  await prisma.drivingLogGpsSample.deleteMany({
    where: {
      drivingLogId: logId,
      sampleIndex: { gte: trip.route.length },
    },
  });

  for (const [sampleIndex, [latitude, longitude]] of trip.route.entries()) {
    await prisma.drivingLogGpsSample.upsert({
      where: {
        drivingLogId_sampleIndex: {
          drivingLogId: logId,
          sampleIndex,
        },
      },
      update: {
        latitude,
        longitude,
        accuracyMeters: sampleIndex === 0 || sampleIndex === trip.route.length - 1 ? 12 : 28,
        recordedAt: minutesAfter(startedAt, sampleIndex * sampleSpacingMinutes),
      },
      create: {
        drivingLogId: logId,
        sampleIndex,
        latitude,
        longitude,
        accuracyMeters: sampleIndex === 0 || sampleIndex === trip.route.length - 1 ? 12 : 28,
        recordedAt: minutesAfter(startedAt, sampleIndex * sampleSpacingMinutes),
      },
    });
  }
}

async function main() {
  console.warn("GigEze Neon Vultures demo seed: writing demo/portfolio data to the configured DATABASE_URL.");
  console.warn(`Environment source: ${envSource}`);
  console.warn("Only run against a database where demo data is acceptable.");

  const owner = await prisma.user.upsert({
    where: { email: demoOwnerEmail },
    update: {
      fullName: demoOwnerName,
    },
    create: {
      email: demoOwnerEmail,
      fullName: demoOwnerName,
    },
  });

  const workspace = await getOrCreateDemoWorkspace(owner);

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

  const vehicle = await prisma.vehicle.upsert({
    where: { id: demoId("vehicle", "tour-van") },
    update: {
      workspaceId: workspace.id,
      userId: owner.id,
      name: "Neon Vultures Tour Van",
      vehicleMode: VehicleMode.DRIVE,
      enableBusinessSplit: true,
      registration: "NV 2026",
      fuelType: "Diesel",
      notes: "Demo logistics vehicle for the Neon Vultures east coast run.",
      isDefault: true,
      startingOdometer: 84210,
      defaultUse: LogUseType.BUSINESS,
    },
    create: {
      id: demoId("vehicle", "tour-van"),
      workspaceId: workspace.id,
      userId: owner.id,
      name: "Neon Vultures Tour Van",
      vehicleMode: VehicleMode.DRIVE,
      enableBusinessSplit: true,
      registration: "NV 2026",
      fuelType: "Diesel",
      notes: "Demo logistics vehicle for the Neon Vultures east coast run.",
      isDefault: true,
      startingOdometer: 84210,
      defaultUse: LogUseType.BUSINESS,
    },
  });

  const tour = await prisma.tour.upsert({
    where: { slug: tourSlug },
    update: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      title: "Neon Vultures - East Coast Run 2026",
      description: [
        "Band: Neon Vultures",
        "Genre: Alt-rock / electronic rock",
        "Origin: Melbourne, AU",
        "Tagline: Dark circuits. Loud rooms.",
        "Tour type: National headline tour",
        "A 10-date east coast run across major Australian venues, blending headline shows with select festival appearances.",
      ].join("\n"),
      startDate: localDateTime("2026-03-12", "09:00"),
      endDate: localDateTime("2026-04-10", "23:30", "+08:00"),
      status: JourneyStatus.ACTIVE,
      visibility: Visibility.PUBLIC,
      coverImageUrl: null,
    },
    create: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      slug: tourSlug,
      title: "Neon Vultures - East Coast Run 2026",
      description: [
        "Band: Neon Vultures",
        "Genre: Alt-rock / electronic rock",
        "Origin: Melbourne, AU",
        "Tagline: Dark circuits. Loud rooms.",
        "Tour type: National headline tour",
        "A 10-date east coast run across major Australian venues, blending headline shows with select festival appearances.",
      ].join("\n"),
      startDate: localDateTime("2026-03-12", "09:00"),
      endDate: localDateTime("2026-04-10", "23:30", "+08:00"),
      status: JourneyStatus.ACTIVE,
      visibility: Visibility.PUBLIC,
      coverImageUrl: null,
    },
  });

  const createdGigs = [];

  for (const [index, gig] of gigs.entries()) {
    const arrivalDate = localDateTime(gig.date, "12:00", gig.offset);
    const departureDate = localDateTime(gig.date, "23:30", gig.offset);
    const description = [
      `City: ${gig.city}`,
      `Venue: ${gig.venue}`,
      `Demo status: ${gig.status}`,
      "GigEze currently has no Gig status field, so this demo status is stored in the description.",
    ].join("\n");

    const createdGig = await prisma.gig.upsert({
      where: { id: demoId("gig", gig.slug) },
      update: {
        workspaceId: workspace.id,
        journeyId: tour.id,
        createdByUserId: owner.id,
        title: gig.title,
        description,
        latitude: gig.latitude,
        longitude: gig.longitude,
        locationName: `${gig.venue}, ${gig.city}`,
        arrivalDate,
        departureDate,
        visibility: Visibility.PUBLIC,
        orderIndex: index + 1,
      },
      create: {
        id: demoId("gig", gig.slug),
        workspaceId: workspace.id,
        journeyId: tour.id,
        createdByUserId: owner.id,
        title: gig.title,
        description,
        latitude: gig.latitude,
        longitude: gig.longitude,
        locationName: `${gig.venue}, ${gig.city}`,
        arrivalDate,
        departureDate,
        visibility: Visibility.PUBLIC,
        orderIndex: index + 1,
      },
    });

    createdGigs.push(createdGig);
  }

  for (const [index, [note, type, durationMinutes]] of activityNotes.entries()) {
    const gig = gigs[index];
    const createdGig = createdGigs[index];

    await prisma.activityNote.upsert({
      where: { id: demoId("activity-note", gig.slug) },
      update: {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: tour.id,
        stopId: createdGig.id,
        type,
        date: localDateTime(gig.date, "17:15", gig.offset),
        durationMinutes,
        location: `${gig.venue}, ${gig.city}`,
        notes: note,
        visibility: Visibility.SHARED,
      },
      create: {
        id: demoId("activity-note", gig.slug),
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: tour.id,
        stopId: createdGig.id,
        type,
        date: localDateTime(gig.date, "17:15", gig.offset),
        durationMinutes,
        location: `${gig.venue}, ${gig.city}`,
        notes: note,
        visibility: Visibility.SHARED,
      },
    });
  }

  for (const trip of trips) {
    const drivingLog = await prisma.drivingLog.upsert({
      where: { id: demoId("driving-log", trip.id) },
      update: {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: tour.id,
        tripMode: TripMode.DRIVE,
        vehicleId: vehicle.id,
        date: localDateTime(trip.date, "08:00"),
        startTime: localDateTime(trip.date, "08:00"),
        endTime: localDateTime(trip.date, "17:30"),
        startLocation: trip.start,
        endLocation: trip.end,
        startOdometer: trip.startOdometer,
        endOdometer: trip.startOdometer + trip.km,
        businessKm: trip.km,
        personalKm: 0,
        purpose: trip.purpose,
        hasRouteSamples: true,
        notes: "Demo trip log with compact GPS waypoints for route preview maps. Mobile sync status from the source dataset is intentionally not stored because DrivingLog has no sync-state field.",
        deletedAt: null,
      },
      create: {
        id: demoId("driving-log", trip.id),
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: tour.id,
        tripMode: TripMode.DRIVE,
        vehicleId: vehicle.id,
        date: localDateTime(trip.date, "08:00"),
        startTime: localDateTime(trip.date, "08:00"),
        endTime: localDateTime(trip.date, "17:30"),
        startLocation: trip.start,
        endLocation: trip.end,
        startOdometer: trip.startOdometer,
        endOdometer: trip.startOdometer + trip.km,
        businessKm: trip.km,
        personalKm: 0,
        purpose: trip.purpose,
        hasRouteSamples: true,
        notes: "Demo trip log with compact GPS waypoints for route preview maps. Mobile sync status from the source dataset is intentionally not stored because DrivingLog has no sync-state field.",
      },
    });

    await upsertRouteSamples(drivingLog.id, trip);
  }

  for (const story of stories) {
    const linkedGig = createdGigs[story.gigIndex] ?? null;

    await prisma.publicPost.upsert({
      where: { slug: story.slug },
      update: {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        title: story.title,
        excerpt: story.excerpt,
        content: story.content,
        status: story.status,
        visibility: story.visibility,
        coverImageUrl: null,
        publishedAt: story.publishedAt,
        journeyId: tour.id,
        stopId: linkedGig?.id ?? null,
      },
      create: {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        slug: story.slug,
        title: story.title,
        excerpt: story.excerpt,
        content: story.content,
        status: story.status,
        visibility: story.visibility,
        coverImageUrl: null,
        publishedAt: story.publishedAt,
        journeyId: tour.id,
        stopId: linkedGig?.id ?? null,
      },
    });
  }

  const tasmaniaTour = await prisma.tour.upsert({
    where: { slug: tasmaniaTourSlug },
    update: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      title: "Neon Vultures - Tasmania Circuit 2026",
      description: [
        "Band: Neon Vultures",
        "Genre: Alt-rock / electronic rock",
        "Origin: Melbourne, AU",
        "Tagline: Dark circuits. Loud rooms.",
        "Tour type: Regional island headline run",
        "A compact Tasmania circuit across Hobart, Launceston, the north-west, the west coast, and the east coast.",
      ].join("\n"),
      startDate: localDateTime("2026-06-05", "09:00", "+10:00"),
      endDate: localDateTime("2026-06-17", "23:30", "+10:00"),
      status: JourneyStatus.PLANNED,
      visibility: Visibility.PUBLIC,
      coverImageUrl: null,
    },
    create: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      slug: tasmaniaTourSlug,
      title: "Neon Vultures - Tasmania Circuit 2026",
      description: [
        "Band: Neon Vultures",
        "Genre: Alt-rock / electronic rock",
        "Origin: Melbourne, AU",
        "Tagline: Dark circuits. Loud rooms.",
        "Tour type: Regional island headline run",
        "A compact Tasmania circuit across Hobart, Launceston, the north-west, the west coast, and the east coast.",
      ].join("\n"),
      startDate: localDateTime("2026-06-05", "09:00", "+10:00"),
      endDate: localDateTime("2026-06-17", "23:30", "+10:00"),
      status: JourneyStatus.PLANNED,
      visibility: Visibility.PUBLIC,
      coverImageUrl: null,
    },
  });

  const createdTasmaniaGigs = [];

  for (const [index, gig] of tasmaniaGigs.entries()) {
    const arrivalDate = localDateTime(gig.date, "12:00", gig.offset);
    const departureDate = localDateTime(gig.date, "23:30", gig.offset);
    const description = [
      `City: ${gig.city}`,
      `Venue: ${gig.venue}`,
      `Demo status: ${gig.status}`,
      "GigEze currently has no Gig status field, so this demo status is stored in the description.",
    ].join("\n");

    const createdGig = await prisma.gig.upsert({
      where: { id: demoId("gig", gig.slug) },
      update: {
        workspaceId: workspace.id,
        journeyId: tasmaniaTour.id,
        createdByUserId: owner.id,
        title: gig.title,
        description,
        latitude: gig.latitude,
        longitude: gig.longitude,
        locationName: `${gig.venue}, ${gig.city}`,
        arrivalDate,
        departureDate,
        visibility: Visibility.PUBLIC,
        orderIndex: index + 1,
      },
      create: {
        id: demoId("gig", gig.slug),
        workspaceId: workspace.id,
        journeyId: tasmaniaTour.id,
        createdByUserId: owner.id,
        title: gig.title,
        description,
        latitude: gig.latitude,
        longitude: gig.longitude,
        locationName: `${gig.venue}, ${gig.city}`,
        arrivalDate,
        departureDate,
        visibility: Visibility.PUBLIC,
        orderIndex: index + 1,
      },
    });

    createdTasmaniaGigs.push(createdGig);
  }

  for (const [index, [note, type, durationMinutes]] of tasmaniaActivityNotes.entries()) {
    const gig = tasmaniaGigs[index];
    const createdGig = createdTasmaniaGigs[index];

    await prisma.activityNote.upsert({
      where: { id: demoId("activity-note", gig.slug) },
      update: {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: tasmaniaTour.id,
        stopId: createdGig.id,
        type,
        date: localDateTime(gig.date, "17:15", gig.offset),
        durationMinutes,
        location: `${gig.venue}, ${gig.city}`,
        notes: note,
        visibility: Visibility.SHARED,
      },
      create: {
        id: demoId("activity-note", gig.slug),
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: tasmaniaTour.id,
        stopId: createdGig.id,
        type,
        date: localDateTime(gig.date, "17:15", gig.offset),
        durationMinutes,
        location: `${gig.venue}, ${gig.city}`,
        notes: note,
        visibility: Visibility.SHARED,
      },
    });
  }

  for (const trip of tasmaniaTrips) {
    const drivingLog = await prisma.drivingLog.upsert({
      where: { id: demoId("driving-log", trip.id) },
      update: {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: tasmaniaTour.id,
        tripMode: TripMode.DRIVE,
        vehicleId: vehicle.id,
        date: localDateTime(trip.date, "08:30", "+10:00"),
        startTime: localDateTime(trip.date, "08:30", "+10:00"),
        endTime: localDateTime(trip.date, "14:15", "+10:00"),
        startLocation: trip.start,
        endLocation: trip.end,
        startOdometer: trip.startOdometer,
        endOdometer: trip.startOdometer + trip.km,
        businessKm: trip.km,
        personalKm: 0,
        purpose: trip.purpose,
        hasRouteSamples: true,
        notes: "Tasmania demo trip log with compact GPS waypoints for route preview maps. Mobile sync status is intentionally not stored because DrivingLog has no sync-state field.",
        deletedAt: null,
      },
      create: {
        id: demoId("driving-log", trip.id),
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: tasmaniaTour.id,
        tripMode: TripMode.DRIVE,
        vehicleId: vehicle.id,
        date: localDateTime(trip.date, "08:30", "+10:00"),
        startTime: localDateTime(trip.date, "08:30", "+10:00"),
        endTime: localDateTime(trip.date, "14:15", "+10:00"),
        startLocation: trip.start,
        endLocation: trip.end,
        startOdometer: trip.startOdometer,
        endOdometer: trip.startOdometer + trip.km,
        businessKm: trip.km,
        personalKm: 0,
        purpose: trip.purpose,
        hasRouteSamples: true,
        notes: "Tasmania demo trip log with compact GPS waypoints for route preview maps. Mobile sync status is intentionally not stored because DrivingLog has no sync-state field.",
      },
    });

    await upsertRouteSamples(drivingLog.id, trip);
  }

  for (const story of tasmaniaStories) {
    const linkedGig = createdTasmaniaGigs[story.gigIndex] ?? null;

    await prisma.publicPost.upsert({
      where: { slug: story.slug },
      update: {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        title: story.title,
        excerpt: story.excerpt,
        content: story.content,
        status: story.status,
        visibility: story.visibility,
        coverImageUrl: null,
        publishedAt: story.publishedAt,
        journeyId: tasmaniaTour.id,
        stopId: linkedGig?.id ?? null,
      },
      create: {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        slug: story.slug,
        title: story.title,
        excerpt: story.excerpt,
        content: story.content,
        status: story.status,
        visibility: story.visibility,
        coverImageUrl: null,
        publishedAt: story.publishedAt,
        journeyId: tasmaniaTour.id,
        stopId: linkedGig?.id ?? null,
      },
    });
  }

  const counts = {
    gigs: await prisma.gig.count({ where: { journeyId: tour.id } }),
    activityNotes: await prisma.activityNote.count({ where: { journeyId: tour.id } }),
    drivingLogs: await prisma.drivingLog.count({ where: { journeyId: tour.id } }),
    gpsSamples: await prisma.drivingLogGpsSample.count({
      where: {
        drivingLog: {
          journeyId: tour.id,
        },
      },
    }),
    stories: await prisma.publicPost.count({ where: { journeyId: tour.id } }),
    tasmaniaGigs: await prisma.gig.count({ where: { journeyId: tasmaniaTour.id } }),
    tasmaniaActivityNotes: await prisma.activityNote.count({ where: { journeyId: tasmaniaTour.id } }),
    tasmaniaDrivingLogs: await prisma.drivingLog.count({ where: { journeyId: tasmaniaTour.id } }),
    tasmaniaGpsSamples: await prisma.drivingLogGpsSample.count({
      where: {
        drivingLog: {
          journeyId: tasmaniaTour.id,
        },
      },
    }),
    tasmaniaStories: await prisma.publicPost.count({ where: { journeyId: tasmaniaTour.id } }),
  };

  console.log(`Neon Vultures tour upserted: ${tour.title} (${tour.slug})`);
  console.log(`Gigs created/updated for tour: ${counts.gigs}`);
  console.log(`Activity notes created/updated for tour: ${counts.activityNotes}`);
  console.log(`Trip/field driving logs created/updated for tour: ${counts.drivingLogs}`);
  console.log(`GPS route samples created/updated for tour: ${counts.gpsSamples}`);
  console.log(`Stories created/updated for tour: ${counts.stories}`);
  console.log(`Tasmania tour upserted: ${tasmaniaTour.title} (${tasmaniaTour.slug})`);
  console.log(`Tasmania gigs created/updated for tour: ${counts.tasmaniaGigs}`);
  console.log(`Tasmania activity notes created/updated for tour: ${counts.tasmaniaActivityNotes}`);
  console.log(`Tasmania trip/field driving logs created/updated for tour: ${counts.tasmaniaDrivingLogs}`);
  console.log(`Tasmania GPS route samples created/updated for tour: ${counts.tasmaniaGpsSamples}`);
  console.log(`Tasmania stories created/updated for tour: ${counts.tasmaniaStories}`);
  console.log("Media metadata intentionally skipped: Media.filePath requires a real storage object/path.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

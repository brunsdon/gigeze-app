import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, JourneyStatus, Visibility, WorkspaceRole } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

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

function getSeedAuthConfig() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    password: process.env.SEED_ADMIN_PASSWORD?.trim(),
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
    update: { fullName: seedAdminFullName },
    create: {
      email: seedAdminEmail,
      fullName: seedAdminFullName,
    },
  });

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: seedAdminEmail },
    select: { id: true, email: true, fullName: true },
  });

  const workspace = await prisma.workspace.upsert({
    where: { ownerUserId: owner.id },
    update: { name: `${seedAdminFullName}'s Workspace`, slug: "admin-workspace" },
    create: {
      ownerUserId: owner.id,
      name: `${seedAdminFullName}'s Workspace`,
      slug: "admin-workspace",
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

  const Tour = await prisma.Tour.upsert({
    where: { slug: "nsw-coast-run" },
    update: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      title: "NSW Coast Run",
      description: "Early-season trip with mixed remote-work and travel days.",
      status: JourneyStatus.ACTIVE,
      visibility: Visibility.PUBLIC,
      startDate: new Date("2026-03-20"),
    },
    create: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      slug: "nsw-coast-run",
      title: "NSW Coast Run",
      description: "Early-season trip with mixed remote-work and travel days.",
      status: JourneyStatus.ACTIVE,
      visibility: Visibility.PUBLIC,
      startDate: new Date("2026-03-20"),
    },
  });

  await prisma.Gig.deleteMany({ where: { journeyId: Tour.id } });

  await prisma.Gig.createMany({
    data: [
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        title: "Byron Bay",
        description: "Overnight Gig near the lighthouse and beach trail.",
        latitude: -28.647367,
        longitude: 153.602005,
        locationName: "Byron Bay, NSW",
        visibility: Visibility.PUBLIC,
        orderIndex: 1,
        arrivalDate: new Date("2026-03-21"),
      },
      {
        workspaceId: workspace.id,
        createdByUserId: owner.id,
        journeyId: Tour.id,
        title: "Coffs Harbour",
        description: "Refuel, supply run, and remote work catch-up.",
        latitude: -30.296244,
        longitude: 153.114939,
        locationName: "Coffs Harbour, NSW",
        visibility: Visibility.PUBLIC,
        orderIndex: 2,
        arrivalDate: new Date("2026-03-23"),
      },
    ],
  });

  await prisma.drivingLog.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      journeyId: Tour.id,
      date: new Date("2026-03-22"),
      startLocation: "Byron Bay",
      endLocation: "Coffs Harbour",
      startOdometer: 122450,
      endOdometer: 122692,
      businessKm: 60,
      personalKm: 182,
      notes: "Steady drive with one fuel Gig.",
    },
  });

  await prisma.activityNote.create({
    data: {
      workspaceId: workspace.id,
      createdByUserId: owner.id,
      journeyId: Tour.id,
      type: "WORK",
      date: new Date("2026-03-24"),
      durationMinutes: 270,
      location: "Coffs Harbour Library",
      notes: "Client planning and weekly review.",
      visibility: "PRIVATE",
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

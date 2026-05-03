import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getServerEnv } from "@/lib/env";
import { isDatabaseConnectionError } from "@/lib/db/errors";

const env = getServerEnv();
const TRANSIENT_DB_MAX_RETRIES = 2;
const TRANSIENT_DB_BASE_DELAY_MS = 120;
const DEFAULT_POOL_MAX = process.env.NODE_ENV === "production" ? 1 : 5;
let statementCounter = 0;

function resolvePoolMax() {
  const configured = Number(process.env.DATABASE_POOL_MAX);

  if (Number.isInteger(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_POOL_MAX;
}

function resolvePgConnectionString(databaseUrl: string): string {
  let resolvedUrl = databaseUrl;

  if (databaseUrl.startsWith("prisma+postgres://")) {
    const prismaUrl = new URL(databaseUrl);
    const apiKey = prismaUrl.searchParams.get("api_key");

    if (apiKey) {
      try {
        const parts = apiKey.split(".");
        const encodedPayload = parts.length >= 2 ? parts[1] : apiKey;
        const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as {
          databaseUrl?: string;
        };

        if (payload.databaseUrl?.trim()) {
          resolvedUrl = payload.databaseUrl.trim();
        }
      } catch {
        // If token parsing fails, fall back to protocol normalization below.
      }
    }

    if (resolvedUrl === databaseUrl) {
      const normalizedProtocolUrl = new URL(databaseUrl);
      normalizedProtocolUrl.protocol = "postgres:";
      resolvedUrl = normalizedProtocolUrl.toString();
    }
  }

  const normalized = new URL(resolvedUrl);
  if (normalized.hostname === "localhost") {
    normalized.hostname = "127.0.0.1";
  }

  if (normalized.hostname.endsWith(".pooler.supabase.com") && normalized.port === "5432") {
    normalized.port = "6543";
    normalized.searchParams.set("pgbouncer", "true");
  }

  return normalized.toString();
}

function isLocalPrismaDevTcpUrl(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    const port = Number(url.port);

    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      Number.isFinite(port) &&
      port >= 51200 &&
      port <= 51300
    );
  } catch {
    return false;
  }
}

function getAdapterOptions(databaseUrl: string) {
  if (!isLocalPrismaDevTcpUrl(databaseUrl)) {
    return undefined;
  }

  const statementPrefix = Date.now().toString(36);

  return {
    statementNameGenerator: () => `ml_${statementPrefix}_${(statementCounter++).toString(36)}`,
  };
}

const connectionString = resolvePgConnectionString(env.DATABASE_URL);
const adapter = new PrismaPg(
  {
    connectionString,
    max: resolvePoolMax(),
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  },
  getAdapterOptions(connectionString),
);

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientDbError(error: unknown) {
  return isDatabaseConnectionError(error);
}

function createPrismaClient() {
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          let retries = 0;

          while (true) {
            try {
              return await query(args);
            } catch (error) {
              if (!isTransientDbError(error) || retries >= TRANSIENT_DB_MAX_RETRIES) {
                throw error;
              }

              retries += 1;
              await wait(TRANSIENT_DB_BASE_DELAY_MS * retries);
            }
          }
        },
      },
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

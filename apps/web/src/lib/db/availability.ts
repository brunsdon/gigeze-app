import net from "node:net";
import { getServerEnv } from "@/lib/env";

const UNAVAILABLE_CACHE_MS = 10_000;
const AVAILABLE_CACHE_MS = 2_000;

let cachedState: { reachable: boolean; checkedAt: number } | null = null;

export function markDatabaseUnavailable() {
  cachedState = { reachable: false, checkedAt: Date.now() };
}

function canProbeViaTcp(databaseUrl: string): { host: string; port: number } | null {
  try {
    const url = new URL(databaseUrl);
    const host = url.hostname;
    const port = Number(url.port || "5432");

    if (!host || Number.isNaN(port)) {
      return null;
    }

    return { host, port };
  } catch {
    return null;
  }
}

async function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    const finalize = (reachable: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finalize(true));
    socket.once("timeout", () => finalize(false));
    socket.once("error", () => finalize(false));
    socket.connect(port, host);
  });
}

export async function isDatabaseReachable() {
  const now = Date.now();

  if (cachedState) {
    const cacheMs = cachedState.reachable ? AVAILABLE_CACHE_MS : UNAVAILABLE_CACHE_MS;
    if (now - cachedState.checkedAt < cacheMs) {
      return cachedState.reachable;
    }
  }

  const { DATABASE_URL } = getServerEnv();
  const target = canProbeViaTcp(DATABASE_URL);

  if (!target) {
    cachedState = { reachable: true, checkedAt: now };
    return true;
  }

  const reachable = await probeTcp(target.host, target.port, 400);
  cachedState = { reachable, checkedAt: now };
  return reachable;
}
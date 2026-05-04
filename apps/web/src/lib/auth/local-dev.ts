import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

const scryptAsync = promisify(scrypt);
const COOKIE_NAME = "gigeze-dev-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PASSWORD_HASH_PREFIX = "scrypt";

type LocalSessionPayload = {
  sub: string;
  email: string;
  name?: string | null;
  iat: number;
  exp: number;
};

export function isLocalDevAuthEnabled() {
  return process.env.NODE_ENV !== "production";
}

function getCookieSecret() {
  return process.env.DEV_AUTH_COOKIE_SECRET ?? process.env.DATABASE_URL ?? "gigeze-local-dev";
}

function sign(value: string) {
  return createHmac("sha256", getCookieSecret()).update(value).digest("base64url");
}

function encodePayload(payload: LocalSessionPayload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function decodePayload(value?: string): LocalSessionPayload | null {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as LocalSessionPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

export async function hashLocalDevPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${PASSWORD_HASH_PREFIX}:${salt}:${derivedKey.toString("base64url")}`;
}

export async function verifyLocalDevPassword(password: string, passwordHash: string | null) {
  if (!passwordHash) {
    return false;
  }

  const [prefix, salt, storedKey] = passwordHash.split(":");
  if (prefix !== PASSWORD_HASH_PREFIX || !salt || !storedKey) {
    return false;
  }

  const storedBuffer = Buffer.from(storedKey, "base64url");
  const derivedKey = (await scryptAsync(password, salt, storedBuffer.length)) as Buffer;

  return storedBuffer.length === derivedKey.length && timingSafeEqual(storedBuffer, derivedKey);
}

export async function createLocalDevSession(user: { id: string; email: string; fullName: string | null }) {
  if (!isLocalDevAuthEnabled()) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const cookieStore = await cookies();

  cookieStore.set({
    name: COOKIE_NAME,
    value: encodePayload({
      sub: user.id,
      email: user.email,
      name: user.fullName,
      iat: now,
      exp: now + SESSION_TTL_SECONDS,
    }),
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearLocalDevSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

async function readLocalDevPayload() {
  if (!isLocalDevAuthEnabled()) {
    return null;
  }

  const cookieStore = await cookies();
  return decodePayload(cookieStore.get(COOKIE_NAME)?.value);
}

export async function getLocalDevSessionUser() {
  const payload = await readLocalDevPayload();

  if (!payload) {
    return null;
  }

  return {
    id: `local-dev:${payload.sub}`,
    email: payload.email,
    user_metadata: {
      full_name: payload.name ?? undefined,
    },
  };
}

export async function getLocalDevCurrentUser() {
  const payload = await readLocalDevPayload();

  if (!payload) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      supabaseAuthUserId: true,
    },
  });
}

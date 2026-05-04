"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPublicSupabaseEnv, isEnvConfigError } from "@/lib/env";
import {
  clearLocalDevSession,
  createLocalDevSession,
  isLocalDevAuthEnabled,
  verifyLocalDevPassword,
} from "@/lib/auth/local-dev";
import { prisma } from "@/lib/db/prisma";

function resolveNextPath(formData: FormData) {
  const nextPath = String(formData.get("next") ?? "").trim();
  return nextPath.startsWith("/") ? nextPath : "/dashboard";
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextPath = resolveNextPath(formData);
  const normalizedEmail = email.toLowerCase();

  if (isLocalDevAuthEnabled()) {
    const localUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        fullName: true,
        localPasswordHash: true,
      },
    });

    if (localUser && (await verifyLocalDevPassword(password, localUser.localPasswordHash))) {
      await createLocalDevSession(localUser);
      redirect(nextPath);
    }
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(nextPath)}`);
    }
  } catch (error) {
    if (isEnvConfigError(error)) {
      redirect("/login?error=auth-config-missing");
    }
    throw error;
  }

  redirect(nextPath);
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const nextPath = resolveNextPath(formData);

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || undefined,
        },
      },
    });

    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}&mode=signup&next=${encodeURIComponent(nextPath)}`);
    }
  } catch (error) {
    if (isEnvConfigError(error)) {
      redirect("/login?error=auth-config-missing&mode=signup");
    }
    throw error;
  }

  redirect(nextPath);
}

export async function logoutAction() {
  if (isLocalDevAuthEnabled()) {
    await clearLocalDevSession();
  }

  if (hasPublicSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}

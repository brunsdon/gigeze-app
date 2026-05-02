"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getErrorMessage, getSuccessMessage } from "@/lib/utils/feedback-messages";

const LAST_SAVED_AT_KEY = "gigeze.lastSavedAt";

export function RouteFeedbackToaster() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (!success && !error) {
      return;
    }

    if (error) {
      toast.error(getErrorMessage(decodeURIComponent(error)));
    }

    if (success) {
      toast.success(getSuccessMessage(success));
      if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
        window.localStorage.setItem(LAST_SAVED_AT_KEY, new Date().toISOString());
        window.dispatchEvent(new Event("gigeze-save-updated"));
      }
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("success");
    next.delete("error");
    const suffix = next.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}

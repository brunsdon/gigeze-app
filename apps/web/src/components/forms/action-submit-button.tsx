"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { type ComponentProps } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-state";

type ActionSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  confirmMessage?: string;
} & ComponentProps<typeof Button>;

export function ActionSubmitButton({
  label,
  pendingLabel,
  confirmMessage,
  onClick,
  ...props
}: ActionSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [showSuccess, setShowSuccess] = useState(false);
  const wasPendingRef = useRef(false);

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }

    if (!wasPendingRef.current) {
      return;
    }

    wasPendingRef.current = false;
    const showTimeout = window.setTimeout(() => {
      setShowSuccess(true);

      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate(12);
      }
    }, 0);

    const hideTimeout = window.setTimeout(() => {
      setShowSuccess(false);
    }, 850);

    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [pending]);

  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {pending ? (
        <>
          <LoadingIndicator size="sm" className="text-current" />
          {pendingLabel ?? "Saving..."}
        </>
      ) : showSuccess ? (
        <>
          <Check className="animate-in zoom-in-75 duration-200" />
          Saved
        </>
      ) : (
        label
      )}
    </Button>
  );
}

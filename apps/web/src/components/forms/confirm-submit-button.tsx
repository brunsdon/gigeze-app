"use client";

import { useId, useState } from "react";
import { type VariantProps } from "class-variance-authority";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type buttonVariants } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-state";

type ConfirmSubmitButtonProps = {
  formId?: string;
  title: string;
  description: string;
  triggerLabel: string;
  confirmLabel?: string;
  confirmVariant?: VariantProps<typeof buttonVariants>["variant"];
  cancelLabel?: string;
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
} & VariantProps<typeof buttonVariants>;

export function ConfirmSubmitButton({
  formId,
  title,
  description,
  triggerLabel,
  confirmLabel = "Confirm",
  confirmVariant = "destructive",
  cancelLabel = "Cancel",
  pendingLabel,
  variant = "destructive",
  size = "sm",
  disabled,
  className,
}: ConfirmSubmitButtonProps) {
  const generatedId = useId();
  const targetFormId = formId ?? generatedId;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = () => {
    if (isSubmitting) {
      return;
    }

    const form = document.getElementById(targetFormId);
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    setIsSubmitting(true);
    form.requestSubmit();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant={variant} size={size} className={className} disabled={disabled || isSubmitting} />}>
        {triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant={confirmVariant}
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <>
                <LoadingIndicator size="sm" className="text-current" />
                {pendingLabel ?? "Working..."}
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
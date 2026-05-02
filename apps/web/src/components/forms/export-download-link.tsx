"use client";

import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button-variants";

type ExportDownloadLinkProps = {
  href: string;
  label?: string;
};

export function ExportDownloadLink({ href, label = "Download CSV" }: ExportDownloadLinkProps) {
  return (
    <a
      href={href}
      className={buttonVariants({ variant: "outline" })}
      onClick={() => {
        toast.success("Driving log exported successfully");
      }}
    >
      {label}
    </a>
  );
}

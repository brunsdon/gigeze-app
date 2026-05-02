import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";

type EmptyStateProps = {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-border/85 bg-card/95 p-9 text-center shadow-[0_1px_2px_rgba(43,42,40,0.05)]">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {ctaLabel && ctaHref ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link href={ctaHref} className={`${buttonVariants({ size: "sm" })} inline-flex`}>
            {ctaLabel}
          </Link>
          {secondaryCtaLabel && secondaryCtaHref ? (
            <Link href={secondaryCtaHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
              {secondaryCtaLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


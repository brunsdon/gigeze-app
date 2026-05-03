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
    <div className="rounded-2xl border border-dashed border-white/18 bg-[#151018]/78 p-9 text-center shadow-[0_18px_44px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <p className="mb-2 text-[0.68rem] font-black tracking-[0.22em] text-[#00E5A8] uppercase">Ready when you are</p>
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


import { cn } from "@/lib/utils";
import { formatPublicAttribution } from "@/lib/public-attribution";

type PublicAttributionProps = {
  source: {
    createdByUser?: {
      fullName: string | null;
      email: string;
    } | null;
    workspace?: {
      name: string;
    } | null;
  };
  prefix?: string;
  className?: string;
};

export function PublicAttribution({
  source,
  prefix = "Shared by",
  className,
}: PublicAttributionProps) {
  const label = formatPublicAttribution(source);

  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {prefix} <span className="font-medium text-foreground/90">{label}</span>
    </p>
  );
}

import { cn } from "@/lib/utils";

type LoadingIndicatorProps = {
  variant?: "spinner" | "hourglass";
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

const sizeClasses = {
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

export function LoadingIndicator({
  variant = "spinner",
  size = "md",
  className,
  label,
}: LoadingIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-muted-foreground", className)} role="status" aria-live="polite">
      {variant === "spinner" ? (
        <span
          aria-hidden="true"
          className={cn(
            "rounded-full border-2 border-muted-foreground/25 border-t-primary motion-safe:animate-spin motion-reduce:animate-none",
            sizeClasses[size],
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex items-center justify-center text-primary",
            size === "sm" && "text-xs",
            size === "md" && "text-sm",
            size === "lg" && "text-base",
          )}
        >
          ⌛
        </span>
      )}
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Loading</span>}
    </span>
  );
}

type LoadingSkeletonProps = {
  className?: string;
};

export function LoadingSkeleton({ className }: LoadingSkeletonProps) {
  return <div aria-hidden="true" className={cn("rounded-md bg-muted/65 skeleton-shimmer", className)} />;
}

type LoadingMessageProps = {
  label?: string;
  variant?: "spinner" | "hourglass";
  className?: string;
};

export function LoadingMessage({ label = "Loading...", variant = "spinner", className }: LoadingMessageProps) {
  return (
    <div className={cn("flex items-center justify-center py-10", className)}>
      <LoadingIndicator variant={variant} label={label} />
    </div>
  );
}

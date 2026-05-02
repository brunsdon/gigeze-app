import { cn } from "@/lib/utils";

type LogoVariant = "full" | "icon";
type LogoSize = "sm" | "md" | "lg";

type LogoProps = {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  "aria-label"?: string;
};

const PRIMARY = "#2f5d50";
const ACCENT = "#c96f3b";

const sizeClassMap: Record<LogoVariant, Record<LogoSize, string>> = {
  full: {
    sm: "h-7 w-auto",
    md: "h-9 w-auto",
    lg: "h-11 w-auto",
  },
  icon: {
    sm: "h-7 w-7",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  },
};

function LogoSymbol() {
  return (
    <g>
      <line x1="5" y1="7" x2="39" y2="7" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 29 C 10 23, 18 21, 26 22 C 34 23, 39 27, 42 31" fill="none" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
      <rect x="8" y="11" width="26" height="13" rx="4" fill={PRIMARY} />
      <path d="M20 11 H31 C 33.2 11 35 12.8 35 15 V24 H20 Z" fill={PRIMARY} />
      <rect x="11" y="13" width="7" height="5" rx="1.4" fill="white" opacity="0.92" />
      <rect x="20" y="13" width="9" height="5" rx="1.4" fill="white" opacity="0.9" />
      <circle cx="14.5" cy="24" r="3.1" fill="currentColor" />
      <circle cx="28.5" cy="24" r="3.1" fill="currentColor" />
      <circle cx="14.5" cy="24" r="1.2" fill="white" opacity="0.92" />
      <circle cx="28.5" cy="24" r="1.2" fill="white" opacity="0.92" />
      <path d="M35 16.3 L39.2 18.6 V24 H35 Z" fill={ACCENT} opacity="0.95" />
    </g>
  );
}

export function Logo({ variant = "full", size = "md", className, "aria-label": ariaLabel }: LogoProps) {
  const label = ariaLabel ?? "GigEze";

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 44 34"
        className={cn("shrink-0", sizeClassMap.icon[size], className)}
        role="img"
        aria-label={label}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>{label}</title>
        <LogoSymbol />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 200 34"
      className={cn("shrink-0", sizeClassMap.full[size], className)}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      <g transform="translate(0 0)">
        <LogoSymbol />
      </g>
      <text x="52" y="23" fill="currentColor" fontSize="17" fontWeight="750" letterSpacing="0.02em">
        GigEze
      </text>
    </svg>
  );
}

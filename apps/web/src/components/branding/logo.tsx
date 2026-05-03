import { cn } from "@/lib/utils";

type LogoVariant = "full" | "icon";
type LogoSize = "sm" | "md" | "lg";

type LogoProps = {
  variant?: LogoVariant;
  size?: LogoSize;
  className?: string;
  "aria-label"?: string;
};

const PRIMARY = "#FF2E63";
const ACCENT = "#FFB000";
const CREAM = "#fffdf7";
const STAGE = "#211A28";

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
      <path d="M6 35 C 12 30, 17 38, 23 33 C 29 28, 32 23, 38 18" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 3.8 C 13.4 3.8, 7 10.1, 7 18.5 C 7 29.8, 22 41, 22 41 C 22 41, 37 29.8, 37 18.5 C 37 10.1, 30.6 3.8, 22 3.8 Z" fill={PRIMARY} />
      <circle cx="22" cy="18.7" r="11.2" fill={CREAM} opacity="0.95" />
      <path d="M15.4 23.2 L19.1 11.6" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22 22.7 L22 10.4" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M28.6 23.2 L24.9 11.6" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="22" cy="17.2" r="2.1" fill={STAGE} />
      <path d="M15 25.2 H29 C 30.3 25.2 31.4 26.3 31.4 27.6 V28.2 H12.6 V27.6 C 12.6 26.3 13.7 25.2 15 25.2 Z" fill={STAGE} />
      <rect x="14.8" y="21.2" width="14.4" height="4.8" rx="1.7" fill={STAGE} />
      <circle cx="17.4" cy="23.6" r="0.9" fill={CREAM} opacity="0.9" />
      <circle cx="22" cy="23.6" r="0.9" fill={CREAM} opacity="0.9" />
      <circle cx="26.6" cy="23.6" r="0.9" fill={CREAM} opacity="0.9" />
    </g>
  );
}

export function Logo({ variant = "full", size = "md", className, "aria-label": ariaLabel }: LogoProps) {
  const label = ariaLabel ?? "GigEze";

  if (variant === "icon") {
    return (
      <svg
        viewBox="0 0 44 44"
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
      viewBox="0 0 212 44"
      className={cn("shrink-0", sizeClassMap.full[size], className)}
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      <g transform="translate(0 0)">
        <LogoSymbol />
      </g>
      <text x="54" y="28.5" fill="currentColor" fontSize="18.5" fontWeight="750" letterSpacing="0.02em">
        GigEze
      </text>
    </svg>
  );
}

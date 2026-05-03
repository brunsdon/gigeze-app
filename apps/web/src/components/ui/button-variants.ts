import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap shadow-[0_1px_0_rgba(255,255,255,0.16)] transition-[background-color,border-color,color,box-shadow,transform] duration-200 outline-none select-none focus-visible:border-primary/65 focus-visible:ring-3 focus-visible:ring-primary/30 active:not-aria-[haspopup]:translate-y-px active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 aria-disabled:cursor-not-allowed dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_10px_26px_rgba(255,46,99,0.32)] hover:-translate-y-0.5 hover:bg-[#ff4778] hover:shadow-[0_16px_34px_rgba(255,46,99,0.42)] active:bg-[#d91f52]",
        accent: "bg-accent text-accent-foreground shadow-[0_10px_24px_rgba(255,176,0,0.22)] hover:-translate-y-0.5 hover:bg-[#ffc247] hover:shadow-[0_14px_30px_rgba(255,176,0,0.28)] active:bg-accent/85",
        outline:
          "border-border bg-card text-foreground/92 hover:-translate-y-0.5 hover:border-primary/55 hover:bg-muted/70 hover:text-foreground hover:shadow-[0_10px_24px_rgba(255,46,99,0.16)] active:bg-muted/80 aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:-translate-y-0.5 hover:bg-[#2b2134] hover:shadow-[0_10px_24px_rgba(0,0,0,0.3)] active:bg-secondary/92 aria-expanded:bg-secondary/90 aria-expanded:text-secondary-foreground",
        ghost:
          "text-foreground/82 hover:bg-muted hover:text-foreground active:bg-muted/85 aria-expanded:bg-muted/80 aria-expanded:text-foreground",
        destructive: "bg-destructive text-white hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-[0_10px_24px_rgba(255,46,99,0.26)] active:bg-destructive/86 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-primary underline-offset-4 hover:underline hover:text-[#ff7598]",
      },
      size: {
        default:
          "h-11 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-10 gap-1.5 rounded-lg px-3.5 text-[0.875rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

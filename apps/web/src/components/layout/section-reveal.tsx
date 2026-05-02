"use client";

import { useEffect, useRef, useState } from "react";

type SectionRevealProps = {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
};

export function SectionReveal({ children, className, delayMs = 0 }: SectionRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }

        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.15 },
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: "opacity 220ms ease, transform 220ms ease",
        transitionDelay: `${delayMs}ms`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(10px)",
      }}
    >
      {children}
    </div>
  );
}

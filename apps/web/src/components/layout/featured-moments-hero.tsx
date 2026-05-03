"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PublicMediaPreview } from "@/components/gallery/public-media-card";
import type { HomepageHeroSlide } from "@/features/media/homepage-hero";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

const ROTATION_INTERVAL_MS = 6000;

type FeaturedMomentsHeroProps = {
  slides: HomepageHeroSlide[];
  className?: string;
};

export function FeaturedMomentsHero({ slides, className }: FeaturedMomentsHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedSlideIndexes, setFailedSlideIndexes] = useState<number[]>([]);

  const slideCount = slides.length;
  const hasMultipleSlides = slideCount > 1;

  const nextSlide = () => {
    setActiveIndex((current) => (current + 1) % slideCount);
  };

  const previousSlide = () => {
    setActiveIndex((current) => (current - 1 + slideCount) % slideCount);
  };

  useEffect(() => {
    if (!hasMultipleSlides || isPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slideCount);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [hasMultipleSlides, isPaused, slideCount]);

  const nextSlideImage = useMemo(() => {
    if (!hasMultipleSlides) {
      return null;
    }

    const nextIndex = (activeIndex + 1) % slideCount;
    return slides[nextIndex]?.imageUrl ?? null;
  }, [activeIndex, hasMultipleSlides, slideCount, slides]);

  useEffect(() => {
    if (!nextSlideImage) {
      return;
    }

    const preloaded = new window.Image();
    preloaded.src = nextSlideImage;
  }, [nextSlideImage]);

  if (!slideCount) {
    return null;
  }

  const activeSlide = slides[activeIndex] ?? null;

  return (
    <div
      className={cn("relative overflow-hidden rounded-xl border border-border/80 bg-muted/30 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]", className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      aria-label="Featured moments from the tour"
    >
      <div className="relative h-50 sm:h-68 lg:h-84">
        {hasMultipleSlides ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-0.5 bg-black/45">
            <div
              key={`progress-${activeIndex}`}
              className="h-full origin-left animate-hero-progress bg-primary-foreground/85"
              style={{
                animationDuration: `${ROTATION_INTERVAL_MS}ms`,
                animationPlayState: isPaused ? "paused" : "running",
              }}
            />
          </div>
        ) : null}

        {slides.map((slide, index) => {
          const isActive = activeIndex === index;
          const shouldUseFallbackImage = failedSlideIndexes.includes(index);

          return (
            <div
              key={slide.id}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-out",
                isActive ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              aria-hidden={isActive ? undefined : true}
            >
              {slide.media && !shouldUseFallbackImage ? (
                <PublicMediaPreview
                  item={slide.media}
                  context="hero"
                  displaySize="medium"
                  width={1200}
                  height={700}
                  resize="cover"
                  sizes="(max-width: 1024px) 100vw, 32vw"
                  priority={index === 0}
                  className={cn(
                    "h-full w-full object-cover transition-transform duration-6000 ease-linear",
                    isActive ? "scale-[1.05]" : "scale-100",
                  )}
                  placeholderLabel="Featured moment unavailable."
                  onAllSourcesFailed={() => {
                    setFailedSlideIndexes((current) =>
                      current.includes(index) ? current : [...current, index]);
                  }}
                />
              ) : (
                <Image
                  src={shouldUseFallbackImage ? slide.fallbackSrc : slide.imageUrl}
                  alt={slide.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 32vw"
                  className={cn(
                    "object-cover transition-transform duration-6000 ease-linear",
                    isActive ? "scale-[1.05]" : "scale-100",
                  )}
                  priority={index === 0}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(156deg,rgba(11,11,15,0.22),rgba(33,26,40,0.28)_42%,rgba(11,11,15,0.78)_100%)]" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_76%_16%,rgba(255,176,0,0.2),transparent_35%),radial-gradient(circle_at_20%_8%,rgba(255,46,99,0.18),transparent_34%)]" />
            </div>
          );
        })}

        <div className="absolute inset-x-0 bottom-0 z-20 p-4 sm:p-5">
          <p className="text-[11px] font-bold tracking-[0.2em] text-accent uppercase">Featured backstage moment</p>
          <h2 className="mt-2 text-lg leading-tight font-black text-primary-foreground sm:text-xl">{activeSlide?.title}</h2>
          {activeSlide?.subtitle ? <p className="mt-1 text-sm leading-relaxed text-primary-foreground/88">{activeSlide.subtitle}</p> : null}
          <p className="mt-2 text-xs text-primary-foreground/82">{activeSlide?.attribution}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <Link
              href={activeSlide?.href || "/Tours"}
              className={buttonVariants({ size: "sm", variant: "secondary" })}
            >
              {activeSlide?.ctaLabel || "Explore this moment"}
            </Link>
            {activeSlide?.journeyTitle ? (
              <span className="inline-flex rounded-full border border-primary-foreground/35 bg-primary-foreground/14 px-2.5 py-1 text-xs text-primary-foreground">
                {activeSlide.journeyTitle}
              </span>
            ) : null}
          </div>
        </div>

        {hasMultipleSlides ? (
          <div className="absolute inset-x-0 top-3 z-20 flex items-center justify-between px-3 sm:px-4">
            <button
              type="button"
              onClick={previousSlide}
              className="inline-flex size-10 items-center justify-center rounded-full border border-primary-foreground/38 bg-black/24 text-primary-foreground transition-colors hover:bg-black/34 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/65"
              aria-label="Previous featured moment"
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <span className="inline-flex rounded-full border border-primary-foreground/42 bg-black/24 px-2.5 py-1 text-[11px] font-medium text-primary-foreground/90">
              {activeIndex + 1} of {slideCount}
            </span>
            <button
              type="button"
              onClick={nextSlide}
              className="inline-flex size-10 items-center justify-center rounded-full border border-primary-foreground/38 bg-black/24 text-primary-foreground transition-colors hover:bg-black/34 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/65"
              aria-label="Next featured moment"
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        ) : null}
      </div>

      {hasMultipleSlides ? (
        <div className="absolute inset-x-0 bottom-3 z-30 flex items-center justify-center gap-2">
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={`${slide.id}-dot`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70",
                  isActive
                    ? "scale-105 border-primary-foreground bg-primary-foreground"
                    : "border-primary-foreground/60 bg-primary-foreground/35 hover:bg-primary-foreground/55",
                )}
                aria-label={`Show featured moment ${index + 1}`}
                aria-current={isActive ? "true" : undefined}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* eslint-disable @next/next/no-img-element */

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("next/image", () => ({
  default: ({ src, alt, onError }: { src: string; alt?: string; onError?: () => void }) => (
    <img src={src} alt={alt} onError={onError} />
  ),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabasePublicEnv: () => ({
    url: "https://project.supabase.co",
    anonKey: "anon-key",
  }),
}));

vi.mock("@/components/gallery/shared-media-lightbox", () => ({
  SharedMediaLightbox: () => null,
}));

import { SharedMediaGrid } from "@/components/gallery/shared-media-grid";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("SharedMediaGrid", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
  });

  it("uses the same render-to-raw-to-placeholder flow and never promotes file names to visible titles", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    if (!root) {
      throw new Error("React root not initialized");
    }

    const reactRoot = root;

    await act(async () => {
      reactRoot.render(
        <SharedMediaGrid
          workspaceSlug="shared-space"
          items={[
            {
              id: "media-1",
              filePath: "Tours/coast/download.jpg",
              fileName: "download.jpg",
              publicUrl: "https://project.supabase.co/storage/v1/object/public/media/Tours/coast/download.jpg",
              mimeType: "image/jpeg",
              caption: null,
              createdAt: new Date("2026-04-07T00:00:00.000Z"),
              visibility: "SHARED",
              Tour: null,
              Gig: null,
            },
          ]}
        />,
      );
    });

    let image = container.querySelector("img");
    expect(image?.getAttribute("src")).toContain("/storage/v1/render/image/public/");
    expect(container.textContent).toContain("Untitled media");
    expect(container.textContent).not.toContain("download.jpg");

    await act(async () => {
      image?.dispatchEvent(new Event("error"));
    });

    image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://project.supabase.co/storage/v1/object/public/media/Tours/coast/download.jpg");

    await act(async () => {
      image?.dispatchEvent(new Event("error"));
    });

    expect(container.textContent).toContain("Preview unavailable");
    expect(container.textContent).toContain("Tour: This content is private or not shared with you.");
  });
});

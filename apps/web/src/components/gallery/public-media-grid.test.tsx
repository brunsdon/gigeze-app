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

vi.mock("@/components/gallery/public-media-lightbox", () => ({
  PublicMediaLightbox: () => null,
}));

import { PublicMediaGrid } from "@/components/gallery/public-media-grid";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("PublicMediaGrid", () => {
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

  it("falls back from transformed Supabase preview URL to raw URL and then to placeholder", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    if (!root) {
      throw new Error("React root not initialized");
    }

    const reactRoot = root;

    await act(async () => {
      reactRoot.render(
        <PublicMediaGrid
          items={[
            {
              id: "media-1",
              filePath: "Tours/coast/download.jpg",
              fileName: "download.jpg",
              publicUrl: "https://project.supabase.co/storage/v1/object/public/media/tours/coast/download.jpg",
              mimeType: "image/jpeg",
              caption: "Sunrise",
              createdAt: new Date("2026-04-07T00:00:00.000Z"),
              createdByUser: { fullName: "Alex Driver", email: "alex@example.com" },
              workspace: { name: "Alex Workspace", slug: "alex-workspace" },
              Tour: { id: "Tour-1", title: "Coastal Run", slug: "coastal-run" },
              Gig: null,
            },
          ]}
        />,
      );
    });

    let image = container.querySelector("img");
    expect(image?.getAttribute("src")).toContain("/storage/v1/render/image/public/");

    await act(async () => {
      image?.dispatchEvent(new Event("error"));
    });

    image = container.querySelector("img");
    expect(image?.getAttribute("src")).toBe("https://project.supabase.co/storage/v1/object/public/media/tours/coast/download.jpg");

    await act(async () => {
      image?.dispatchEvent(new Event("error"));
    });

    expect(container.textContent).toContain("Preview unavailable");
    expect(container.textContent).toContain("Sunrise");
    expect(container.textContent).toContain("Alex Driver from Alex Workspace");
  });

  it("uses neutral card title when caption is missing instead of raw filename", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    if (!root) {
      throw new Error("React root not initialized");
    }

    const reactRoot = root;

    await act(async () => {
      reactRoot.render(
        <PublicMediaGrid
          items={[
            {
              id: "media-2",
              filePath: "Tours/coast/download.jpg",
              fileName: "download.jpg",
              publicUrl: null,
              mimeType: "image/jpeg",
              caption: null,
              createdAt: new Date("2026-04-07T00:00:00.000Z"),
              createdByUser: { fullName: "Alex Driver", email: "alex@example.com" },
              workspace: { name: "Alex Workspace", slug: "alex-workspace" },
              Tour: { id: "Tour-1", title: "Coastal Run", slug: "coastal-run" },
              Gig: null,
            },
          ]}
        />,
      );
    });

    expect(container.textContent).toContain("Untitled media");
    expect(container.textContent).not.toContain("download.jpg");
  });
});

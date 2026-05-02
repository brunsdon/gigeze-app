import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/config", () => ({
  PRODUCTION_WEB_API_BASE_URL: "https://gigeze.example",
  getMobileConfig: () => ({
    appName: "GigEze",
    appVersion: "0.1.0",
    appEnvironment: "test",
    platform: "android",
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon",
    webApiBaseUrl: "http://10.0.2.2:3000/",
    webApiBaseUrlWarning: null,
  }),
}));

const fetchMock = vi.fn();

describe("external media mobile client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("loads links for an entity using bearer auth", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        links: [
          {
            id: "link-1",
            entityType: "Tour",
            entityId: "Tour-1",
            url: "https://www.instagram.com/reel/abc",
            platform: "INSTAGRAM",
            title: "Sunset",
          },
        ],
      }),
    });

    const { fetchExternalMediaLinks } = await import("./client");
    const links = await fetchExternalMediaLinks("access-token", "Tour", "Tour-1");

    expect(links).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/external-media?entityType=Tour&entityId=Tour-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });

  it("creates a link with the existing API contract", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        link: {
          id: "link-1",
          entityType: "Tour",
          entityId: "Tour-1",
          url: "https://youtu.be/example",
          platform: "YOUTUBE",
        },
      }),
    });

    const { createExternalMediaLink } = await import("./client");
    await createExternalMediaLink("access-token", {
      entityType: "Tour",
      entityId: "Tour-1",
      url: "https://youtu.be/example",
      title: "Campfire",
      caption: "Night one",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/external-media",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          entityType: "Tour",
          entityId: "Tour-1",
          url: "https://youtu.be/example",
          title: "Campfire",
          caption: "Night one",
        }),
      }),
    );
  });

  it("deletes links through the existing unlink endpoint", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ link: { id: "link-1" } }),
    });

    const { deleteExternalMediaLink } = await import("./client");
    await deleteExternalMediaLink("access-token", "link-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://10.0.2.2:3000/api/external-media/link-1",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({
          Authorization: "Bearer access-token",
        }),
      }),
    );
  });
});

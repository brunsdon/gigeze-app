import { getNormalizedWebApiBaseUrl } from "../trips/mobile-sync/sync-client";
import type { MobileExternalMediaEntityType } from "./helpers";

type ExternalMediaLinkResponse = {
  id?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  url?: unknown;
  platform?: unknown;
  title?: unknown;
  caption?: unknown;
  thumbnailUrl?: unknown;
  embedUrl?: unknown;
  externalId?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type ExternalMediaListResponse = {
  links?: ExternalMediaLinkResponse[];
  error?: unknown;
};

type ExternalMediaMutationResponse = {
  link?: ExternalMediaLinkResponse;
  error?: unknown;
};

export type MobileExternalMediaLink = {
  id: string;
  entityType: MobileExternalMediaEntityType;
  entityId: string;
  url: string;
  platform: string;
  title: string | null;
  caption: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  externalId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MobileExternalMediaCreateInput = {
  entityType: MobileExternalMediaEntityType;
  entityId: string;
  url: string;
  title?: string;
  caption?: string;
};

function normalizeExternalMediaLink(value: ExternalMediaLinkResponse): MobileExternalMediaLink | null {
  if (
    typeof value.id !== "string" ||
    typeof value.entityType !== "string" ||
    typeof value.entityId !== "string" ||
    typeof value.url !== "string" ||
    typeof value.platform !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    entityType: value.entityType as MobileExternalMediaEntityType,
    entityId: value.entityId,
    url: value.url,
    platform: value.platform,
    title: typeof value.title === "string" ? value.title : null,
    caption: typeof value.caption === "string" ? value.caption : null,
    thumbnailUrl: typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : null,
    embedUrl: typeof value.embedUrl === "string" ? value.embedUrl : null,
    externalId: typeof value.externalId === "string" ? value.externalId : null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function getExternalMediaErrorMessage(status?: number) {
  if (status === 401 || status === 403) {
    return "Your sign-in needs refreshing before external media can be loaded.";
  }

  if (status === 400) {
    return "Check the media link and try again.";
  }

  if (typeof status === "number") {
    return "GigEze could not update external media right now. Try again shortly.";
  }

  return "GigEze is unavailable right now, so external media could not be updated.";
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

export async function fetchExternalMediaLinks(
  accessToken: string,
  entityType: MobileExternalMediaEntityType,
  entityId: string,
): Promise<MobileExternalMediaLink[]> {
  const response = await fetch(
    `${getNormalizedWebApiBaseUrl()}/api/external-media?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const body = await parseJsonResponse<ExternalMediaListResponse>(response);
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : getExternalMediaErrorMessage(response.status));
  }

  return Array.isArray(body?.links)
    ? body.links.map((link) => normalizeExternalMediaLink(link)).filter((link): link is MobileExternalMediaLink => Boolean(link))
    : [];
}

export async function createExternalMediaLink(
  accessToken: string,
  input: MobileExternalMediaCreateInput,
): Promise<MobileExternalMediaLink> {
  const response = await fetch(`${getNormalizedWebApiBaseUrl()}/api/external-media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const body = await parseJsonResponse<ExternalMediaMutationResponse>(response);
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : getExternalMediaErrorMessage(response.status));
  }

  const link = body?.link ? normalizeExternalMediaLink(body.link) : null;
  if (!link) {
    throw new Error("External media attach returned an unexpected response.");
  }

  return link;
}

export async function deleteExternalMediaLink(accessToken: string, linkId: string): Promise<void> {
  const response = await fetch(`${getNormalizedWebApiBaseUrl()}/api/external-media/${encodeURIComponent(linkId)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await parseJsonResponse<ExternalMediaMutationResponse>(response);
  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : getExternalMediaErrorMessage(response.status));
  }
}

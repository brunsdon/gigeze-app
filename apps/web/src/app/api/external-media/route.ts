import { NextRequest, NextResponse } from "next/server";
import { ExternalMediaEntityType } from "@prisma/client";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { getErrorMessage } from "@/lib/utils/app-error";
import { createExternalMediaLink, listExternalMediaLinksForEntity } from "@/features/external-media/service";

function parseEntityType(value: string | null) {
  if (!value) {
    return null;
  }

  return Object.values(ExternalMediaEntityType).includes(value as ExternalMediaEntityType)
    ? value as ExternalMediaEntityType
    : null;
}

async function getExternalMediaAuthContext(request: NextRequest) {
  const mobileAuthContext = await getMobileBearerAuthContext(request);
  if (mobileAuthContext) {
    return mobileAuthContext;
  }

  try {
    const [user, workspace] = await Promise.all([
      requireAuthenticatedUser(),
      requireWorkspaceOwner(),
    ]);

    return { user, workspace };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authContext = await getExternalMediaAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { workspace } = authContext;
  const entityType = parseEntityType(request.nextUrl.searchParams.get("entityType"));
  const entityId = request.nextUrl.searchParams.get("entityId")?.trim();

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "external-media-invalid-reference" }, { status: 400 });
  }

  try {
    const links = await listExternalMediaLinksForEntity(workspace.id, entityType, entityId);
    return NextResponse.json({ links });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  const authContext = await getExternalMediaAuthContext(request);
  if (!authContext) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { user, workspace } = authContext;
  const body = await request.json().catch(() => null);
  const entityType = parseEntityType(typeof body?.entityType === "string" ? body.entityType : null);
  const entityId = typeof body?.entityId === "string" ? body.entityId.trim() : "";

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "external-media-invalid-reference" }, { status: 400 });
  }

  try {
    const link = await createExternalMediaLink(
      {
        entityType,
        entityId,
        url: typeof body?.url === "string" ? body.url : "",
        title: typeof body?.title === "string" ? body.title : undefined,
        caption: typeof body?.caption === "string" ? body.caption : undefined,
      },
      {
        workspaceId: workspace.id,
        userId: user.id,
      },
    );

    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

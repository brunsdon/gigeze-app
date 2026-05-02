import { NextRequest, NextResponse } from "next/server";
import { getMobileBearerAuthContext } from "@/app/api/mobile/auth";
import { requireWorkspaceOwner } from "@/lib/auth/workspace";
import { getErrorMessage } from "@/lib/utils/app-error";
import { deleteExternalMediaLink, updateExternalMediaLink } from "@/features/external-media/service";

async function getExternalMediaWorkspace(request: NextRequest) {
  const mobileAuthContext = await getMobileBearerAuthContext(request);
  if (mobileAuthContext) {
    return mobileAuthContext.workspace;
  }

  try {
    return await requireWorkspaceOwner();
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const workspace = await getExternalMediaWorkspace(request);
  if (!workspace) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { linkId } = await params;
  const body = await request.json().catch(() => null);

  if (!linkId) {
    return NextResponse.json({ error: "external-media-invalid-reference" }, { status: 400 });
  }

  try {
    const link = await updateExternalMediaLink(linkId, {
      title: typeof body?.title === "string" ? body.title : undefined,
      caption: typeof body?.caption === "string" ? body.caption : undefined,
    }, workspace.id);

    return NextResponse.json({ link });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const workspace = await getExternalMediaWorkspace(request);
  if (!workspace) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { linkId } = await params;

  if (!linkId) {
    return NextResponse.json({ error: "external-media-invalid-reference" }, { status: 400 });
  }

  try {
    const result = await deleteExternalMediaLink(linkId, workspace.id);
    return NextResponse.json({ link: result });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

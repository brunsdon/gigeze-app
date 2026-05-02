import { NextResponse } from "next/server";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { SupabaseStorageService } from "@/features/media/supabase-storage-service";
import { createMediaMetadata } from "@/features/media/service";
import { validateUploadFile } from "@/features/media/upload-limits";
import { getServerEnv, isEnvConfigError } from "@/lib/env";
import { parseVisibility } from "@/lib/visibility";

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser();
    const workspace = await requireWorkspaceOwner();

    const env = getServerEnv();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
    }

    const validationError = validateUploadFile(file);
    if (validationError) {
      return NextResponse.json(
        { error: validationError.message, code: validationError.code },
        { status: 400 },
      );
    }

    const requestedBucket = String(formData.get("bucket") ?? env.SUPABASE_STORAGE_BUCKET).trim();
    if (requestedBucket !== env.SUPABASE_STORAGE_BUCKET) {
      return NextResponse.json(
        { error: `Invalid upload bucket. Expected ${env.SUPABASE_STORAGE_BUCKET}.` },
        { status: 400 },
      );
    }

    const folder = String(formData.get("folder") ?? "").trim() || undefined;

    const storageService = new SupabaseStorageService();

    const uploadResult = await storageService.uploadFile({
      file,
      bucket: env.SUPABASE_STORAGE_BUCKET,
      folder,
    });

    const media = await createMediaMetadata({
      journeyId: String(formData.get("journeyId") ?? "").trim() || undefined,
      stopId: String(formData.get("stopId") ?? "").trim() || undefined,
      filePath: uploadResult.filePath,
      publicUrl: uploadResult.publicUrl,
      fileName: file.name,
      mimeType: file.type || undefined,
      sizeBytes: file.size || undefined,
      caption: String(formData.get("caption") ?? "").trim() || undefined,
      visibility: parseVisibility(formData.get("visibility") ?? workspace.defaultMediaVisibility),
    }, {
      workspaceId: workspace.id,
      userId: user.id,
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    if (isEnvConfigError(error)) {
      return NextResponse.json({ error: "Server configuration is incomplete for uploads." }, { status: 503 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}

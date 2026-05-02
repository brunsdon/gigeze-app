import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { getServerEnv } from "@/lib/env";
import { AppError } from "@/lib/utils/app-error";
import { type DeleteFileInput, type StorageService, type UploadFileInput, type UploadFileResult } from "@/features/media/storage-service";

function toStorageErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "unknown-error";
}

export class SupabaseStorageService implements StorageService {
  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const supabaseEnv = getSupabasePublicEnv();
    const serverEnv = getServerEnv();

    const client = serverEnv.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(supabaseEnv.url, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : await createSupabaseServerClient();

    const folderPrefix = input.folder ? `${input.folder}/` : "";
    const safeName = input.file.name.replace(/\s+/g, "-").toLowerCase();
    const uniqueName = `${Date.now()}-${safeName}`;
    const filePath = `${folderPrefix}${uniqueName}`;

    const { error } = await client.storage.from(input.bucket).upload(filePath, input.file, {
      contentType: input.file.type,
      upsert: false,
    });

    if (error) {
      if (error.message.toLowerCase().includes("row-level security") && !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error(
          "Upload blocked by Supabase storage RLS. Set SUPABASE_SERVICE_ROLE_KEY for server uploads or add a storage policy allowing inserts to this bucket.",
        );
      }

      throw new Error(error.message);
    }

    const { data } = client.storage.from(input.bucket).getPublicUrl(filePath);

    return {
      filePath,
      publicUrl: data.publicUrl,
    };
  }

  async deleteFile(input: DeleteFileInput): Promise<void> {
    const supabaseEnv = getSupabasePublicEnv();
    const serverEnv = getServerEnv();

    const client = serverEnv.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(supabaseEnv.url, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : await createSupabaseServerClient();

    const { data, error } = await client.storage.from(input.bucket).remove([input.filePath]);

    if (error) {
      const message = toStorageErrorMessage(error).toLowerCase();
      if (message.includes("not found") || message.includes("does not exist") || message.includes("no such object")) {
        throw new AppError("media-storage-object-missing", "MEDIA_STORAGE_OBJECT_MISSING");
      }

      throw new AppError("media-storage-delete-failed", "MEDIA_STORAGE_DELETE_FAILED");
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new AppError("media-storage-object-missing", "MEDIA_STORAGE_OBJECT_MISSING");
    }
  }
}

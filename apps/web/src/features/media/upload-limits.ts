export const MAX_FILE_SIZE_MB = 1;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const MAX_FILES_PER_BATCH = 10;

export const MAX_TOTAL_BATCH_SIZE_MB = 10;
export const MAX_TOTAL_BATCH_SIZE_BYTES = MAX_TOTAL_BATCH_SIZE_MB * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const ALLOW_VIDEO_UPLOADS = false;

export const MEDIA_UPLOAD_ACCEPT = ALLOWED_MIME_TYPES.join(",");

export const ENABLE_CLIENT_IMAGE_COMPRESSION = true;
export const MAX_IMAGE_WIDTH = 1600;
export const MAX_IMAGE_HEIGHT = 1600;
export const JPEG_QUALITY = 0.8;
export const WEBP_QUALITY = 0.8;

export const COMPRESSIBLE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MEDIA_UPLOAD_MESSAGES = {
  fileTooLarge: `File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`,
  fileTooLargeAfterCompression: `This image is still too large after compression. Maximum size is ${MAX_FILE_SIZE_MB} MB.`,
  imagesOnly: "Only image uploads are allowed during development.",
  maxFiles: `You can upload up to ${MAX_FILES_PER_BATCH} files at a time.`,
  maxTotalBatchSize: `Total batch size cannot exceed ${MAX_TOTAL_BATCH_SIZE_MB} MB.`,
  videoDisabled: "Video uploads are disabled during development.",
  emptyFile: "Uploaded file is empty",
} as const;

export type MediaUploadValidationCode =
  | "EMPTY_FILE"
  | "VIDEO_DISABLED"
  | "INVALID_MIME_TYPE"
  | "FILE_TOO_LARGE";

export type MediaUploadValidationError = {
  code: MediaUploadValidationCode;
  message: string;
};

type UploadLikeFile = {
  type: string;
  size: number;
};

function isVideoMimeType(type: string) {
  return type.toLowerCase().startsWith("video/");
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${Math.round(bytes)} B`;
}

export function validateUploadFile(file: UploadLikeFile): MediaUploadValidationError | null {
  if (file.size <= 0) {
    return {
      code: "EMPTY_FILE",
      message: MEDIA_UPLOAD_MESSAGES.emptyFile,
    };
  }

  const mimeType = (file.type || "").toLowerCase();

  if (!ALLOW_VIDEO_UPLOADS && isVideoMimeType(mimeType)) {
    return {
      code: "VIDEO_DISABLED",
      message: MEDIA_UPLOAD_MESSAGES.videoDisabled,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      code: "INVALID_MIME_TYPE",
      message: MEDIA_UPLOAD_MESSAGES.imagesOnly,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      code: "FILE_TOO_LARGE",
      message: MEDIA_UPLOAD_MESSAGES.fileTooLarge,
    };
  }

  return null;
}

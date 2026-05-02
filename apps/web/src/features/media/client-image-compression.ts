import {
  COMPRESSIBLE_IMAGE_MIME_TYPES,
  ENABLE_CLIENT_IMAGE_COMPRESSION,
  formatFileSize,
  JPEG_QUALITY,
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_HEIGHT,
  MAX_IMAGE_WIDTH,
  WEBP_QUALITY,
} from "@/features/media/upload-limits";

export type PreparedImageUpload = {
  uploadFile: File;
  compressionAttempted: boolean;
  compressionApplied: boolean;
  originalSizeBytes: number;
  finalSizeBytes: number;
  compressionSummary: string | null;
};

function isCompressibleImageMimeType(type: string) {
  return COMPRESSIBLE_IMAGE_MIME_TYPES.includes(type.toLowerCase() as (typeof COMPRESSIBLE_IMAGE_MIME_TYPES)[number]);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image for compression."));
    };

    image.src = objectUrl;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function getOutputQuality(type: string) {
  if (type === "image/jpeg") {
    return JPEG_QUALITY;
  }

  if (type === "image/webp") {
    return WEBP_QUALITY;
  }

  return undefined;
}

function constrainDimensions(width: number, height: number) {
  const scale = Math.min(1, MAX_IMAGE_WIDTH / width, MAX_IMAGE_HEIGHT / height);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: scale < 1,
  };
}

export async function prepareImageForUpload(file: File): Promise<PreparedImageUpload> {
  const originalSizeBytes = file.size;
  const type = (file.type || "").toLowerCase();

  if (!ENABLE_CLIENT_IMAGE_COMPRESSION || !isCompressibleImageMimeType(type)) {
    return {
      uploadFile: file,
      compressionAttempted: false,
      compressionApplied: false,
      originalSizeBytes,
      finalSizeBytes: originalSizeBytes,
      compressionSummary: null,
    };
  }

  try {
    const image = await loadImage(file);
    const nextDimensions = constrainDimensions(image.naturalWidth, image.naturalHeight);
    const shouldAttemptCompression = file.size > MAX_FILE_SIZE_BYTES || nextDimensions.resized;

    if (!shouldAttemptCompression) {
      return {
        uploadFile: file,
        compressionAttempted: false,
        compressionApplied: false,
        originalSizeBytes,
        finalSizeBytes: originalSizeBytes,
        compressionSummary: null,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = nextDimensions.width;
    canvas.height = nextDimensions.height;

    const context = canvas.getContext("2d");
    if (!context) {
      return {
        uploadFile: file,
        compressionAttempted: true,
        compressionApplied: false,
        originalSizeBytes,
        finalSizeBytes: originalSizeBytes,
        compressionSummary: null,
      };
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const compressedBlob = await toBlob(canvas, type, getOutputQuality(type));

    if (!compressedBlob) {
      return {
        uploadFile: file,
        compressionAttempted: true,
        compressionApplied: false,
        originalSizeBytes,
        finalSizeBytes: originalSizeBytes,
        compressionSummary: null,
      };
    }

    const compressedFile = new File([compressedBlob], file.name, {
      type,
      lastModified: file.lastModified,
    });

    if (compressedFile.size >= file.size) {
      return {
        uploadFile: file,
        compressionAttempted: true,
        compressionApplied: false,
        originalSizeBytes,
        finalSizeBytes: originalSizeBytes,
        compressionSummary: null,
      };
    }

    return {
      uploadFile: compressedFile,
      compressionAttempted: true,
      compressionApplied: true,
      originalSizeBytes,
      finalSizeBytes: compressedFile.size,
      compressionSummary: `Compressed from ${formatFileSize(file.size)} to ${formatFileSize(compressedFile.size)}`,
    };
  } catch {
    return {
      uploadFile: file,
      compressionAttempted: true,
      compressionApplied: false,
      originalSizeBytes,
      finalSizeBytes: originalSizeBytes,
      compressionSummary: null,
    };
  }
}

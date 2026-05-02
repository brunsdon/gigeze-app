export interface UploadFileInput {
  file: File;
  bucket: string;
  folder?: string;
}

export interface UploadFileResult {
  filePath: string;
  publicUrl?: string;
}

export interface DeleteFileInput {
  bucket: string;
  filePath: string;
}

export interface StorageService {
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  deleteFile(input: DeleteFileInput): Promise<void>;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Visibility } from "@prisma/client";
import { AlertCircle, CheckCircle2, RotateCcw, UploadCloud, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIndicator } from "@/components/ui/loading-state";
import {
  formatFileSize,
  MAX_FILE_SIZE_MB,
  MAX_FILES_PER_BATCH,
  MAX_TOTAL_BATCH_SIZE_BYTES,
  MAX_TOTAL_BATCH_SIZE_MB,
  MEDIA_UPLOAD_ACCEPT,
  MEDIA_UPLOAD_MESSAGES,
  validateUploadFile,
} from "@/features/media/upload-limits";
import { prepareImageForUpload } from "@/features/media/client-image-compression";
import { cn } from "@/lib/utils";
import { visibilityOptions } from "@/lib/visibility";
import { useNetworkStatus } from "@/lib/hooks/use-network-status";

type UploadState = "queued" | "uploading" | "success" | "failed" | "waiting-offline";
type UploadQueueFilter = "all" | "pending" | "uploaded" | "failed";

type UploadQueueItem = {
  id: string;
  file: File;
  sourceSignature: string;
  previewUrl: string;
  progress: number;
  state: UploadState;
  error: string | null;
  compressionSummary: string | null;
  mediaId?: string;
};

type OfflineUploadHint = {
  id: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  queuedAt: string;
};

const OFFLINE_UPLOAD_HINTS_KEY = "gigeze.mediaUploadOfflineHints";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readOfflineUploadHints(): OfflineUploadHint[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(OFFLINE_UPLOAD_HINTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is OfflineUploadHint =>
        Boolean(
          entry &&
            typeof entry === "object" &&
            typeof (entry as Record<string, unknown>).id === "string" &&
            typeof (entry as Record<string, unknown>).fileName === "string" &&
            typeof (entry as Record<string, unknown>).sizeBytes === "number" &&
            typeof (entry as Record<string, unknown>).mimeType === "string" &&
            typeof (entry as Record<string, unknown>).queuedAt === "string",
        ),
      )
      .slice(-100);
  } catch {
    return [];
  }
}

function writeOfflineUploadHints(hints: OfflineUploadHint[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(OFFLINE_UPLOAD_HINTS_KEY, JSON.stringify(hints.slice(-100)));
}

function clearOfflineUploadHints() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(OFFLINE_UPLOAD_HINTS_KEY);
}

function createUploadItem(file: File, sourceSignature: string, compressionSummary: string | null): UploadQueueItem {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    file,
    sourceSignature,
    previewUrl: URL.createObjectURL(file),
    progress: 0,
    state: "queued",
    error: null,
    compressionSummary,
  };
}

function fileSignature(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function uniqueMessages(messages: string[]) {
  return Array.from(new Set(messages));
}

function uploadSingleFile(
  file: File,
  metadata: {
    folder: string;
    caption: string;
    journeyId: string;
    stopId: string;
    visibility: Visibility;
  },
  onProgress: (progress: number) => void,
) {
  return new Promise<{ media?: { id: string }; error?: string }>((resolve, reject) => {
    const formData = new FormData();
    formData.set("file", file);

    if (metadata.folder) {
      formData.set("folder", metadata.folder);
    }

    if (metadata.caption) {
      formData.set("caption", metadata.caption);
    }

    if (metadata.journeyId) {
      formData.set("journeyId", metadata.journeyId);
    }

    if (metadata.stopId) {
      formData.set("stopId", metadata.stopId);
    }

    formData.set("visibility", metadata.visibility);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/media/upload");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const next = Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100)));
      onProgress(next);
    };

    request.onerror = () => reject(new Error("Network error while uploading."));

    request.onload = () => {
      const payload = request.responseText
        ? (JSON.parse(request.responseText) as { error?: string; media?: { id: string } })
        : {};

      if (request.status >= 200 && request.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload.error || "Upload failed."));
    };

    request.send(formData);
  });
}

type MediaUploadFormProps = {
  Tours: Array<{ id: string; title: string }>;
  Gigs: Array<{ id: string; title: string; journeyTitle: string; journeyId: string }>;
  defaultVisibility?: Visibility;
  initialJourneyId?: string;
  initialStopId?: string;
};

export function MediaUploadForm({
  Tours,
  Gigs,
  defaultVisibility = "PRIVATE",
  initialJourneyId = "",
  initialStopId = "",
}: MediaUploadFormProps) {
  const { isOnline } = useNetworkStatus();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queueRef = useRef<UploadQueueItem[]>([]);
  const uploadInFlightRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [queueItems, setQueueItems] = useState<UploadQueueItem[]>([]);
  const [folder, setFolder] = useState("");
  const [caption, setCaption] = useState("");
  const [journeyId, setJourneyId] = useState(initialJourneyId);
  const [stopId, setStopId] = useState(initialStopId);
  const [visibility, setVisibility] = useState<Visibility>(defaultVisibility);
  const [offlineHintCount, setOfflineHintCount] = useState(() => readOfflineUploadHints().length);
  const [queueFilter, setQueueFilter] = useState<UploadQueueFilter>("all");
  const [compactMode, setCompactMode] = useState(true);
  const [preparingFiles, setPreparingFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    queueRef.current = queueItems;
  }, [queueItems]);

  useEffect(() => {
    return () => {
      queueRef.current.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const filteredStops = useMemo(
    () => (journeyId ? Gigs.filter((Gig) => Gig.journeyId === journeyId) : Gigs),
    [journeyId, Gigs],
  );

  const overallProgress = useMemo(() => {
    if (!queueItems.length) {
      return 0;
    }

    const total = queueItems.reduce((sum, item) => sum + item.progress, 0);
    return Math.round(total / queueItems.length);
  }, [queueItems]);

  const successCount = queueItems.filter((item) => item.state === "success").length;
  const failedCount = queueItems.filter((item) => item.state === "failed").length;
  const waitingOfflineCount = queueItems.filter((item) => item.state === "waiting-offline").length;
  const pendingCount = queueItems.filter(
    (item) => item.state === "queued" || item.state === "uploading" || item.state === "waiting-offline",
  ).length;

  const visibleQueueItems = useMemo(() => {
    if (queueFilter === "all") {
      return queueItems;
    }

    if (queueFilter === "uploaded") {
      return queueItems.filter((item) => item.state === "success");
    }

    if (queueFilter === "failed") {
      return queueItems.filter((item) => item.state === "failed");
    }

    return queueItems.filter(
      (item) => item.state === "queued" || item.state === "uploading" || item.state === "waiting-offline",
    );
  }, [queueFilter, queueItems]);
  const showQueueFilters = queueItems.length > 2;

  const updateQueueItem = useCallback((id: string, updater: (item: UploadQueueItem) => UploadQueueItem) => {
    setQueueItems((current) => current.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const addSelectedFiles = useCallback(async (files: File[]) => {
    if (!files.length) {
      return;
    }

    setPreparingFiles(true);
    const rejectedMessages: string[] = [];
    const preparedItems: Array<{ file: File; sourceSignature: string; compressionSummary: string | null }> = [];

    for (const sourceFile of files) {
      const sourceSignature = fileSignature(sourceFile);
      const prepared = await prepareImageForUpload(sourceFile);
      const finalValidation = validateUploadFile(prepared.uploadFile);

      if (finalValidation) {
        if (finalValidation.code === "FILE_TOO_LARGE" && prepared.compressionAttempted) {
          rejectedMessages.push(MEDIA_UPLOAD_MESSAGES.fileTooLargeAfterCompression);
        } else {
          rejectedMessages.push(finalValidation.message);
        }
        continue;
      }

      preparedItems.push({
        file: prepared.uploadFile,
        sourceSignature,
        compressionSummary: prepared.compressionSummary,
      });
    }

    setQueueItems((current) => {
      const existingSignatures = new Set(current.map((item) => item.sourceSignature));
      const currentBatchBytes = current.reduce((sum, item) => sum + item.file.size, 0);
      let nextBatchBytes = currentBatchBytes;
      let remainingSlots = Math.max(0, MAX_FILES_PER_BATCH - current.length);
      let batchSizeLimitReached = false;
      const nextItems: UploadQueueItem[] = [];

      preparedItems.forEach((preparedItem) => {
        const { file, sourceSignature, compressionSummary } = preparedItem;
        const signature = sourceSignature;
        if (existingSignatures.has(signature)) {
          return;
        }

        if (remainingSlots <= 0) {
          rejectedMessages.push(MEDIA_UPLOAD_MESSAGES.maxFiles);
          return;
        }

        if (MAX_TOTAL_BATCH_SIZE_BYTES > 0 && nextBatchBytes + file.size > MAX_TOTAL_BATCH_SIZE_BYTES) {
          if (!batchSizeLimitReached) {
            rejectedMessages.push(MEDIA_UPLOAD_MESSAGES.maxTotalBatchSize);
            batchSizeLimitReached = true;
          }
          return;
        }

        existingSignatures.add(signature);
        remainingSlots -= 1;
        nextBatchBytes += file.size;
        nextItems.push(createUploadItem(file, sourceSignature, compressionSummary));
      });

      if (!nextItems.length) {
        return current;
      }

      return [...current, ...nextItems];
    });

    const dedupedMessages = uniqueMessages(rejectedMessages);
    setError(dedupedMessages.length ? dedupedMessages.join(" ") : null);
    setSuccess(null);
    setPreparingFiles(false);
  }, []);

  const persistOfflineHints = useCallback((items: UploadQueueItem[]) => {
    const hints: OfflineUploadHint[] = items.map((item) => ({
      id: item.id,
      fileName: item.file.name,
      sizeBytes: item.file.size,
      mimeType: item.file.type || "application/octet-stream",
      queuedAt: new Date().toISOString(),
    }));

    writeOfflineUploadHints(hints);
    setOfflineHintCount(hints.length);
  }, []);

  const processUploads = useCallback(
    async (onlyIds?: string[]) => {
      if (uploadInFlightRef.current) {
        return;
      }

      const idFilter = onlyIds ? new Set(onlyIds) : null;
      const currentItems = queueRef.current;
      const candidates = currentItems.filter((item) => {
        const shouldProcess = item.state === "queued" || item.state === "failed" || item.state === "waiting-offline";
        if (!shouldProcess) {
          return false;
        }

        if (!idFilter) {
          return true;
        }

        return idFilter.has(item.id);
      });

      if (!candidates.length) {
        return;
      }

      if (!isOnline) {
        setQueueItems((current) =>
          current.map((item) =>
            candidates.some((candidate) => candidate.id === item.id)
              ? { ...item, state: "waiting-offline", error: "Offline. Reconnect to upload.", progress: 0 }
              : item,
          ),
        );
        persistOfflineHints(candidates);
        setError("You are offline. Files are staged and will upload when you reconnect.");
        return;
      }

      uploadInFlightRef.current = true;
      setPending(true);
      setError(null);
      setSuccess(null);

      const metadataSnapshot = {
        folder: folder.trim(),
        caption: caption.trim(),
        journeyId,
        stopId,
        visibility,
      };

      let uploadedCount = 0;

      for (const item of candidates) {
        updateQueueItem(item.id, (current) => ({
          ...current,
          state: "uploading",
          progress: Math.max(0, current.progress),
          error: null,
        }));

        try {
          const body = await uploadSingleFile(item.file, metadataSnapshot, (progress) => {
            updateQueueItem(item.id, (current) => ({ ...current, progress }));
          });

          updateQueueItem(item.id, (current) => ({
            ...current,
            state: "success",
            progress: 100,
            error: null,
            mediaId: body.media?.id,
          }));
          uploadedCount += 1;
        } catch (uploadError) {
          const message = uploadError instanceof Error ? uploadError.message : "Upload failed.";
          updateQueueItem(item.id, (current) => ({
            ...current,
            state: isOnline ? "failed" : "waiting-offline",
            progress: 0,
            error: message,
          }));
        }
      }

      uploadInFlightRef.current = false;
      setPending(false);

      const hasOfflineWaiting = queueRef.current.some((item) => item.state === "waiting-offline");
      if (hasOfflineWaiting) {
        const waitingItems = queueRef.current.filter((item) => item.state === "waiting-offline");
        persistOfflineHints(waitingItems);
      } else {
        clearOfflineUploadHints();
        setOfflineHintCount(0);
      }

      if (uploadedCount) {
        setSuccess(`Uploaded ${uploadedCount} file${uploadedCount === 1 ? "" : "s"}. Queue status updates instantly while the page stays in place.`);
      }

      if (!uploadedCount && queueRef.current.some((item) => item.state === "failed")) {
        setError("Some files failed to upload. Retry failed files below.");
      }
    },
    [caption, folder, isOnline, journeyId, persistOfflineHints, stopId, updateQueueItem, visibility],
  );

  useEffect(() => {
    if (!isOnline || uploadInFlightRef.current) {
      return;
    }

    const hasOfflineQueued = queueRef.current.some((item) => item.state === "waiting-offline");
    if (!hasOfflineQueued) {
      return;
    }

    void processUploads();
  }, [isOnline, processUploads]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void processUploads();
  }

  function removeQueueItem(id: string) {
    setQueueItems((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return current.filter((item) => item.id !== id);
    });
  }

  function resetQueue() {
    setQueueItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setError(null);
    setSuccess(null);
  }

  function retryFailedUploads() {
    const failedIds = queueRef.current
      .filter((item) => item.state === "failed" || item.state === "waiting-offline")
      .map((item) => item.id);

    if (!failedIds.length) {
      return;
    }

    void processUploads(failedIds);
  }

  function onDropFiles(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);

    const droppedFiles = Array.from(event.dataTransfer.files || []);
    void addSelectedFiles(droppedFiles);

    if (!fileInputRef.current || !droppedFiles.length) {
      return;
    }

    const transfer = new DataTransfer();
    droppedFiles.forEach((file) => transfer.items.add(file));
    fileInputRef.current.files = transfer.files;
  }

  const hasQueue = queueItems.length > 0;

  function clearOfflineHintPrompt() {
    clearOfflineUploadHints();
    setOfflineHintCount(0);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="file">Files</Label>
        <label
          htmlFor="file"
          className={cn(
            "block cursor-pointer rounded-md border border-dashed p-4 text-sm transition-colors",
            dragActive ? "border-foreground bg-muted" : "border-border bg-muted/30",
          )}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={onDropFiles}
        >
          <div className="flex items-start gap-3">
            <UploadCloud className="mt-0.5 size-5 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Drop files here or tap to choose multiple files</p>
              <p className="text-xs text-muted-foreground">
                Development limits: images only, max {MAX_FILE_SIZE_MB} MB per file. Up to {MAX_FILES_PER_BATCH} files and {MAX_TOTAL_BATCH_SIZE_MB} MB total per batch.
              </p>
              {preparingFiles ? <p className="text-xs text-muted-foreground">Optimizing selected images...</p> : null}
            </div>
          </div>
        </label>

        <input
          ref={fileInputRef}
          id="file"
          name="file"
          type="file"
          multiple
          accept={MEDIA_UPLOAD_ACCEPT}
          className="sr-only"
          onChange={(event) => void addSelectedFiles(Array.from(event.target.files || []))}
        />

        {offlineHintCount > 0 ? (
          <div className="flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p>
              {offlineHintCount} upload{offlineHintCount === 1 ? "" : "s"} were staged in a previous offline session.
              Re-select those files to retry binary upload.
            </p>
            <Button type="button" variant="ghost" size="sm" className="h-7" onClick={clearOfflineHintPrompt}>
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="journeyId">Tour (optional)</Label>
        <select
          id="journeyId"
          name="journeyId"
          value={journeyId}
          onChange={(event) => {
            setJourneyId(event.target.value);
            setStopId("");
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">No Tour link</option>
          {Tours.map((Tour) => (
            <option key={Tour.id} value={Tour.id}>
              {Tour.title}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Link the whole upload batch to one Tour.</p>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="visibility">Visibility</Label>
        <select
          id="visibility"
          name="visibility"
          value={visibility}
          onChange={(event) => setVisibility(event.target.value as Visibility)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        >
          {visibilityOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Use your workspace default or choose a more specific sharing level for this batch.</p>
      </div>

      <details className="rounded-xl border border-border/70 bg-muted/10 p-3 md:col-span-2">
        <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
          Optional batch details
        </summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="stopId">Gig (optional)</Label>
            <select
              id="stopId"
              name="stopId"
              value={stopId}
              onChange={(event) => setStopId(event.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">No Gig link</option>
              {filteredStops.map((Gig) => (
                <option key={Gig.id} value={Gig.id}>
                  {Gig.title} ({Gig.journeyTitle})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Shared caption (optional)</Label>
            <Input id="caption" name="caption" value={caption} onChange={(event) => setCaption(event.target.value)} />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="folder">Folder (optional)</Label>
            <Input id="folder" name="folder" placeholder="Tours/nsw-coast-run" value={folder} onChange={(event) => setFolder(event.target.value)} />
            <p className="text-xs text-muted-foreground">Only use this if you need a specific storage folder prefix.</p>
          </div>
        </div>
      </details>

      {hasQueue ? (
        <div className="space-y-3 rounded-md border bg-muted/20 p-3 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <p className="font-medium">
                {successCount}/{queueItems.length} uploaded
                {failedCount ? ` · ${failedCount} failed` : ""}
                {waitingOfflineCount ? ` · ${waitingOfflineCount} waiting offline` : ""}
              </p>
              <p className="text-xs text-muted-foreground">Overall progress: {overallProgress}%</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setCompactMode((current) => !current)}
            >
              {compactMode ? "Comfortable rows" : "Compact rows"}
            </Button>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${overallProgress}%` }} />
          </div>
        </div>
      ) : null}

      {hasQueue ? (
        <div className="grid gap-2 md:col-span-2">
          {showQueueFilters ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-2">
              <Button
                type="button"
                size="sm"
                variant={queueFilter === "all" ? "default" : "outline"}
                className="h-8"
                onClick={() => setQueueFilter("all")}
              >
                All ({queueItems.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={queueFilter === "pending" ? "default" : "outline"}
                className="h-8"
                onClick={() => setQueueFilter("pending")}
              >
                Pending ({pendingCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={queueFilter === "uploaded" ? "default" : "outline"}
                className="h-8"
                onClick={() => setQueueFilter("uploaded")}
              >
                Uploaded ({successCount})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={queueFilter === "failed" ? "default" : "outline"}
                className="h-8"
                onClick={() => setQueueFilter("failed")}
              >
                Failed ({failedCount})
              </Button>
            </div>
          ) : (
            <p className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              Small batch mode: showing all files in upload order.
            </p>
          )}

          {!visibleQueueItems.length ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              No files in this view.
            </p>
          ) : null}

          {visibleQueueItems.map((item) => {
            const isImage = item.file.type.startsWith("image/");
            const isVideo = item.file.type.startsWith("video/");
            const sizeLabel = formatFileSize(item.file.size);
            const rowClass = compactMode ? "p-2" : "p-3";
            const thumbClass = compactMode ? "size-10" : "size-14";
            const titleClass = compactMode ? "text-[0.82rem] leading-4.5" : "text-[0.92rem] leading-5";
            const metaClass = compactMode ? "text-[10px]" : "text-xs";
            const statusTone =
              item.state === "success"
                ? "border-emerald-300/75 bg-emerald-50/45 dark:bg-emerald-950/18"
                : item.state === "uploading"
                  ? "border-primary/50 bg-primary/5"
                  : item.state === "failed"
                    ? "border-destructive/55"
                    : "";

            return (
              <div key={item.id} className={cn("rounded-md border bg-card transition-colors duration-300", statusTone, rowClass)}>
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 gap-2.5">
                    <div className={cn("shrink-0 overflow-hidden rounded-md border bg-muted/30", thumbClass)}>
                      {isImage ? (
                        // Blob URLs from local file inputs are not compatible with next/image optimization.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt={item.file.name} className="size-full object-cover" />
                      ) : null}
                      {isVideo ? <video src={item.previewUrl} className="size-full object-cover" muted playsInline preload="metadata" /> : null}
                      {!isImage && !isVideo ? <div className="flex size-full items-center justify-center text-xs text-muted-foreground">File</div> : null}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <p className={cn("truncate font-medium", titleClass)}>{item.file.name}</p>
                      <div className={cn("flex flex-wrap items-center gap-2", metaClass)}>
                        <span className="text-muted-foreground">{sizeLabel}</span>
                        {item.state === "success" ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : null}
                        {item.state === "failed" ? <AlertCircle className="size-3.5 text-destructive" /> : null}
                        {item.state === "waiting-offline" ? <WifiOff className="size-3.5 text-amber-600" /> : null}
                        <span
                          className={cn(
                            "font-medium",
                            item.state === "success" && "text-emerald-700",
                            item.state === "failed" && "text-destructive",
                            item.state === "waiting-offline" && "text-amber-700",
                          )}
                        >
                          {item.state === "queued" && "Queued"}
                          {item.state === "uploading" && (
                            <span className="inline-flex items-center gap-1.5">
                              <LoadingIndicator size="sm" className="text-current" />
                              {`Uploading ${item.progress}%`}
                            </span>
                          )}
                          {item.state === "success" && "Uploaded"}
                          {item.state === "failed" && "Failed"}
                          {item.state === "waiting-offline" && "Waiting for connection"}
                        </span>
                      </div>
                      {item.error ? <p className={cn("line-clamp-2 text-destructive", metaClass)}>{item.error}</p> : null}
                      {item.compressionSummary ? <p className={cn("line-clamp-2 text-muted-foreground", metaClass)}>{item.compressionSummary}</p> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {(item.state === "failed" || item.state === "waiting-offline") ? (
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void processUploads([item.id])}>
                        <RotateCcw className="mr-1 size-3.5" />
                        Retry
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => removeQueueItem(item.id)}>
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700 md:col-span-2">{success}</p> : null}

      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button type="submit" className="md:w-fit" disabled={pending || preparingFiles || !queueItems.length}>
          {pending ? (
            <>
              <LoadingIndicator size="sm" className="text-current" />
              Uploading...
            </>
          ) : (
            "Upload queue"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="md:w-fit"
          disabled={pending || !(failedCount || waitingOfflineCount)}
          onClick={retryFailedUploads}
        >
          Retry failed
        </Button>
        <Button type="button" variant="ghost" className="md:w-fit" disabled={pending || !queueItems.length} onClick={resetQueue}>
          Clear queue
        </Button>
      </div>
    </form>
  );
}

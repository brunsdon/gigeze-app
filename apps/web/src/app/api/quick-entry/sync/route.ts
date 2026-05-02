import { NextResponse } from "next/server"
import { createDrivingLog } from "@/features/driving-logs/service"
import { createStop } from "@/features/gigs/service"
import { createActivityNote } from "@/features/activity-notes/service"
import { createMediaMetadata } from "@/features/media/service"
import { getErrorMessage } from "@/lib/utils/app-error"
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace"
import {
  queuedQuickEntryActionsSchema,
  type QueuedQuickEntryAction,
} from "@/features/quick-entry/offline-contract"

const processedQueueIds = new Set<string>()
const PROCESSED_QUEUE_ID_LIMIT = 2000

function rememberProcessedQueueId(id: string) {
  processedQueueIds.add(id)

  if (processedQueueIds.size <= PROCESSED_QUEUE_ID_LIMIT) {
    return
  }

  const oldest = processedQueueIds.values().next().value
  if (oldest) {
    processedQueueIds.delete(oldest)
  }
}

async function processQueuedAction(item: QueuedQuickEntryAction, workspaceId: string, userId: string) {
  switch (item.type) {
    case "create-Gig": {
      await createStop(item.payload, { workspaceId, userId })
      return
    }
    case "create-driving-log": {
      await createDrivingLog(item.payload, { workspaceId, userId })
      return
    }
    case "create-activity-note": {
      await createActivityNote(item.payload, { workspaceId, userId })
      return
    }
    case "create-media-metadata": {
      await createMediaMetadata(item.payload, { workspaceId, userId })
      return
    }
    default: {
      const neverType: never = item
      throw new Error(`unsupported-queued-type:${JSON.stringify(neverType)}`)
    }
  }
}

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser()
  const workspace = await requireWorkspaceOwner()

  const payload = (await request.json().catch(() => null)) as { items?: unknown } | null
  const parsed = queuedQuickEntryActionsSchema.safeParse(payload?.items ?? [])

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid-sync-payload" }, { status: 400 })
  }

  const successIds: string[] = []
  const failed: Array<{ id: string; error: string }> = []

  for (const item of parsed.data) {
    if (processedQueueIds.has(item.id)) {
      successIds.push(item.id)
      continue
    }

    try {
      await processQueuedAction(item, workspace.id, user.id)
      successIds.push(item.id)
      rememberProcessedQueueId(item.id)
    } catch (error) {
      failed.push({
        id: item.id,
        error: getErrorMessage(error),
      })
    }
  }

  return NextResponse.json({
    successIds,
    failed,
  })
}

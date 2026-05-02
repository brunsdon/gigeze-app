import { z } from "zod"
import { activityNoteCreateSchema, drivingLogCreateSchema, mediaMetadataSchema, stopCreateSchema } from "@/lib/validation"

const queuedStopPayloadSchema = stopCreateSchema

const queuedDrivingLogPayloadSchema = drivingLogCreateSchema

const queuedActivityNotePayloadSchema = activityNoteCreateSchema

const queuedMediaMetadataPayloadSchema = mediaMetadataSchema

const baseQueuedActionSchema = z.object({
  id: z.string().min(1),
  queuedAt: z.string().datetime(),
  attempts: z.number().int().nonnegative().default(0),
})

export const queuedStopActionSchema = baseQueuedActionSchema.extend({
  type: z.literal("create-Gig"),
  payload: queuedStopPayloadSchema,
})

export const queuedDrivingLogActionSchema = baseQueuedActionSchema.extend({
  type: z.literal("create-driving-log"),
  payload: queuedDrivingLogPayloadSchema,
})

export const queuedActivityNoteActionSchema = baseQueuedActionSchema.extend({
  type: z.literal("create-activity-note"),
  payload: queuedActivityNotePayloadSchema,
})

export const queuedMediaMetadataActionSchema = baseQueuedActionSchema.extend({
  type: z.literal("create-media-metadata"),
  payload: queuedMediaMetadataPayloadSchema,
})

export const queuedQuickEntryActionSchema = z.discriminatedUnion("type", [
  queuedStopActionSchema,
  queuedDrivingLogActionSchema,
  queuedActivityNoteActionSchema,
  queuedMediaMetadataActionSchema,
])

export const queuedQuickEntryActionsSchema = z.array(queuedQuickEntryActionSchema)

export type QueuedQuickEntryAction = z.infer<typeof queuedQuickEntryActionSchema>
export type QueuedQuickEntryActionType = QueuedQuickEntryAction["type"]

export function createQueuedAction<TType extends QueuedQuickEntryActionType>(
  type: TType,
  payload: Extract<QueuedQuickEntryAction, { type: TType }>["payload"],
): Extract<QueuedQuickEntryAction, { type: TType }> {
  const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return {
    id: randomPart,
    type,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  } as Extract<QueuedQuickEntryAction, { type: TType }>
}

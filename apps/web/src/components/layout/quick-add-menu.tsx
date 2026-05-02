"use client"

import { type Visibility } from "@prisma/client"
import { Camera, MapPin, Plus, Truck, Wrench, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getErrorMessage, getSuccessMessage } from "@/lib/utils/feedback-messages"
import { parseVisibility, visibilityOptions } from "@/lib/visibility"
import { currentDateInputValue } from "@/lib/datetime"
import { activityNoteCreateSchema, drivingLogCreateSchema, mediaMetadataSchema, stopCreateSchema } from "@/lib/validation"
import {
  formatFileSize,
  MAX_FILE_SIZE_MB,
  MEDIA_UPLOAD_ACCEPT,
  MEDIA_UPLOAD_MESSAGES,
  validateUploadFile,
} from "@/features/media/upload-limits"
import { prepareImageForUpload } from "@/features/media/client-image-compression"
import {
  createQuickDrivingLogAction,
  createQuickActivityNoteAction,
  createQuickStopAction,
} from "@/features/quick-entry/actions"
import { createQueuedAction } from "@/features/quick-entry/offline-contract"
import { enqueueQuickEntryAction } from "@/features/quick-entry/offline-queue"
import { useOfflineSync } from "@/features/quick-entry/use-offline-sync"

type JourneyOption = {
  id: string
  title: string
  Gigs: Array<{
    id: string
    title: string
  }>
}

type VehicleOption = {
  id: string
  name: string
  isDefault: boolean
}

type QuickAddMenuProps = {
  Tours: JourneyOption[]
  vehicles: VehicleOption[]
  vehicleOdometerMap: Record<string, number | null>
  defaultJourneyId?: string
  defaultVehicleId?: string
  defaultStopVisibility: Visibility
  defaultMediaVisibility: Visibility
  showDesktopStatusBadge?: boolean
}

type QuickEntryType = "Gig" | "driving-log" | "activity" | "media"

const touchSelectClassName = "h-11 w-full rounded-lg border border-input bg-card/90 px-3 text-base transition-[background-color,border-color,box-shadow] duration-150 outline-none hover:bg-muted/35 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-55 md:h-9 md:text-sm"
const touchSubmitClassName = "h-11 w-full sm:w-auto"

function todayDateValue() {
  return currentDateInputValue()
}

function numberValue(input: string) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

function getContextJourneyId(pathname: string, Tours: JourneyOption[], defaultJourneyId?: string) {
  const segments = pathname.split("/").filter(Boolean)
  const candidate =
    segments[0] === "dashboard" &&
      segments[1] === "Tours" &&
      segments[2] &&
      segments[2] !== "new"
      ? segments[2]
      : null

  if (!candidate) {
    return defaultJourneyId ?? Tours[0]?.id ?? ""
  }

  const matched = Tours.some((Tour) => Tour.id === candidate)
  return matched ? candidate : (defaultJourneyId ?? Tours[0]?.id ?? "")
}

export function QuickAddMenu({
  Tours,
  vehicles,
  vehicleOdometerMap,
  defaultJourneyId,
  defaultVehicleId,
  defaultStopVisibility,
  defaultMediaVisibility,
  showDesktopStatusBadge = true,
}: QuickAddMenuProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [openEntry, setOpenEntry] = useState<QuickEntryType | null>(null)
  const [mobileFabOpen, setMobileFabOpen] = useState(false)
  const contextJourneyId = getContextJourneyId(pathname, Tours, defaultJourneyId)
  const syncState = useOfflineSync()
  const firstFabActionRef = useRef<HTMLButtonElement | null>(null)

  function openQuickEntry(entry: QuickEntryType) {
    setMobileFabOpen(false)
    setOpenEntry(entry)
  }

  const quickActionItems: Array<{ key: QuickEntryType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: "Gig", label: "Add Gig", icon: MapPin },
    { key: "driving-log", label: "Add Driving Log", icon: Truck },
    { key: "activity", label: "Add Activity", icon: Wrench },
    { key: "media", label: "Add Moment", icon: Camera },
  ]

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.shiftKey || event.key.toLowerCase() !== "a") {
        return
      }

      const target = event.target as HTMLElement | null
      const isTextEntry =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true

      if (isTextEntry) {
        return
      }

      event.preventDefault()
      openQuickEntry("Gig")
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (mobileFabOpen) {
      firstFabActionRef.current?.focus()
    }
  }, [mobileFabOpen])

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return
      }

      setMobileFabOpen(false)
    }

    window.addEventListener("keydown", onEscape)
    return () => window.removeEventListener("keydown", onEscape)
  }, [])

  const stopOptions = useMemo(
    () => Tours.flatMap((Tour) =>
      Tour.Gigs.map((Gig) => ({
        id: Gig.id,
        title: Gig.title,
        journeyId: Tour.id,
        journeyTitle: Tour.title,
      })),
    ),
    [Tours],
  )

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full px-3"
          disabled={!syncState.isOnline || syncState.isSyncing || syncState.queueCount === 0}
          onClick={() => void syncState.syncNow()}
        >
          Sync now
        </Button>
        {showDesktopStatusBadge ? (
          <Badge variant={syncState.isOnline ? "outline" : "destructive"}>{syncState.statusLabel}</Badge>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="h-9" />}>
            <Plus className="mr-1 size-4" />
            Add
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => openQuickEntry("Gig")}>
              <MapPin className="size-4" />
              Add Gig
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openQuickEntry("driving-log")}>
              <Truck className="size-4" />
              Add Driving Log
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openQuickEntry("activity")}>
              <Wrench className="size-4" />
              Add Activity
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openQuickEntry("media")}>
              <Camera className="size-4" />
              Add Moment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="fixed right-4 bottom-20 z-40 md:hidden" aria-label="Quick actions">
        <div className="flex flex-col items-end gap-2">
          <Badge variant={syncState.isOnline ? "outline" : "destructive"} className="rounded-full bg-card/95 px-2.5 py-1 shadow-[0_1px_2px_rgba(43,42,40,0.06)]">
            {syncState.statusLabel}
          </Badge>

          {mobileFabOpen ? (
            <div
              id="quick-add-mobile-menu"
              role="menu"
              aria-label="Add quick entry"
              className="flex w-[min(85vw,16rem)] flex-col gap-2 rounded-xl border border-border/80 bg-card/96 p-2 shadow-[0_10px_30px_rgba(43,42,40,0.14)] backdrop-blur"
            >
              {quickActionItems.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.key}
                    ref={action.key === "Gig" ? firstFabActionRef : undefined}
                    type="button"
                    variant="outline"
                    className="h-11 justify-start active:translate-y-px"
                    role="menuitem"
                    onClick={() => {
                      openQuickEntry(action.key)
                    }}
                  >
                    <Icon className="mr-2 size-4" />
                    {action.label}
                  </Button>
                )
              })}

              <Button
                type="button"
                variant="ghost"
                className="h-10 active:translate-y-px"
                role="menuitem"
                disabled={!syncState.isOnline || syncState.isSyncing || syncState.queueCount === 0}
                onClick={() => void syncState.syncNow()}
              >
                Sync queued entries
              </Button>
            </div>
          ) : null}

          <Button
            type="button"
            className="size-14 rounded-full p-0 shadow-[0_8px_18px_rgba(43,42,40,0.16)] active:translate-y-px"
            aria-label={mobileFabOpen ? "Close quick add menu" : "Open quick add menu"}
            aria-expanded={mobileFabOpen}
            aria-controls="quick-add-mobile-menu"
            onClick={() => setMobileFabOpen((current) => !current)}
          >
            {mobileFabOpen ? <X className="size-5" /> : <Plus className="size-6" />}
          </Button>
        </div>
      </div>

      <Dialog open={openEntry !== null} onOpenChange={(open) => !open && setOpenEntry(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-1rem)] overflow-y-auto">
          <DialogClose />

          {openEntry === "Gig" ? (
            <QuickStopForm
              Tours={Tours}
              initialJourneyId={contextJourneyId}
              defaultStopVisibility={defaultStopVisibility}
              isOnline={syncState.isOnline}
              onQueued={() => syncState.refreshQueueCount()}
              onDone={() => {
                setOpenEntry(null)
                router.refresh()
              }}
            />
          ) : null}

          {openEntry === "driving-log" ? (
            <QuickDrivingLogForm
              Tours={Tours}
              vehicles={vehicles}
              vehicleOdometerMap={vehicleOdometerMap}
              initialJourneyId={contextJourneyId}
              defaultVehicleId={defaultVehicleId}
              isOnline={syncState.isOnline}
              onQueued={() => syncState.refreshQueueCount()}
              onDone={() => {
                setOpenEntry(null)
                router.refresh()
              }}
            />
          ) : null}

          {openEntry === "activity" ? (
            <QuickActivityNoteForm
              Tours={Tours}
              initialJourneyId={contextJourneyId}
              isOnline={syncState.isOnline}
              onQueued={() => syncState.refreshQueueCount()}
              onDone={() => {
                setOpenEntry(null)
                router.refresh()
              }}
            />
          ) : null}

          {openEntry === "media" ? (
            <QuickMediaUploadForm
              Tours={Tours}
              Gigs={stopOptions}
              initialJourneyId={contextJourneyId}
              defaultVisibility={defaultMediaVisibility}
              isOnline={syncState.isOnline}
              onQueued={() => syncState.refreshQueueCount()}
              onDone={() => {
                setOpenEntry(null)
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

type QuickFormProps = {
  onDone: () => void
  isOnline: boolean
  onQueued: () => void
}

function QuickStopForm({ Tours, initialJourneyId, defaultStopVisibility, isOnline, onQueued, onDone }: QuickFormProps & {
  Tours: JourneyOption[]
  initialJourneyId: string
  defaultStopVisibility: Visibility
}) {
  const [pending, startTransition] = useTransition()
  const [latitude, setLatitude] = useState("")
  const [longitude, setLongitude] = useState("")
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const formRef = useRef<HTMLFormElement | null>(null)

  function loadCurrentCoordinates() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Location is unavailable in this browser.")
      return
    }

    setLocating(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6))
        setLongitude(position.coords.longitude.toFixed(6))
        setLocating(false)
      },
      () => {
        setGeoError("Could not read your location. You can type coordinates manually.")
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 6000 },
    )
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    const parsed = stopCreateSchema.safeParse({
      journeyId: String(formData.get("journeyId") ?? "").trim(),
      title: formData.get("title"),
      description: formData.get("description") || undefined,
      latitude: formData.get("latitude"),
      longitude: formData.get("longitude"),
      locationName: formData.get("locationName") || undefined,
      arrivalDate: formData.get("arrivalDate") || undefined,
      departureDate: formData.get("departureDate") || undefined,
      visibility: parseVisibility(formData.get("visibility") ?? defaultStopVisibility),
      orderIndex: formData.get("orderIndex") || 1,
    })

    if (!parsed.success) {
      toast.error(getErrorMessage("Gig-invalid-input"))
      return
    }

    if (!isOnline) {
      enqueueQuickEntryAction(createQueuedAction("create-Gig", parsed.data))
      onQueued()
      toast.message("Saved offline")
      onDone()
      return
    }

    startTransition(async () => {
      const result = await createQuickStopAction(formData)
      if (!result.ok) {
        toast.error(getErrorMessage(result.errorCode))
        return
      }

      toast.success(getSuccessMessage(result.successCode))
      formRef.current?.reset()
      onDone()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Quick Gig</DialogTitle>
        <DialogDescription>Add a Gig in seconds without leaving your current page.</DialogDescription>
      </DialogHeader>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="quick-Gig-Tour">Tour</Label>
          <select
            id="quick-Gig-Tour"
            name="journeyId"
            required
            autoFocus
            className={touchSelectClassName}
            defaultValue={initialJourneyId}
          >
            <option value="" disabled>Select a Tour</option>
            {Tours.map((Tour) => (
              <option key={Tour.id} value={Tour.id}>{Tour.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-Gig-title">Name</Label>
          <Input id="quick-Gig-title" name="title" required maxLength={120} placeholder="Morning coffee Gig" className="h-11 text-base md:h-8 md:text-sm" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-Gig-description">Notes (optional)</Label>
          <Textarea id="quick-Gig-description" name="description" rows={3} maxLength={2000} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-Gig-visibility">Visibility</Label>
          <select
            id="quick-Gig-visibility"
            name="visibility"
            defaultValue={defaultStopVisibility}
            className={touchSelectClassName}
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm">Coordinates</Label>
            <Button type="button" variant="outline" className="h-10" onClick={loadCurrentCoordinates} disabled={locating}>
              {locating ? "Locating..." : "Use current location"}
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="quick-Gig-latitude">Latitude</Label>
              <Input
                id="quick-Gig-latitude"
                name="latitude"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                required
                placeholder="-33.865143"
                className="h-11 text-base md:h-8 md:text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="quick-Gig-longitude">Longitude</Label>
              <Input
                id="quick-Gig-longitude"
                name="longitude"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                required
                placeholder="151.209900"
                className="h-11 text-base md:h-8 md:text-sm"
              />
            </div>
          </div>

          <Input type="hidden" name="orderIndex" value="1" />

          {geoError ? <p className="text-xs text-muted-foreground">{geoError}</p> : null}
        </div>

        <Button type="submit" disabled={pending || !Tours.length} className={touchSubmitClassName}>
          {pending ? "Saving..." : "Save Gig"}
        </Button>
      </form>
    </>
  )
}

function QuickDrivingLogForm({
  Tours,
  vehicles,
  vehicleOdometerMap,
  initialJourneyId,
  defaultVehicleId,
  isOnline,
  onQueued,
  onDone,
}: QuickFormProps & {
  Tours: JourneyOption[]
  vehicles: VehicleOption[]
  vehicleOdometerMap: Record<string, number | null>
  initialJourneyId: string
  defaultVehicleId?: string
}) {
  const [pending, startTransition] = useTransition()
  const [selectedVehicleId, setSelectedVehicleId] = useState(defaultVehicleId ?? "")
  const [startOdometer, setStartOdometer] = useState(() => {
    const initial = defaultVehicleId ? vehicleOdometerMap[defaultVehicleId] : null
    return typeof initial === "number" ? String(initial) : ""
  })
  const [endOdometer, setEndOdometer] = useState("")
  const [businessKm, setBusinessKm] = useState("")
  const [personalKm, setPersonalKm] = useState("")

  const formRef = useRef<HTMLFormElement | null>(null)

  const totalDistance = Math.max(0, numberValue(endOdometer) - numberValue(startOdometer))
  const splitTotal = Math.max(0, numberValue(businessKm) + numberValue(personalKm))
  const selectedVehicleName = vehicles.find((vehicle) => vehicle.id === selectedVehicleId)?.name
  const latestVehicleOdometer = selectedVehicleId ? (vehicleOdometerMap[selectedVehicleId] ?? null) : null

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    const parsed = drivingLogCreateSchema.safeParse({
      journeyId: String(formData.get("journeyId") ?? "").trim() || undefined,
      vehicleId: String(formData.get("vehicleId") ?? "").trim() || undefined,
      date: String(formData.get("date") ?? "").trim() || todayDateValue(),
      startLocation: formData.get("startLocation") || undefined,
      endLocation: formData.get("endLocation") || undefined,
      startOdometer: formData.get("startOdometer"),
      endOdometer: formData.get("endOdometer"),
      businessKm: String(formData.get("businessKm") ?? "").trim() || "0",
      personalKm: String(formData.get("personalKm") ?? "").trim() || "0",
      notes: formData.get("notes") || undefined,
    })

    if (!parsed.success) {
      toast.error(getErrorMessage("driving-log-invalid-input"))
      return
    }

    if (!isOnline) {
      enqueueQuickEntryAction(createQueuedAction("create-driving-log", parsed.data))
      onQueued()
      toast.message("Saved offline")
      onDone()
      return
    }

    startTransition(async () => {
      const result = await createQuickDrivingLogAction(formData)
      if (!result.ok) {
        toast.error(getErrorMessage(result.errorCode))
        return
      }

      toast.success(getSuccessMessage(result.successCode))
      formRef.current?.reset()
      setStartOdometer("")
      setEndOdometer("")
      setBusinessKm("")
      setPersonalKm("")
      onDone()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Quick Driving Log</DialogTitle>
        <DialogDescription>Capture distance now and detail it later if needed.</DialogDescription>
      </DialogHeader>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <Input type="hidden" name="date" value={todayDateValue()} />

        {vehicles.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="quick-log-vehicle">Vehicle (optional)</Label>
            <select
              id="quick-log-vehicle"
              name="vehicleId"
              className={touchSelectClassName}
              value={selectedVehicleId}
              onChange={(event) => {
                const vehicleId = event.currentTarget.value
                setSelectedVehicleId(vehicleId)
                const latestOdometer = vehicleId ? (vehicleOdometerMap[vehicleId] ?? null) : null
                setStartOdometer(typeof latestOdometer === "number" ? String(latestOdometer) : "")
                setEndOdometer("")
                setBusinessKm("")
                setPersonalKm("")
              }}
            >
              <option value="">No vehicle</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.name}
                  {vehicle.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
            {selectedVehicleName ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Last recorded odometer for {selectedVehicleName}: {latestVehicleOdometer ?? "No previous log"}
                {typeof latestVehicleOdometer === "number" ? " km" : ""}
              </div>
            ) : null}
          </div>
        ) : (
          <input type="hidden" name="vehicleId" value="" />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quick-log-start">Start odometer</Label>
            <Input
              id="quick-log-start"
              name="startOdometer"
              type="number"
              min={0}
              step={1}
              required
              autoFocus={vehicles.length === 0}
              value={startOdometer}
              onChange={(event) => setStartOdometer(event.target.value)}
              className="h-11 text-base md:h-8 md:text-sm"
            />
            {selectedVehicleName && typeof latestVehicleOdometer === "number" ? (
              <p className="text-xs text-muted-foreground">
                Prefilled from {selectedVehicleName} last recorded odometer.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-log-end">End odometer</Label>
            <Input
              id="quick-log-end"
              name="endOdometer"
              type="number"
              min={0}
              step={1}
              required
              value={endOdometer}
              onChange={(event) => setEndOdometer(event.target.value)}
              className="h-11 text-base md:h-8 md:text-sm"
            />
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          Distance: <span className="font-medium">{totalDistance} km</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quick-log-business">Business km (optional)</Label>
            <Input
              id="quick-log-business"
              name="businessKm"
              type="number"
              min={0}
              step={1}
              value={businessKm}
              onChange={(event) => setBusinessKm(event.target.value)}
              className="h-11 text-base md:h-8 md:text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-log-personal">Personal km (optional)</Label>
            <Input
              id="quick-log-personal"
              name="personalKm"
              type="number"
              min={0}
              step={1}
              value={personalKm}
              onChange={(event) => setPersonalKm(event.target.value)}
              className="h-11 text-base md:h-8 md:text-sm"
            />
          </div>
        </div>

        {splitTotal > totalDistance ? (
          <p className="text-xs text-destructive">Business + personal split cannot exceed total distance.</p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="quick-log-Tour">Tour link (optional)</Label>
          <select
            id="quick-log-Tour"
            name="journeyId"
            className={touchSelectClassName}
            defaultValue={initialJourneyId}
          >
            <option value="">No Tour link</option>
            {Tours.map((Tour) => (
              <option key={Tour.id} value={Tour.id}>{Tour.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-log-notes">Notes (optional)</Label>
          <Textarea id="quick-log-notes" name="notes" rows={3} maxLength={2000} />
        </div>

        <Button type="submit" disabled={pending || splitTotal > totalDistance} className={touchSubmitClassName}>
          {pending ? "Saving..." : "Save driving log"}
        </Button>
      </form>
    </>
  )
}

function QuickActivityNoteForm({ Tours, initialJourneyId, isOnline, onQueued, onDone }: QuickFormProps & {
  Tours: JourneyOption[]
  initialJourneyId: string
}) {
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement | null>(null)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    const parsed = activityNoteCreateSchema.safeParse({
      journeyId: String(formData.get("journeyId") ?? "").trim(),
      type: formData.get("type") || "WORK",
      date: String(formData.get("date") ?? "").trim() || todayDateValue(),
      durationMinutes: formData.get("durationMinutes") || undefined,
      location: formData.get("location") || undefined,
      notes: formData.get("notes") || undefined,
      visibility: "PRIVATE",
    })

    if (!parsed.success) {
      toast.error(getErrorMessage("activity-note-invalid-input"))
      return
    }

    if (!isOnline) {
      enqueueQuickEntryAction(createQueuedAction("create-activity-note", parsed.data))
      onQueued()
      toast.message("Saved offline")
      onDone()
      return
    }

    startTransition(async () => {
      const result = await createQuickActivityNoteAction(formData)
      if (!result.ok) {
        toast.error(getErrorMessage(result.errorCode))
        return
      }

      toast.success(getSuccessMessage(result.successCode))
      formRef.current?.reset()
      onDone()
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Quick Activity</DialogTitle>
        <DialogDescription>Log work, maintenance, admin, or a personal note while details are still fresh.</DialogDescription>
      </DialogHeader>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <Input type="hidden" name="date" value={todayDateValue()} />
        <Input type="hidden" name="visibility" value="PRIVATE" />

        <div className="space-y-2">
          <Label htmlFor="quick-activity-type">Type</Label>
          <select id="quick-activity-type" name="type" defaultValue="WORK" className={touchSelectClassName}>
            <option value="WORK">Work</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="ADMIN">Admin</option>
            <option value="PERSONAL">Personal</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-activity-duration">Duration (minutes, optional)</Label>
          <Input id="quick-activity-duration" name="durationMinutes" type="number" min={1} step={15} autoFocus className="h-11 text-base md:h-8 md:text-sm" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-activity-Tour">Tour</Label>
          <select
            id="quick-activity-Tour"
            name="journeyId"
            className={touchSelectClassName}
            defaultValue={initialJourneyId}
            required
          >
            <option value="" disabled>Select a Tour</option>
            {Tours.map((Tour) => (
              <option key={Tour.id} value={Tour.id}>{Tour.title}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-activity-notes">Notes (optional)</Label>
          <Textarea id="quick-activity-notes" name="notes" rows={3} maxLength={2000} />
        </div>

        <Button type="submit" disabled={pending} className={touchSubmitClassName}>
          {pending ? "Saving..." : "Save activity"}
        </Button>
      </form>
    </>
  )
}

function QuickMediaUploadForm({
  Tours,
  Gigs,
  initialJourneyId,
  defaultVisibility,
  isOnline,
  onQueued,
  onDone,
}: QuickFormProps & {
  Tours: JourneyOption[]
  Gigs: Array<{ id: string; title: string; journeyId: string; journeyTitle: string }>
  initialJourneyId: string
  defaultVisibility: Visibility
}) {
  const [pending, setPending] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedJourneyId, setSelectedJourneyId] = useState(initialJourneyId)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [compressionSummary, setCompressionSummary] = useState<string | null>(null)
  const [isPreparingFile, setIsPreparingFile] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "ready" | "uploading" | "uploaded" | "queued-offline">("idle")
  const formRef = useRef<HTMLFormElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const filteredStops = useMemo(
    () => (selectedJourneyId ? Gigs.filter((Gig) => Gig.journeyId === selectedJourneyId) : Gigs),
    [selectedJourneyId, Gigs],
  )

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedFile])

  function ensureValidFile(file: File | null): file is File {
    if (!file) {
      toast.error("Choose a file before uploading.")
      return false
    }

    const validationError = validateUploadFile(file)
    if (validationError) {
      toast.error(validationError.message)
      return false
    }

    return true
  }

  async function prepareAndSelectFile(sourceFile: File | null) {
    if (!sourceFile) {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setSelectedFile(null)
      setSelectedFileName(null)
      setCompressionSummary(null)
      setUploadStatus("idle")
      return
    }

    setIsPreparingFile(true)

    const prepared = await prepareImageForUpload(sourceFile)
    const finalValidation = validateUploadFile(prepared.uploadFile)

    if (finalValidation) {
      if (finalValidation.code === "FILE_TOO_LARGE" && prepared.compressionAttempted) {
        toast.error(MEDIA_UPLOAD_MESSAGES.fileTooLargeAfterCompression)
      } else {
        toast.error(finalValidation.message)
      }

      setSelectedFile(null)
      setSelectedFileName(null)
      setCompressionSummary(null)
      setUploadStatus("idle")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setIsPreparingFile(false)
      return
    }

    setSelectedFile(prepared.uploadFile)
    setSelectedFileName(sourceFile.name)
    setCompressionSummary(prepared.compressionSummary)
    setUploadStatus("ready")
    setIsPreparingFile(false)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const caption = String(formData.get("caption") ?? "").trim()
    const journeyId = String(formData.get("journeyId") ?? "").trim() || undefined
    const stopId = String(formData.get("stopId") ?? "").trim() || undefined
    const visibility = parseVisibility(formData.get("visibility") ?? defaultVisibility)
    const activeFile = selectedFile ?? fileInputRef.current?.files?.[0] ?? null

    if (!ensureValidFile(activeFile)) {
      return
    }

    if (!isOnline) {
      const fileName = activeFile?.name?.trim()

      if (!fileName) {
        toast.error("Choose a file before saving offline moment metadata.")
        return
      }

      const queuedFile = activeFile

      if (!queuedFile) {
        toast.error("Choose a file before saving offline moment metadata.")
        return
      }

      const parsedOfflineMetadata = mediaMetadataSchema.safeParse({
        journeyId,
        stopId,
        filePath: `offline/${Date.now()}-${fileName}`,
        fileName,
        publicUrl: undefined,
        mimeType: queuedFile.type || undefined,
        sizeBytes: queuedFile.size || undefined,
        caption: caption || undefined,
        visibility,
      })

      if (!parsedOfflineMetadata.success) {
        toast.error(getErrorMessage("invalid-media-reference"))
        return
      }

      enqueueQuickEntryAction(createQueuedAction("create-media-metadata", parsedOfflineMetadata.data))
      onQueued()
      setUploadStatus("queued-offline")
      toast.message("Saved offline")
      onDone()
      return
    }

    setPending(true)
    setUploadStatus("uploading")

    try {
      const response = await fetch("/api/media/upload", {
        method: "POST",
        body: formData,
      })

      const body = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        toast.error(body.error || "Upload failed")
        return
      }

      toast.success(getSuccessMessage("metadata-created"))
      setUploadStatus("uploaded")
      formRef.current?.reset()
      setSelectedFile(null)
      setSelectedFileName(null)
      setCompressionSummary(null)
      setSelectedJourneyId(initialJourneyId)
      await new Promise((resolve) => window.setTimeout(resolve, 420))
      setUploadStatus("idle")
      onDone()
    } finally {
      setPending(false)
    }
  }

  function setDroppedFile(file: File) {
    const input = fileInputRef.current
    if (!input) {
      return
    }

    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)
    input.files = dataTransfer.files
    void prepareAndSelectFile(file)
  }

  const isImage = Boolean(selectedFile?.type?.startsWith("image/"))
  const isVideo = Boolean(selectedFile?.type?.startsWith("video/"))

  return (
    <>
      <DialogHeader>
        <DialogTitle>Quick moment upload</DialogTitle>
        <DialogDescription>Upload a file when a hosted Flickr or YouTube moment is not the right fit.</DialogDescription>
      </DialogHeader>

      <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="quick-media-file">File</Label>
          <label
            htmlFor="quick-media-file"
            className={`block cursor-pointer rounded-md border border-dashed p-4 text-sm transition-colors ${dragActive ? "border-foreground bg-muted" : "border-border bg-muted/30"}`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragActive(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              const file = event.dataTransfer.files?.[0]
              if (file) {
                setDroppedFile(file)
              }
            }}
          >
            <p className="font-medium">Drop a moment file here or tap to pick a file</p>
            <p className="mt-1 text-xs text-muted-foreground">Development limits: images only, max {MAX_FILE_SIZE_MB} MB per file.</p>
            {isPreparingFile ? <p className="mt-1 text-xs text-muted-foreground">Optimizing selected image...</p> : null}
            {selectedFileName ? <p className="mt-2 truncate text-xs text-muted-foreground">Selected: {selectedFileName}</p> : null}
          </label>
          <input
            ref={fileInputRef}
            id="quick-media-file"
            name="file"
            type="file"
            accept={MEDIA_UPLOAD_ACCEPT}
            capture="environment"
            required
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              void prepareAndSelectFile(file ?? null)
            }}
          />

          {previewUrl && isImage ? (
            // Blob URLs from local file inputs are not compatible with next/image optimization.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Selected preview" className="max-h-52 w-full rounded-md border object-cover" />
          ) : null}

          {previewUrl && isVideo ? (
            <video src={previewUrl} className="max-h-52 w-full rounded-md border" controls playsInline muted preload="metadata" />
          ) : null}

          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            {uploadStatus === "idle" ? "Choose a file to start." : null}
            {uploadStatus === "ready" ? "Ready to upload." : null}
            {uploadStatus === "uploading" ? "Uploading now. Keep this screen open until completion." : null}
            {uploadStatus === "uploaded" ? "Uploaded. Closing this quick form..." : null}
            {uploadStatus === "queued-offline" ? "Saved offline as metadata. Binary file upload still requires an online connection." : null}
            {compressionSummary ? ` ${compressionSummary}.` : null}
            {selectedFile && uploadStatus === "ready" ? ` Final size: ${formatFileSize(selectedFile.size)}.` : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-media-caption">Caption (optional)</Label>
          <Input id="quick-media-caption" name="caption" maxLength={1000} autoFocus className="h-11 text-base md:h-8 md:text-sm" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quick-media-visibility">Visibility</Label>
          <select
            id="quick-media-visibility"
            name="visibility"
            defaultValue={defaultVisibility}
            className={touchSelectClassName}
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quick-media-Tour">Tour link (optional)</Label>
            <select
              id="quick-media-Tour"
              name="journeyId"
              value={selectedJourneyId}
              onChange={(event) => setSelectedJourneyId(event.target.value)}
              className={touchSelectClassName}
            >
              <option value="">No Tour link</option>
              {Tours.map((Tour) => (
                <option key={Tour.id} value={Tour.id}>{Tour.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-media-Gig">Gig link (optional)</Label>
            <select id="quick-media-Gig" name="stopId" defaultValue="" className={touchSelectClassName}>
              <option value="">No Gig link</option>
              {filteredStops.map((Gig) => (
                <option key={Gig.id} value={Gig.id}>{Gig.title} ({Gig.journeyTitle})</option>
              ))}
            </select>
          </div>
        </div>

        <Button type="submit" disabled={pending || isPreparingFile} className={touchSubmitClassName}>
          {pending ? "Uploading..." : "Upload moment"}
        </Button>
      </form>
    </>
  )
}

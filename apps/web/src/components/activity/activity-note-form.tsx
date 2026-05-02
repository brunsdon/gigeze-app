"use client";

import { useMemo, useState } from "react";
import { type ActivityType, type Visibility } from "@prisma/client";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { visibilityOptions } from "@/lib/visibility";

const activityTypes = [
  "WORK",
  "MAINTENANCE",
  "ADMIN",
  "PERSONAL",
] as const satisfies readonly ActivityType[];

function getActivityTypeLabel(type: ActivityType) {
  switch (type) {
    case "WORK":
      return "Work";
    case "MAINTENANCE":
      return "Maintenance";
    case "ADMIN":
      return "Admin";
    case "PERSONAL":
      return "Personal";
  }
}

type JourneyOption = {
  id: string;
  title: string;
  Gigs: Array<{ id: string; title: string }>;
};

type ActivityNoteFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  Tours: JourneyOption[];
  defaultJourneyId?: string;
  defaultStopId?: string;
  defaultType?: ActivityType;
  defaultDate: string;
  defaultDurationMinutes?: number | null;
  defaultLocation?: string | null;
  defaultNotes?: string | null;
  defaultVisibility?: Visibility;
  noteId?: string;
  returnTo?: string;
  submitLabel: string;
};

export function ActivityNoteForm({
  action,
  Tours,
  defaultJourneyId,
  defaultStopId,
  defaultType = "WORK",
  defaultDate,
  defaultDurationMinutes,
  defaultLocation,
  defaultNotes,
  defaultVisibility = "PRIVATE",
  noteId,
  returnTo,
  submitLabel,
}: ActivityNoteFormProps) {
  const initialJourneyId = Tours.some((Tour) => Tour.id === defaultJourneyId)
    ? defaultJourneyId
    : Tours[0]?.id ?? "";
  const [selectedJourneyId, setSelectedJourneyId] = useState(initialJourneyId);
  const [selectedStopId, setSelectedStopId] = useState(defaultStopId ?? "");
  const filteredStops = useMemo(
    () => Tours.find((Tour) => Tour.id === selectedJourneyId)?.Gigs ?? [],
    [Tours, selectedJourneyId],
  );
  const safeSelectedStopId = filteredStops.some((Gig) => Gig.id === selectedStopId) ? selectedStopId : "";

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {noteId ? <input type="hidden" name="noteId" value={noteId} /> : null}
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <select id="type" name="type" defaultValue={defaultType} className="w-full" required>
          {activityTypes.map((type) => (
            <option key={type} value={type}>
              {getActivityTypeLabel(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="journeyId">Tour</Label>
        <select
          id="journeyId"
          name="journeyId"
          value={selectedJourneyId}
          onChange={(event) => {
            setSelectedJourneyId(event.currentTarget.value);
            setSelectedStopId("");
          }}
          className="w-full"
          required
        >
          <option value="" disabled>Select a Tour</option>
          {Tours.map((Tour) => (
            <option key={Tour.id} value={Tour.id}>
              {Tour.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="stopId">Gig (optional)</Label>
        <select
          id="stopId"
          name="stopId"
          value={safeSelectedStopId}
          onChange={(event) => setSelectedStopId(event.currentTarget.value)}
          className="w-full"
        >
          <option value="">Whole Tour</option>
          {filteredStops.map((Gig) => (
            <option key={Gig.id} value={Gig.id}>
              {Gig.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" defaultValue={defaultDate} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="durationMinutes">Duration (minutes, optional)</Label>
        <Input
          id="durationMinutes"
          name="durationMinutes"
          type="number"
          step={15}
          min={1}
          defaultValue={defaultDurationMinutes ?? ""}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">Visibility</Label>
        <select id="visibility" name="visibility" defaultValue={defaultVisibility} className="w-full">
          {visibilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={defaultLocation ?? ""} />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={defaultNotes ?? ""} />
      </div>

      <ActionSubmitButton label={submitLabel} pendingLabel="Saving..." className="md:col-span-2 md:w-fit" />
    </form>
  );
}

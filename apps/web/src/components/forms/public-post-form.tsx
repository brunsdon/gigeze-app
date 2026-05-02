import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { visibilityOptions } from "@/lib/visibility";

type JourneyOption = {
  id: string;
  title: string;
  Gigs: Array<{
    id: string;
    title: string;
  }>;
};

type PublicPostFormValues = {
  postId?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  status?: "DRAFT" | "PUBLISHED";
  visibility?: "PRIVATE" | "SHARED" | "PUBLIC";
  coverImageUrl?: string;
  journeyId?: string;
  stopId?: string;
};

type PublicPostFormProps = {
  action: (formData: FormData) => Promise<void>;
  Tours: JourneyOption[];
  defaults?: PublicPostFormValues;
  submitLabel: string;
  pendingLabel: string;
};

export function PublicPostForm({ action, Tours, defaults, submitLabel, pendingLabel }: PublicPostFormProps) {
  const Gigs = Tours.flatMap((Tour) =>
    Tour.Gigs.map((Gig) => ({
      id: Gig.id,
      title: Gig.title,
      journeyTitle: Tour.title,
    })),
  );

  return (
    <form action={action} className="space-y-4">
      {defaults?.postId ? <input type="hidden" name="postId" value={defaults.postId} /> : null}

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={defaults?.title ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug (optional)</Label>
        <Input id="slug" name="slug" placeholder="auto-generated-from-title" defaultValue={defaults?.slug ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt (optional)</Label>
        <Textarea id="excerpt" name="excerpt" rows={3} maxLength={320} defaultValue={defaults?.excerpt ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Content</Label>
        <Textarea id="content" name="content" rows={12} required defaultValue={defaults?.content ?? ""} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={defaults?.status ?? "DRAFT"}
            className="w-full"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="coverImageUrl">Cover image URL (optional)</Label>
          <Input id="coverImageUrl" name="coverImageUrl" type="url" defaultValue={defaults?.coverImageUrl ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="visibility">Visibility</Label>
          <select
            id="visibility"
            name="visibility"
            defaultValue={defaults?.visibility ?? "PRIVATE"}
            className="w-full"
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="journeyId">Linked Tour (optional)</Label>
          <select
            id="journeyId"
            name="journeyId"
            defaultValue={defaults?.journeyId ?? ""}
            className="w-full"
          >
            <option value="">No linked Tour</option>
            {Tours.map((Tour) => (
              <option key={Tour.id} value={Tour.id}>
                {Tour.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stopId">Linked Gig (optional)</Label>
          <select
            id="stopId"
            name="stopId"
            defaultValue={defaults?.stopId ?? ""}
            className="w-full"
          >
            <option value="">No linked Gig</option>
            {Gigs.map((Gig) => (
              <option key={Gig.id} value={Gig.id}>
                {Gig.title} ({Gig.journeyTitle})
              </option>
            ))}
          </select>
        </div>
      </div>

      <ActionSubmitButton label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}

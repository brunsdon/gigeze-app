import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createJourneyAction } from "@/features/tours/actions";
import { requireWorkspaceOwner } from "@/lib/auth/workspace";
import { visibilityOptions } from "@/lib/visibility";

export default async function NewJourneyPage() {
  const workspace = await requireWorkspaceOwner();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Create Tour</h1>
        <p className="text-muted-foreground">Set up a new Tour with visibility and travel status.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tour details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createJourneyAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="slug">Slug (optional)</Label>
                <Input id="slug" name="slug" placeholder="nsw-coast-run" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input id="endDate" name="endDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" className="w-full">
                  <option value="PLANNED">Planned</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <select
                  id="visibility"
                  name="visibility"
                  defaultValue={workspace.defaultJourneyVisibility}
                  className="w-full"
                >
                  {visibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverImageUrl">Cover image URL</Label>
                <Input id="coverImageUrl" name="coverImageUrl" type="url" />
              </div>
            </div>

            <Button type="submit">Create Tour</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

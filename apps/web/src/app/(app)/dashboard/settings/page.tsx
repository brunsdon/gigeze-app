import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateProfileSettingsAction, updateWorkspaceSettingsAction } from "@/features/settings/actions";
import { getSettingsSnapshot } from "@/features/settings/service";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import { visibilityOptions } from "@/lib/visibility";

export default async function SettingsPage() {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();
  const settings = await getSettingsSnapshot(user.id, workspace.id);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your profile, workspace identity, and default visibility behavior.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update how your name appears across your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateProfileSettingsAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={settings.user.fullName ?? ""}
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={settings.user.email} readOnly disabled />
            </div>
            <ActionSubmitButton label="Save profile" pendingLabel="Saving..." className="md:w-fit" />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace settings</CardTitle>
          <CardDescription>
            Configure workspace identity and choose default visibility for newly created content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateWorkspaceSettingsAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="workspaceName">Workspace name</Label>
              <Input id="workspaceName" name="workspaceName" defaultValue={settings.workspace.name} required />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="workspaceDescription">Workspace description</Label>
              <Textarea
                id="workspaceDescription"
                name="workspaceDescription"
                rows={3}
                defaultValue={settings.workspace.description ?? ""}
                placeholder="Tell viewers what this travel workspace is about."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultJourneyVisibility">Default Tour visibility</Label>
              <select
                id="defaultJourneyVisibility"
                name="defaultJourneyVisibility"
                defaultValue={settings.workspace.defaultJourneyVisibility}
                className="w-full"
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultPostVisibility">Default post visibility</Label>
              <select
                id="defaultPostVisibility"
                name="defaultPostVisibility"
                defaultValue={settings.workspace.defaultPostVisibility}
                className="w-full"
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultMediaVisibility">Default uploaded moment visibility</Label>
              <select
                id="defaultMediaVisibility"
                name="defaultMediaVisibility"
                defaultValue={settings.workspace.defaultMediaVisibility}
                className="w-full"
              >
                {visibilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gpsSamplingIntervalSeconds">
                GPS sampling rate (seconds)
              </Label>
              <Input
                id="gpsSamplingIntervalSeconds"
                name="gpsSamplingIntervalSeconds"
                type="number"
                min="5"
                max="300"
                step="1"
                defaultValue={settings.workspace.gpsSamplingIntervalSeconds}
                required
              />
              <p className="text-xs text-muted-foreground">
                How often to capture GPS samples during trip tracking (5-300 seconds). Lower values = more accurate tracking but higher battery usage.
              </p>
            </div>

            <ActionSubmitButton label="Save workspace settings" pendingLabel="Saving..." className="md:w-fit" />
          </form>
        </CardContent>
      </Card>
    </section>
  );
}

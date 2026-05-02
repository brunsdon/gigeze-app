import Link from "next/link";
import { CopyButton } from "@/components/ui/copy-button";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { ActionSubmitButton } from "@/components/forms/action-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAuthenticatedUser, requireWorkspaceOwner } from "@/lib/auth/workspace";
import {
  createWorkspaceInvitationAction,
  removeWorkspaceMemberAction,
  revokeWorkspaceInvitationAction,
} from "@/features/workspaces/actions";
import { listWorkspaceInvitations, listWorkspaceMembers } from "@/features/workspaces/service";
import { formatInAppTimeZone } from "@/lib/datetime";

function formatDate(value?: Date | null) {
  if (!value) {
    return "-";
  }

  return formatInAppTimeZone(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function SharingPage() {
  const user = await requireAuthenticatedUser();
  const workspace = await requireWorkspaceOwner();
  const [members, invitations] = await Promise.all([
    listWorkspaceMembers(workspace.id),
    listWorkspaceInvitations(workspace.id),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Sharing</h1>
        <p className="text-muted-foreground">Manage access to <span className="font-medium text-foreground">{workspace.name}</span>.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createWorkspaceInvitationAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Invitee email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expires at (optional)</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
            <ActionSubmitButton label="Create invitation" pendingLabel="Creating..." className="md:w-fit" />
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            {members.map((member) => {
              const isOwner = member.userId === user.id;

              return (
                <li key={member.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/75 bg-card/70 p-3 transition-colors hover:bg-muted/25">
                  <div className="space-y-0.5">
                    <p className="font-medium">{member.user.fullName || member.user.email}</p>
                    <p className="text-muted-foreground">{member.user.email}</p>
                    <p className="text-muted-foreground">Role: {member.role}{isOwner ? " (you)" : ""}</p>
                    <p className="text-muted-foreground">Joined: {formatDate(member.createdAt)}</p>
                  </div>
                  {!isOwner ? (
                    <form action={removeWorkspaceMemberAction} id={`remove-member-${member.id}`}>
                      <input type="hidden" name="targetUserId" value={member.userId} />
                      <ConfirmSubmitButton
                        formId={`remove-member-${member.id}`}
                        triggerLabel="Remove"
                        title="Remove member?"
                        description="This member will lose access to shared content immediately."
                        confirmLabel="Remove member"
                        size="sm"
                      />
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {!invitations.length ? (
            <p className="text-sm text-muted-foreground">No invitations created yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {invitations.map((invitation) => {
                const inviteUrl = `/invite/${invitation.token}`;

                return (
                  <li key={invitation.id} className="rounded-xl border border-border/75 bg-card/70 p-3 transition-colors hover:bg-muted/25">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-muted-foreground">Status: {invitation.status}</p>
                        <p className="text-muted-foreground">Created by: {user.email}</p>
                        <p className="text-muted-foreground">Expires: {formatDate(invitation.expiresAt)}</p>
                        {invitation.status === "PENDING" ? (
                          <div className="flex items-center gap-2 pt-1">
                            <Link href={`/invite/${invitation.token}`} className="text-foreground text-xs underline underline-offset-4 break-all">
                              /invite/{invitation.token}
                            </Link>
                            <CopyButton text={inviteUrl} label="Copy link" />
                          </div>
                        ) : null}
                      </div>
                      {invitation.status === "PENDING" ? (
                        <form action={revokeWorkspaceInvitationAction} id={`revoke-${invitation.id}`}>
                          <input type="hidden" name="invitationId" value={invitation.id} />
                          <ConfirmSubmitButton
                            formId={`revoke-${invitation.id}`}
                            triggerLabel="Revoke"
                            title="Revoke invitation?"
                            description="The invite link will Gig working immediately."
                            confirmLabel="Revoke invitation"
                            size="sm"
                          />
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

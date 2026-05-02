import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptWorkspaceInvitationAction } from "@/features/workspaces/actions";
import { getInvitationByToken } from "@/features/workspaces/service";
import { getCurrentUser } from "@/lib/auth/workspace";

function formatDate(value?: Date | null) {
  if (!value) {
    return "No expiry";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    timeZone: "Australia/Sydney",
    year: "numeric",
  }).format(value);
}

const statusLabel: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REVOKED: "Revoked",
  EXPIRED: "Expired",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "default",
  ACCEPTED: "secondary",
  REVOKED: "destructive",
  EXPIRED: "outline",
};

export default async function InviteTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    notFound();
  }

  const currentUser = await getCurrentUser();
  const canAccept = Boolean(currentUser && invitation.status === "PENDING");
  const inviterName = invitation.workspace.owner.fullName || invitation.workspace.owner.email;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">You&apos;re invited</CardTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{inviterName}</span> has invited you to view shared content in{" "}
            <span className="font-medium text-foreground">{invitation.workspace.name}</span>.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Workspace</span>
              <span className="font-medium">{invitation.workspace.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invited by</span>
              <span className="font-medium">{inviterName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invited email</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={statusVariant[invitation.status] ?? "outline"}>
                {statusLabel[invitation.status] ?? invitation.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium">{formatDate(invitation.expiresAt)}</span>
            </div>
          </div>

          {canAccept ? (
            <form action={acceptWorkspaceInvitationAction}>
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">
                Accept invitation
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {invitation.status === "ACCEPTED" && currentUser ? (
                <>
                  <p className="text-sm text-muted-foreground">You have already accepted this invitation.</p>
                  <Link
                    href={`/shared/${invitation.workspace.slug}`}
                    className="block w-full rounded-md border px-4 py-2 text-center text-sm font-medium hover:bg-muted"
                  >
                    Open {invitation.workspace.name}
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {currentUser
                      ? "This invitation can no longer be accepted."
                      : "Sign in or sign up with the invited email to accept this invitation."}
                  </p>
                  {!currentUser ? (
                    <Link
                      href={`/login?next=/invite/${token}`}
                      className="block w-full rounded-md border px-4 py-2 text-center text-sm font-medium hover:bg-muted"
                    >
                      Sign in to accept
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

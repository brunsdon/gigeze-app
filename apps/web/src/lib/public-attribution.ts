type PublicAttributionSource = {
  createdByUser?: {
    fullName: string | null;
    email: string;
  } | null;
  workspace?: {
    name: string;
  } | null;
};

function getOwnerLabel(owner?: { fullName: string | null; email: string } | null) {
  if (!owner) {
    return null;
  }

  const fullName = owner.fullName?.trim();
  if (fullName) {
    return fullName;
  }

  const emailPrefix = owner.email.split("@")[0]?.trim();
  return emailPrefix || null;
}

function getWorkspaceLabel(workspace?: { name: string } | null) {
  const label = workspace?.name?.trim();
  return label || null;
}

export function formatPublicAttribution(source: PublicAttributionSource) {
  const ownerLabel = getOwnerLabel(source.createdByUser);
  const workspaceLabel = getWorkspaceLabel(source.workspace);

  if (ownerLabel && workspaceLabel && ownerLabel.toLowerCase() !== workspaceLabel.toLowerCase()) {
    return `${ownerLabel} from ${workspaceLabel}`;
  }

  return ownerLabel || workspaceLabel || "the road community";
}

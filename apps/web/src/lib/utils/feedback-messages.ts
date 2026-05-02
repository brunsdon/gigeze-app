const SUCCESS_MESSAGE_MAP: Record<string, string> = {
  created: "Created successfully.",
  updated: "Updated successfully.",
  deleted: "Deleted successfully.",
  "Tour-updated": "Tour updated successfully.",
  "Tour-deleted": "Tour deleted successfully.",
  "Tour-created": "Tour created successfully.",
  "Tour-status-updated": "Tour active status updated.",
  "Tour-duplicated": "Tour duplicated successfully.",
  "Gig-created": "Gig added successfully.",
  "Gig-updated": "Gig updated successfully.",
  "Gig-deleted": "Gig deleted successfully.",
  "Gig-order-updated": "Gig order updated successfully.",
  "Gig-duplicated": "Gig duplicated successfully.",
  "metadata-created": "Uploaded moment metadata saved successfully.",
  "media-updated": "Uploaded moment metadata updated successfully.",
  "media-deleted": "Uploaded moment metadata deleted successfully.",
  "driving-log-created": "Driving log saved successfully.",
  "driving-log-updated": "Driving log updated successfully.",
  "driving-log-deleted": "Driving log deleted successfully.",
  "activity-note-created": "Activity saved successfully.",
  "activity-note-updated": "Activity updated successfully.",
  "activity-note-deleted": "Activity deleted successfully.",
  "post-created": "Post created successfully.",
  "post-updated": "Post updated successfully.",
  "post-deleted": "Post deleted successfully.",
  "post-published": "Post published successfully.",
  "post-unpublished": "Post moved back to draft.",
  "settings-profile-saved": "Profile settings saved.",
  "settings-workspace-saved": "Workspace settings saved.",
};

const ERROR_MESSAGE_MAP: Record<string, string> = {
  "invalid-Tour-reference": "We could not identify that Tour. Please refresh and try again.",
  "Tour-invalid-input": "Tour details are invalid. Check required fields and try again.",
  "Tour-slug-conflict": "That slug is already in use by another Tour.",
  "Tour-not-found": "We could not find that Tour.",
  "Tour-has-dependent-records": "Delete linked driving logs, activity notes, and uploaded moments before deleting this Tour.",
  "invalid-Gig-reference": "We could not identify that Gig. Please refresh and try again.",
  "Gig-invalid-input": "Gig details are invalid. Check coordinates and required fields.",
  "Gig-not-found": "We could not find that Gig.",
  "Gig-Tour-mismatch": "That Gig does not belong to this Tour.",
  "invalid-log-reference": "We could not identify that driving log. Please refresh and try again.",
  "driving-log-invalid-input": "Driving log values are invalid. Check odometer and km totals.",
  "driving-log-not-found": "We could not find that driving log.",
  "invalid-activity-note-reference": "We could not identify that activity note. Please refresh and try again.",
  "activity-note-invalid-input": "Activity details are invalid. Check the required fields and try again.",
  "activity-note-not-found": "We could not find that activity note.",
  "activity-note-invalid-Tour-reference": "We could not identify that Tour. Please refresh and try again.",
  "activity-note-invalid-Gig-reference": "We could not identify that Gig. Please refresh and try again.",
  "activity-note-Gig-Tour-mismatch": "That Gig does not belong to the selected Tour.",
  "invalid-media-reference": "We could not identify that uploaded moment. Please refresh and try again.",
  "media-not-found": "We could not find that uploaded moment.",
  "media-storage-path-missing": "This uploaded moment has no valid storage path, so it could not be deleted safely.",
  "media-storage-object-missing": "The file is already missing in storage. Metadata was kept for safety.",
  "media-storage-delete-failed": "Storage deletion failed, so metadata was not removed.",
  "invalid-post-reference": "We could not identify that post. Please refresh and try again.",
  "post-invalid-input": "Post details are invalid. Check required fields and try again.",
  "post-not-found": "We could not find that post.",
  "post-invalid-Tour-reference": "The linked Tour does not exist.",
  "post-invalid-Gig-reference": "The linked Gig does not exist.",
  "post-Gig-Tour-mismatch": "Linked Gig does not belong to the selected Tour.",
  "settings-profile-invalid": "Profile settings are invalid. Please check your display name.",
  "settings-workspace-invalid": "Workspace settings are invalid. Please review the form values.",
  "missing-file-path-name": "File path and file name are required.",
  "auth-config-missing": "Authentication is not configured. Check Supabase environment variables.",
  "db-unavailable": "Database is currently unavailable. Please retry in a moment.",
};

export function getSuccessMessage(code: string): string {
  return SUCCESS_MESSAGE_MAP[code] ?? humanizeCode(code);
}

export function getErrorMessage(raw: string): string {
  const message = raw.trim();
  if (!message) {
    return "Something went wrong.";
  }
  return ERROR_MESSAGE_MAP[message] ?? message;
}

export function humanizeCode(value: string): string {
  const message = value.replaceAll("-", " ").trim();
  if (!message) {
    return "Operation completed.";
  }
  return message.charAt(0).toUpperCase() + message.slice(1);
}

import { Visibility } from "@prisma/client";

export const visibilityOptions = [
  { value: Visibility.PRIVATE, label: "Private" },
  { value: Visibility.SHARED, label: "Shared" },
  { value: Visibility.PUBLIC, label: "Public" },
] as const;

export function getVisibilityLabel(visibility: Visibility) {
  switch (visibility) {
    case Visibility.PRIVATE:
      return "Private";
    case Visibility.SHARED:
      return "Shared";
    case Visibility.PUBLIC:
      return "Public";
    default:
      return visibility;
  }
}

export function parseVisibility(value: FormDataEntryValue | null | undefined): Visibility {
  const normalized = String(value ?? Visibility.PRIVATE).toUpperCase();

  if (normalized === Visibility.PUBLIC) {
    return Visibility.PUBLIC;
  }

  if (normalized === Visibility.SHARED) {
    return Visibility.SHARED;
  }

  return Visibility.PRIVATE;
}

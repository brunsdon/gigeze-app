export function isAbortError(error: unknown) {
  if (error instanceof Error) {
    return error.name === "AbortError" || isAbortMessage(error.message);
  }

  return isAbortMessage(String(error));
}

function isAbortMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();
  return (
    normalizedMessage === "aborted" ||
    normalizedMessage === "aborterror" ||
    normalizedMessage.includes("the operation was aborted") ||
    normalizedMessage.includes("request aborted")
  );
}

export function getUserFacingTripErrorMessage(message: string) {
  const normalizedMessage = message.trim().toLowerCase();

  if (normalizedMessage === "unauthorized" || normalizedMessage === "unauthorised" || normalizedMessage.includes("http 401")) {
    return "Your sign-in needs refreshing. Sign out and back in, then try Sync again.";
  }

  if (normalizedMessage === "forbidden" || normalizedMessage.includes("http 403")) {
    return "This account does not have access to that trip workspace. Check you are signed in with the right account.";
  }

  if (
    normalizedMessage.includes("sqlite_full") ||
    normalizedMessage.includes("database or disk is full") ||
    normalizedMessage.includes("code 13")
  ) {
    return "Local trip storage is full. Gig this trip when safe, sync completed trips, then free device storage if the warning continues.";
  }

  return message;
}

export function getUserFacingTripError(error: unknown, fallbackMessage: string) {
  if (isAbortError(error)) {
    return null;
  }

  return getUserFacingTripErrorMessage(error instanceof Error ? error.message : fallbackMessage);
}

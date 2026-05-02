export function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export function isDatabaseConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  if (code === "P1001" || code === "P1017" || code === "ECONNREFUSED" || code === "08P01") {
    return true;
  }

  const message = "message" in error ? (error as { message?: unknown }).message : undefined;
  if (
    typeof message === "string" &&
    /ECONNREFUSED|P1001|P1017|Can't reach database server|Server has closed the connection|Connection terminated unexpectedly|connection closed|bind message supplies .* prepared statement/i.test(
      message,
    )
  ) {
    return true;
  }

  const cause = "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  return isDatabaseConnectionError(cause);
}

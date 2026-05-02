import { z } from "zod";

export class EnvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvConfigError";
  }
}

export function formatEnvIssues(error: z.ZodError, scope: "server" | "public") {
  const details = error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "unknown";
      return `- ${key}: ${issue.message}`;
    })
    .join("\n");

  return `Invalid ${scope} environment configuration:\n${details}`;
}

export function isEnvConfigError(error: unknown): error is EnvConfigError {
  return error instanceof EnvConfigError;
}

/** Shared typed errors for integration plumbing. */

/** Thrown when a required per-org / env API key is not configured. */
export class MissingKeyError extends Error {
  constructor(public readonly key: string) {
    super(`${key} is not configured. Add it in Dashboard → Admin.`);
    this.name = "MissingKeyError";
  }
}

/** Thrown when a Higgsfield spend needs explicit human confirmation. */
export class ConfirmationRequiredError extends Error {
  constructor(
    message: string,
    public readonly estimatedCredits: number,
  ) {
    super(message);
    this.name = "ConfirmationRequiredError";
  }
}

export function isMissingKey(e: unknown): e is MissingKeyError {
  return e instanceof MissingKeyError;
}
export function isConfirmationRequired(e: unknown): e is ConfirmationRequiredError {
  return e instanceof ConfirmationRequiredError;
}

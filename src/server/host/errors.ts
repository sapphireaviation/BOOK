import "server-only";

/** Input that parsed but cannot be saved. `fields` maps form field names to messages. */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

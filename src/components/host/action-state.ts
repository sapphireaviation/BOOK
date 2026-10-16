/** What every host and admin server action returns to its form. */
export type ActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
  /** Field name to message, shown under the matching input. */
  fields?: Record<string, string>;
  /** Changes on every result so the same message can be announced twice. */
  at?: number;
};

export const idleState: ActionState = { status: "idle" };

import "server-only";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ActionState } from "@/components/host/action-state";
import { AccessError, requireActor } from "./access";
import { ValidationError } from "./errors";
import { fieldErrors } from "./schemas";
import type { Actor, Role } from "./rules";

/** Form data as a plain object; repeated keys (checkbox groups) become arrays when asked for. */
export function formObject(formData: FormData, arrays: string[] = []) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (typeof value !== "string") continue;
    if (arrays.includes(key)) out[key] = [...((out[key] as string[] | undefined) ?? []), value];
    else out[key] = value;
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}

/**
 * Runs one host or admin action: checks the role, validates the form with the schema,
 * calls the service, refreshes the page and turns known errors into form messages.
 */
export async function runAction<S extends z.ZodType>(opts: {
  roles?: Role[];
  schema: S;
  formData: FormData;
  arrays?: string[];
  ok: string;
  run: (actor: Actor, input: z.infer<S>) => Promise<string | void>;
}): Promise<ActionState> {
  try {
    const actor = await requireActor(opts.roles);
    const parsed = opts.schema.safeParse(formObject(opts.formData, opts.arrays));
    if (!parsed.success) {
      return { status: "error", message: "Check the highlighted fields.", fields: fieldErrors(parsed.error), at: Date.now() };
    }
    const message = await opts.run(actor, parsed.data);
    refresh();
    return { status: "ok", message: message || opts.ok, at: Date.now() };
  } catch (err) {
    unstable_rethrow(err);
    return errorState(err);
  }
}

export function errorState(err: unknown): ActionState {
  if (err instanceof ValidationError) return { status: "error", message: err.message, fields: err.fields, at: Date.now() };
  if (err instanceof AccessError) return { status: "error", message: err.message, at: Date.now() };
  console.error("host action failed", err);
  return { status: "error", message: "Something went wrong on our side and nothing was saved. Try again in a minute.", at: Date.now() };
}

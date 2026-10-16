import { formatDay } from "@/lib/dates";

/**
 * "Fri 24 Oct", the date style in docs/WRITING.md. Some locales put a comma after the weekday
 * ("Fri, 24 Oct"), so it is removed here.
 */
export function dayLabel(d: string | Date, locale?: string) {
  return formatDay(d, locale).replace(",", "");
}

/** "1 guest", "3 guests" */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

import { Badge } from "@/components/ui";

/** Shown wherever fares come from the development fixture provider instead of airlines. */
export function TestDataBadge({ provider }: { provider: string | undefined }) {
  if (provider !== "fixture") return null;
  return (
    <Badge tone="bad" className="gap-1">
      <span>Test data</span>
      <span className="sr-only">: these fares are generated for development and cannot be booked with an airline</span>
    </Badge>
  );
}

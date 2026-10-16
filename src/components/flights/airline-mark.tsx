import Image from "next/image";
import { cn } from "@/components/ui";
import type { Carrier } from "@/server/flights/types";

/** Airline logo from the provider, or the airline's code on a quiet tile when there is no logo. */
export function AirlineMark({ carrier, size = 28, className }: { carrier: Carrier; size?: number; className?: string }) {
  if (carrier.logoUrl) {
    return (
      <Image
        src={carrier.logoUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={cn("shrink-0 object-contain", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-sm border border-line bg-surface text-2xs font-bold text-slate", className)}
      style={{ width: size, height: size }}
    >
      {carrier.iata}
    </span>
  );
}

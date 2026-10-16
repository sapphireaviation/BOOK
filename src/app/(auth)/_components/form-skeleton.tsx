import { Skeleton } from "@/components/ui";

/** Shown for a moment while the form reads the URL. Same footprint as the form, so nothing jumps. */
export function FormSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl">{title}</h1>
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-11" />
      </div>
    </div>
  );
}

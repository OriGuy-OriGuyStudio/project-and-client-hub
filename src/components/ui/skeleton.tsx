import { cn } from "@/lib/utils";

/** Brand-tinted shimmer placeholder. Used for every data load (no spinners). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-md",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };

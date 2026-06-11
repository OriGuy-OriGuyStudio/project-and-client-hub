import { cn } from "@/lib/utils";

/** Brand-tinted shimmer placeholder. Used for every data load (no spinners). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-foreground/10",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };

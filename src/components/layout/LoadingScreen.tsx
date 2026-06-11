import { Skeleton } from "@/components/ui/skeleton";

/** Full-screen branded loading state (no mid-page spinners, per UX spec). */
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-primary/80" />
        <span className="font-heading text-xl font-bold text-foreground">
          Studio Ori Guy
        </span>
      </div>
      <div className="w-56 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <span className="sr-only">טוען…</span>
    </div>
  );
}

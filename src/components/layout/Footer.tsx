import { Rocket } from "lucide-react";
import { Copyright } from "@/components/ui/copyright";
import { LiveClock } from "@/components/ui/live-clock";
import { requestWarp } from "@/lib/warp";
import { cn } from "@/lib/utils";

/** App-wide footer: copyright (auto year) on one side, live Israel clock on
 * the other. Used inside the authenticated shell and on the login screens. */
export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        // Reserve physical-left clearance so the live clock never sits under
        // the floating AI bubble (fixed bottom-left, ~56px wide).
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border px-4 py-3 pl-20 text-xs text-muted-foreground sm:px-6 sm:pl-24",
        className
      )}
    >
      <Copyright />
      <button
        type="button"
        onClick={() => requestWarp()}
        title="לחצו להמראה 🚀"
        aria-label="Orion by Studio Ori Guy"
        className="group order-last inline-flex w-full cursor-pointer items-center justify-center gap-1.5 text-center transition-colors hover:text-primary sm:order-none sm:w-auto"
      >
        <Rocket className="size-3 -translate-y-px opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-primary" />
        <span>
          <span className="font-semibold text-foreground/80 transition-colors group-hover:text-primary">
            Orion
          </span>{" "}
          <span className="text-muted-foreground/70">by Studio Ori Guy</span>
        </span>
      </button>
      <span className="flex items-center gap-1.5">
        <span className="hidden sm:inline">שעון ישראל</span>
        <LiveClock className="text-foreground/80" />
      </span>
    </footer>
  );
}

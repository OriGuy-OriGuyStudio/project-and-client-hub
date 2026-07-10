import { Rocket } from "lucide-react";
import { Link } from "react-router-dom";
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
        // Desktop uses a 3-col grid so the Orion credit is truly centered
        // regardless of the (unequal) copyright/clock widths.
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-4 py-3 pl-20 text-xs text-muted-foreground sm:grid sm:grid-cols-3 sm:gap-y-1 sm:px-6 sm:pl-24",
        className
      )}
    >
      {/* Mobile: copyright + clock share row 1, the Orion credit drops to row 2. */}
      <span className="order-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:col-start-1 sm:justify-self-start">
        <Copyright />
        <span className="text-muted-foreground/40" aria-hidden="true">·</span>
        <Link to="/terms" className="transition-colors hover:text-primary">תקנון</Link>
        <Link to="/privacy" className="transition-colors hover:text-primary">פרטיות</Link>
      </span>
      <span className="order-2 flex items-center gap-1.5 sm:order-3 sm:col-start-3 sm:justify-self-end">
        <span className="hidden sm:inline">שעון ישראל</span>
        <LiveClock className="text-foreground/80" />
      </span>
      <button
        type="button"
        onClick={() => requestWarp()}
        title="לחצו להמראה 🚀"
        aria-label="Orion by Studio Ori Guy"
        className="group order-3 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 text-center transition-colors hover:text-primary sm:order-2 sm:col-start-2 sm:w-auto sm:justify-self-center"
      >
        <Rocket className="size-3 -translate-y-px opacity-40 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-primary" />
        <span>
          <span className="font-semibold text-foreground/80 transition-colors group-hover:text-primary">
            Orion
          </span>{" "}
          <span className="text-muted-foreground/70">by Studio Ori Guy</span>
        </span>
      </button>
    </footer>
  );
}

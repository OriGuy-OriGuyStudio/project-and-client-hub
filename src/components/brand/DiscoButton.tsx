import type { MouseEvent } from "react";
import { Zap } from "lucide-react";
import { GlassButton } from "@/components/ui/glass-button";
import { requestDotsDisco } from "@/lib/dots-fx";
import { sparkBurst } from "@/lib/confetti";
import { cn } from "@/lib/utils";

/**
 * Playful login-screen control: lights the dots background in a random "disco"
 * twinkle and pops a firework spark from the button — just to invite people to
 * poke at the interface.
 */
export function DiscoButton({ className }: { className?: string }) {
  function onClick(e: MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    sparkBurst(r.left + r.width / 2, r.top + r.height / 2);
    requestDotsDisco();
  }

  // Positioning lives on this wrapper — the GlassButton's own wrap is
  // position:relative (for its glass shadow), so it can't take layout classes.
  return (
    <div className={cn("w-fit", className)}>
      <GlassButton
        size="sm"
        onClick={onClick}
        contentClassName="flex items-center gap-2"
        aria-label="הפעלת מצב דיסקו לרקע"
        title="דיסקו!"
      >
        <Zap className="size-4 text-primary" />
        <span>דיסקו</span>
      </GlassButton>
    </div>
  );
}

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Formats the current moment as HH:MM:SS in Israel time, regardless of the
 * viewer's own timezone. No timezone label — just the running clock. */
function israelTime(): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Live ticking clock pinned to Israel time. */
export function LiveClock({ className }: { className?: string }) {
  const [time, setTime] = useState(israelTime);

  useEffect(() => {
    const id = setInterval(() => setTime(israelTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      dir="ltr"
      aria-label="השעה בישראל"
      className={cn("font-mono-code tabular-nums", className)}
    >
      {time}
    </span>
  );
}

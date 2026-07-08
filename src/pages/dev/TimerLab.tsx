import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TimerBoard } from "@/components/timer/TimerBoard";
import { TimerWidget } from "@/components/timer/TimerWidget";
import { timer } from "@/lib/timer-store";
import { seedTimeMock } from "@/pages/dev/mock-time";

/**
 * DEV-ONLY visual harness for the timer (mounted at /__timerlab, gated on
 * import.meta.env.DEV in App.tsx). Seeds mock data + a project context so the
 * daily summary and session list render without the Google-OAuth admin login.
 * Never shipped: excluded from production builds.
 */
export default function TimerLab() {
  const qc = useQueryClient();
  useState(() => {
    seedTimeMock(qc);
    timer.setCtx({
      kind: "stage",
      projectId: "p1",
      projectName: "דנה לוי , סטודיו עיצוב",
      stageId: "s1",
      stageName: "עיצוב",
    });
    return true;
  });
  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 text-foreground">
      <p className="mx-auto mb-4 max-w-5xl text-center text-xs text-muted-foreground">
        מעבדת טיימר (DEV, נתוני דמה).
      </p>
      <TimerBoard />
      <TimerWidget />
    </div>
  );
}

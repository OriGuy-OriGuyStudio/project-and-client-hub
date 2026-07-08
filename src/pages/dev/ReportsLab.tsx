import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ReportsSection } from "@/pages/admin/TimeReports";
import { seedTimeMock } from "@/pages/dev/mock-time";

/**
 * DEV-ONLY: preview the reports dashboard with mock data, no auth. Mounted at
 * /__reportslab (gated on import.meta.env.DEV in App.tsx). Never ships.
 */
export default function ReportsLab() {
  const qc = useQueryClient();
  // Seed the cache once, synchronously, before ReportsSection's queries mount.
  useState(() => {
    seedTimeMock(qc);
    return true;
  });
  return (
    <div dir="rtl" className="mx-auto min-h-screen max-w-4xl bg-background p-6 text-foreground">
      <p className="mb-4 text-center text-xs text-muted-foreground">מעבדת דוחות (DEV, נתוני דמה)</p>
      <ReportsSection />
    </div>
  );
}

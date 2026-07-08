import type { QueryClient } from "@tanstack/react-query";

/** DEV-ONLY shared mock data for the timer/reports harnesses (no auth). */
const iso = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600_000).toISOString();

export const MOCK_PROJECTS = [
  { id: "p1", client_id: "c1", business_name: "דנה לוי , סטודיו עיצוב", title: "אתר לסטודיו עיצוב", logo_url: null, logo_fit: "auto" },
  { id: "p2", client_id: "c2", business_name: "מסעדת הגליל", title: "אתר מסעדה + תפריט", logo_url: null, logo_fit: "auto" },
];
export const MOCK_STAGES = [
  { id: "s1", title: "עיצוב", project_id: "p1" },
  { id: "s2", title: "פיתוח", project_id: "p1" },
  { id: "s3", title: "אפיון", project_id: "p2" },
  { id: "s4", title: "עיצוב", project_id: "p2" },
];
export const MOCK_BILLING = [
  { project_id: "p1", value: 8000 },
  { project_id: "p2", value: 12000 },
];
const S = (o: Record<string, unknown>) => ({
  id: Math.random().toString(36).slice(2),
  owner_id: "dev",
  kind: "stage",
  project_id: null,
  stage_id: null,
  label: null,
  mode: "up",
  planned_seconds: null,
  ended_at: null,
  note: null,
  created_at: iso(0),
  ...o,
});
export const MOCK_SESSIONS = [
  S({ kind: "stage", project_id: "p1", stage_id: "s1", mode: "up", duration_seconds: 4920, started_at: iso(3), note: "לוגו ראשוני + מסך בית" }),
  S({ kind: "stage", project_id: "p1", stage_id: "s1", mode: "down", duration_seconds: 1500, started_at: iso(6) }),
  S({ kind: "stage", project_id: "p1", stage_id: "s2", mode: "up", duration_seconds: 3600, started_at: iso(26) }),
  S({ kind: "personal", label: "הצעות מחיר", project_id: "p1", mode: "down", duration_seconds: 1200, started_at: iso(5) }),
  S({ kind: "stage", project_id: "p2", stage_id: "s3", mode: "up", duration_seconds: 2400, started_at: iso(50) }),
  S({ kind: "stage", project_id: "p2", stage_id: "s4", mode: "down", duration_seconds: 3000, started_at: iso(51), note: "צבעים + טיפוגרפיה" }),
  S({ kind: "personal", label: "למידה", mode: "down", duration_seconds: 2400, started_at: iso(2) }),
  S({ kind: "personal", label: "סושיאל", mode: "up", duration_seconds: 1800, started_at: iso(74) }),
];

export function seedTimeMock(qc: QueryClient) {
  qc.setQueryData(["projects"], MOCK_PROJECTS as never);
  qc.setQueryData(["time-sessions"], MOCK_SESSIONS as never);
  qc.setQueryData(["all-stages"], MOCK_STAGES as never);
  qc.setQueryData(["project-billing-all"], MOCK_BILLING as never);
  qc.setQueryData(["project-billing", "p1"], { project_id: "p1", value: 8000 } as never);
  qc.setQueryData(["project-billing", "p2"], { project_id: "p2", value: 12000 } as never);
}

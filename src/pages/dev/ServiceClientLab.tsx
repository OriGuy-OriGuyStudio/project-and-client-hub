import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Service from "@/pages/client/Service";
import { MOCK_PROJECTS } from "@/pages/dev/mock-time";

/** DEV-ONLY: preview the real client "השירות שלך" page with seeded data. */
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

const METRICS = [0, 1, 2, 3, 4, 5, 6].map((d, i) => ({
  id: `m${i}`,
  project_id: "p1",
  metric_date: iso(d),
  visitors: [194, 240, 190, 210, 150, 180, 120][i],
  pageviews: [310, 388, 300, 340, 250, 300, 200][i],
  sessions: [210, 260, 205, 230, 165, 195, 130][i],
  pagespeed: 92,
  lcp_ms: 1200,
  cls: 0.02,
  inp_ms: 90,
  uptime_pct: 99.98,
  threats_blocked: 47,
  meta: null,
  created_at: new Date().toISOString(),
}));

const LOG = [
  { id: "l1", project_id: "p1", kind: "update", title: "עדכון ליבה ו-4 תוספים", count: 5, occurred_at: new Date().toISOString(), meta: null },
  { id: "l2", project_id: "p1", kind: "backup", title: "גיבוי אוטומטי", count: 1, occurred_at: new Date(Date.now() - 86400000).toISOString(), meta: null },
  { id: "l3", project_id: "p1", kind: "scan", title: "סריקת אבטחה , נקי", count: 1, occurred_at: new Date(Date.now() - 2 * 86400000).toISOString(), meta: null },
  { id: "l4", project_id: "p1", kind: "service_call", title: "תיקון תצוגה בנייד", count: 1, occurred_at: new Date(Date.now() - 3 * 86400000).toISOString(), meta: null },
];

const SUMMARY = {
  hours_month: 1.5,
  hours_total: 24,
  service_calls_month: 2,
  updates_total: 148,
  backups_total: 420,
  threats_total: 1830,
};

export default function ServiceClientLab() {
  const qc = useQueryClient();
  useState(() => {
    qc.setQueryData(["projects"], MOCK_PROJECTS as never);
    qc.setQueryData(
      ["my-services"],
      [
        {
          project_id: "p1",
          tier: "pro",
          site_type: "wordpress",
          site_url: "https://blog.example.com",
          monthly_price: null,
          hourly_rate: 160,
          started_at: "2026-01-01",
          billing_day: 1,
          active: true,
          updated_at: new Date().toISOString(),
        },
      ] as never,
    );
    qc.setQueryData(["site-metrics", "p1", 30], METRICS as never);
    qc.setQueryData(["maintenance-log", "p1", 40], LOG as never);
    qc.setQueryData(["service-summary", "p1"], SUMMARY as never);
    return true;
  });
  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 text-foreground">
      <Service />
    </div>
  );
}

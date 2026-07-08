import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Projects from "@/pages/admin/Projects";
import { MOCK_CLIENTS } from "@/pages/dev/mock-time";

/** DEV-ONLY: preview the admin Projects page (client vs studio split), no auth. */
const P = (id: string, client_id: string, business_name: string, title: string) => ({
  id,
  client_id,
  business_name,
  title,
  description: null,
  status: "active",
  logo_url: null,
  logo_fit: "auto",
  figma_url: null,
  live_url: null,
  staging_url: null,
  warranty_start_date: null,
  warranty_end_date: null,
  warranty_email_sent: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const PROJECTS = [
  P("p1", "c1", "דנה לוי , סטודיו עיצוב", "אתר לסטודיו עיצוב"),
  P("p2", "c2", "מסעדת הגליל", "אתר מסעדה + תפריט"),
  P("pm", "c3", "Matx-il", "אתר תדמית"),
  P("p3", "c4", "Studio Ori Guy", "Orion — פורטל הלקוחות"),
  P("p4", "c4", "Studio Ori Guy", "Pixel — צ׳אט AI"),
  P("p5", "c4", "Studio Ori Guy", "ניהול ואדמיניסטרציה"),
];

export default function ProjectsLab() {
  const qc = useQueryClient();
  useState(() => {
    qc.setQueryData(["projects"], PROJECTS as never);
    qc.setQueryData(["clients"], MOCK_CLIENTS as never);
    return true;
  });
  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 text-foreground">
      <Projects />
    </div>
  );
}

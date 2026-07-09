import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ServiceBoard } from "@/pages/client/Service";
import { fetchServicePreview } from "@/hooks/useService";

/** Public, read-only snapshot of a client's "השירות שלך" dashboard (share link). */
export default function ServicePreview() {
  const { token = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["service-preview", token],
    enabled: !!token,
    queryFn: () => fetchServicePreview(token),
  });

  if (isLoading) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-background">
        <CenteredLoader label="טוען…" />
      </div>
    );
  }
  if (!data) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center bg-background p-6">
        <EmptyState
          icon={ShieldCheck}
          title="הקישור אינו זמין"
          description="ייתכן שהתצוגה כובתה. אפשר לפנות לסטודיו לקבלת קישור מעודכן."
        />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
            תצוגה לדוגמה · Orion
          </span>
          <h1 className="mt-3 font-heading text-2xl font-black">השירות שלך</h1>
          <p className="text-sm text-muted-foreground">ככה נראה ומרגיש ממשק התחזוקה שלך אצל הסטודיו</p>
        </div>
        <ServiceBoard
          svc={data.service}
          projectName={data.business_name}
          readOnly
          preview={{ metrics: data.metrics, log: data.log, summary: data.summary }}
        />
      </div>
    </div>
  );
}

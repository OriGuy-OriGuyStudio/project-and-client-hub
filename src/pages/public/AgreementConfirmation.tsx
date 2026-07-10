import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * Permanent, public confirmation of an approved maintenance package, reachable
 * at /l/agreement/:accessToken. It renders the FROZEN snapshot saved at approval
 * time (get_service_agreement), so it always shows exactly what the client
 * agreed to, even after the landing page or terms change. Read-only + printable.
 */

interface Snapshot {
  version?: string;
  tier_name?: string;
  site_type_label?: string;
  price?: number;
  response_hours?: number;
  work_hours?: number;
  features?: string[];
  blocks?: { title: string; items: string[] }[];
  usage_approval?: string;
}
interface Agreement {
  id: string;
  created_at: string;
  tier: string;
  site_type: string;
  monthly_price: number | null;
  full_name: string | null;
  business: string | null;
  email: string | null;
  phone: string | null;
  signature: string | null;
  terms_version: string;
  terms_snapshot: Snapshot;
  status: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen bg-background text-foreground" dir="rtl">
      <div className="mx-auto max-w-3xl px-5 py-10 sm:py-16">{children}</div>
    </div>
  );
}

export default function AgreementConfirmation() {
  const { accessToken } = useParams();
  const [a, setA] = useState<Agreement | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("get_service_agreement", { p_access_token: accessToken || "" });
      if (alive) setA((data as unknown as Agreement | null) || null);
    })();
    return () => { alive = false; };
  }, [accessToken]);

  if (a === undefined) return <Shell><p className="text-muted-foreground">טוען…</p></Shell>;
  if (a === null)
    return (
      <Shell>
        <h1 className="font-heading text-3xl font-black">האישור לא נמצא</h1>
        <p className="mt-3 text-muted-foreground">ייתכן שהקישור שגוי או פג. אפשר לפנות אלינו ונשלח לך אותו מחדש.</p>
      </Shell>
    );

  const s = a.terms_snapshot || {};
  const price = a.monthly_price ?? s.price ?? 0;
  const date = new Date(a.created_at).toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <Shell>
      {/* confirmation banner */}
      <div className="flex flex-col items-center text-center">
        <span className="grid size-16 place-items-center rounded-full border border-primary/40 bg-primary/12 text-primary">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
        </span>
        <h1 className="mt-5 font-heading text-4xl font-black">האישור התקבל.</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          זהו התיעוד הקבוע של מה שאישרת ב-{date}. שמור את הקישור, הוא נגיש לך בכל עת. לא בוצע חיוב בשלב זה; החיוב יתואם בנפרד.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="mt-5 rounded-full border border-border bg-white/5 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary print:hidden"
        >
          הדפסה / שמירה כ-PDF
        </button>
      </div>

      {/* who + when */}
      <div className="mt-9 grid gap-3 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2">
        <Row k="מאשר/ת">{a.full_name || "לא צוין"}</Row>
        <Row k="עסק">{a.business || "לא צוין"}</Row>
        <Row k="אימייל">{a.email || "לא צוין"}</Row>
        <Row k="טלפון">{a.phone || "לא צוין"}</Row>
        <Row k="תאריך אישור">{date}</Row>
        <Row k="סוג האתר">{s.site_type_label || a.site_type}</Row>
      </div>

      {/* the package */}
      <div className="mt-5 rounded-2xl border border-primary/30 bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-heading text-2xl font-black">{s.tier_name || a.tier}</h2>
          <div className="font-heading text-3xl font-black">
            ₪{Number(price).toLocaleString("he-IL")}
            <span className="text-sm font-semibold text-muted-foreground"> / לחודש</span>
          </div>
        </div>
        {(s.response_hours != null || s.work_hours) && (
          <p className="mt-2 text-sm text-brand-cyan-base">
            תגובה עד {s.response_hours} שעות
            {s.work_hours ? ` · עד ${s.work_hours} שעות עבודה בחודש` : ""}
          </p>
        )}
        {s.features?.length ? (
          <ul className="mt-5 grid gap-2 border-t border-border/60 pt-5 sm:grid-cols-2">
            {s.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <svg className="mt-0.5 size-4 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* frozen terms */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-heading text-lg font-bold">התנאים שאושרו</h3>
        {s.blocks?.map((b) => (
          <div key={b.title} className="mt-4">
            <h4 className="text-sm font-bold text-foreground">{b.title}</h4>
            <ul className="mt-2 list-disc space-y-1 pr-5 text-sm text-muted-foreground">
              {b.items.map((it) => <li key={it}>{it}</li>)}
            </ul>
          </div>
        ))}
        {s.usage_approval && <p className="mt-4 text-sm text-muted-foreground">{s.usage_approval}</p>}
      </div>

      {/* signature */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-6">
        <div>
          <div className="text-xs text-muted-foreground">חתימה</div>
          <div className="mt-1 font-heading text-2xl font-black">{a.signature || a.full_name || "לא צוין"}</div>
        </div>
        <div className="text-xs text-muted-foreground">
          מסמך {a.terms_version} · Studio Ori Guy
        </div>
      </div>
    </Shell>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-foreground">{children}</span>
    </div>
  );
}

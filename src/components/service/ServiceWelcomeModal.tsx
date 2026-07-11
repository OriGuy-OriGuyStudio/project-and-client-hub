import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, DatabaseBackup, Activity, PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { gendered } from "@/lib/gender";
import { celebrateBig } from "@/lib/confetti";
import { useMyServiceWelcome, ackServiceWelcome } from "@/hooks/useService";

// One-time celebration when the client's maintenance package goes live. Shown on
// entry to Orion until dismissed (welcome_seen_at). Clients only — the query is
// disabled for admin/partner (whose RLS would otherwise return every client's row).
const BENEFITS: [typeof ShieldCheck, string][] = [
  [ShieldCheck, "מאובטח בשכבות הגנה"],
  [DatabaseBackup, "מגובה אוטומטית כל יום"],
  [Activity, "מנוטר מסביב לשעון, 24/7"],
];

export function ServiceWelcomeModal() {
  const { profile } = useAuth();
  const isClient = profile?.role === "client";
  const { data } = useMyServiceWelcome(isClient);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const firedRef = useRef(false);

  const show = !!data && !dismissed;

  useEffect(() => {
    if (show && !firedRef.current) {
      firedRef.current = true;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (!reduce) celebrateBig();
    }
  }, [show]);

  if (!show || !data) return null;
  const g = (m: string, f: string) => gendered(profile?.gender, m, f);

  async function done(goService: boolean) {
    setBusy(true);
    await ackServiceWelcome(data!.projectId);
    setDismissed(true);
    qc.invalidateQueries({ queryKey: ["my-service-welcome"] });
    if (goService) navigate("/service");
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="ברוכים הבאים לשירות"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-primary/30 bg-card p-7 text-center shadow-lift">
        <button
          aria-label="סגירה"
          onClick={() => done(false)}
          className="absolute end-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-5" />
        </button>
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/15 text-primary">
          <PartyPopper className="size-8" />
        </div>
        <h2 className="mt-4 font-heading text-2xl font-black text-foreground">
          {g("ברוך הבא לשירות!", "ברוכה הבאה לשירות!")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          החבילה שלך פעילה
          {data.projectTitle ? <> עבור <b className="text-foreground">{data.projectTitle}</b></> : null}. מהיום האתר שלך
          בידיים טובות.
        </p>
        <div className="mt-5 space-y-2.5 text-right">
          {BENEFITS.map(([Icon, t], i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-background/50 px-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="text-sm text-foreground">{t}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => done(true)} disabled={busy} className="w-full">
            קדימה, לדשבורד השירות
          </Button>
          <Button variant="ghost" onClick={() => done(false)} disabled={busy} className="w-full">
            תודה, אולי אחר כך
          </Button>
        </div>
      </div>
    </div>
  );
}

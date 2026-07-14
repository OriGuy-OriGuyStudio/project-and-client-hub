import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { usePublicQuote } from "@/hooks/useQuotes";
import { usePlanConfig } from "@/lib/plan-config";
import { celebrateBig } from "@/lib/confetti";
import { TIER_ORDER, type ServiceTier } from "@/lib/service-plans";
import {
  bonusesTotal,
  computeQuote,
  paymentSplit,
  shekel,
  withVat,
  SITE_TYPE_LABEL,
  type QuoteContent,
  type QuoteSiteType,
} from "@/lib/quote";
import { CountUp } from "@/components/ui/count-up";

const WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;
const STUDIO = "Studio Ori Guy";

/* Design by Ori Guy (Claude Design import "דף הצעת מחיר אינטראקטיבי"), ported to
 * React and wired to the live quote data. Self-contained palette + styles (dark,
 * green) scoped under .qp, so it is independent of the app's Tailwind tokens. */

const STYLES = `
.qp{--green:#b4d670;--green-d:#91be37;--green-l:#c5df90;--bg:#0a0a0e;--bg2:#0e0d16;--card:#141320;--card2:#1a1926;--ink:#f3f2ee;--muted:#9a98a6;--faint:#75737e;--line:rgba(243,242,238,.12);--line-s:rgba(243,242,238,.07);--ink-on-green:#0a0a0c;background:radial-gradient(120% 60% at 50% -10%,rgba(180,214,112,.06),transparent 60%),var(--bg);color:var(--ink);min-height:100vh;font-family:Diplomat,system-ui,sans-serif;line-height:1.62;position:relative;overflow-x:hidden}
.qp *{box-sizing:border-box}
.qp a{color:var(--green);text-decoration:none}
.qp a:hover{color:var(--green-l)}
.qp ::selection{background:rgba(180,214,112,.28)}
.qp .k{font-family:Kaha,system-ui,sans-serif;font-weight:900}
.qp .k3{font-family:Kaha,system-ui,sans-serif;font-weight:300}
.qp main{max-width:920px;margin:0 auto;padding:0 24px 90px}
.qp section{padding:34px 0}
.qp-eyb{display:flex;align-items:center;gap:12px;font-family:Kaha,sans-serif;font-weight:900;color:var(--green);font-size:13px;letter-spacing:.14em;margin:0 0 16px}
.qp-eyb .n{color:var(--faint);font-weight:300}
.qp-eyb .ln{width:34px;height:1px;background:rgba(180,214,112,.4)}
.qp-eyb.c{justify-content:center}
.qp-eyb.c .ln{width:28px}
.qp-h2{font-family:Kaha,sans-serif;font-weight:900;font-size:clamp(28px,4vw,40px);line-height:1.1;letter-spacing:-.01em;margin:0}
.qp-lift{transition:transform .3s cubic-bezier(.22,1,.36,1),border-color .3s}
.qp-lift:hover{transform:translateY(-2px);border-color:rgba(180,214,112,.35)}
.qp-tog{transition:all .28s cubic-bezier(.22,1,.36,1)}
.qp-tog:hover{border-color:rgba(180,214,112,.4)}
.qp-whyrow{transition:background .3s}
.qp-whyrow:hover{background:rgba(243,242,238,.02)}
.qp-input{width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:14px 16px;color:var(--ink);font-family:Diplomat,sans-serif;font-size:16px;outline:none;transition:border-color .2s}
.qp-input:focus{border-color:var(--green)}
.qp-approve{width:100%;margin-top:22px;background:var(--green);color:var(--ink-on-green);border:0;border-radius:14px;padding:19px;font-family:Kaha,sans-serif;font-weight:900;font-size:19px;cursor:pointer;transition:transform .2s,box-shadow .3s;box-shadow:0 14px 40px -12px rgba(180,214,112,.5)}
.qp-approve:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 20px 52px -12px rgba(180,214,112,.65)}
.qp-approve:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.4)}
.qp-pdf{display:inline-flex;align-items:center;gap:8px;background:none;border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:9px 18px;font-size:14px;cursor:pointer;font-family:Diplomat,sans-serif;transition:border-color .3s}
.qp-pdf:hover{border-color:var(--green)}
.qp-wa{position:fixed;bottom:22px;left:22px;z-index:45;width:56px;height:56px;border-radius:50%;background:var(--green);display:grid;place-items:center;box-shadow:0 12px 32px -8px rgba(180,214,112,.6);transition:transform .25s}
.qp-wa:hover{transform:scale(1.07)}
.qbar{display:none}
@keyframes q-spin{to{transform:rotate(360deg)}}
@keyframes q-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes q-pulse{0%,100%{box-shadow:0 0 0 0 rgba(180,214,112,.35)}50%{box-shadow:0 0 0 12px rgba(180,214,112,0)}}
.qp .rv{opacity:0;transform:translateY(22px);transition:opacity .85s cubic-bezier(.22,1,.36,1),transform .85s cubic-bezier(.22,1,.36,1)}
.qp .rv-in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.qp .rv{opacity:1;transform:none;transition:none}}
.qp-hero{padding:70px 0 44px}
@keyframes q-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.qp-hero>*{animation:q-rise .85s cubic-bezier(.22,1,.36,1) both}
.qp-hero>*:nth-child(2){animation-delay:.09s}
.qp-hero>*:nth-child(3){animation-delay:.18s}
.qp-hero>*:nth-child(4){animation-delay:.27s}
.qp .rv .qp-stag>*{opacity:0;transform:translateY(16px);transition:opacity .6s cubic-bezier(.22,1,.36,1),transform .6s cubic-bezier(.22,1,.36,1)}
.qp .rv-in .qp-stag>*{opacity:1;transform:none}
.qp .rv-in .qp-stag>*:nth-child(2){transition-delay:.07s}
.qp .rv-in .qp-stag>*:nth-child(3){transition-delay:.14s}
.qp .rv-in .qp-stag>*:nth-child(4){transition-delay:.21s}
.qp .rv-in .qp-stag>*:nth-child(5){transition-delay:.28s}
.qp .rv-in .qp-stag>*:nth-child(6){transition-delay:.35s}
.qp-lift:hover{transform:translateY(-3px) scale(1.012)}
.qp-acc-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .32s cubic-bezier(.22,1,.36,1)}
.qp-acc-body.open{grid-template-rows:1fr}
.qp-acc-body>.in{overflow:hidden;min-height:0}
@media(prefers-reduced-motion:reduce){.qp-hero>*{animation:none}.qp .rv .qp-stag>*{opacity:1;transform:none;transition:none}.qp-acc-body{transition:none}}
@media(max-width:640px){
  .qbar{display:flex}.qbar-pad{height:80px}.qp-wa{bottom:88px;width:52px;height:52px}
  .qp main{padding:0 16px 88px}
  .qp section{padding:26px 0}
  .qp-hero{padding:44px 0 30px}
  .qp-sticky>div{padding:12px 16px}
}
@media print{.qp-wa,.qbar,.qp-sticky{display:none!important}.qp *{box-shadow:none!important}}
`;

const money = shekel;

export default function QuotePage() {
  const { token } = useParams<{ token: string }>();
  const { data: quote, isLoading } = usePublicQuote(token);
  const { config } = usePlanConfig();

  const [upsellIds, setUpsellIds] = useState<string[]>([]);
  const [maintTier, setMaintTier] = useState<ServiceTier | null>(null);
  const [name, setName] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [faqOpen, setFaqOpen] = useState<Record<number, boolean>>({});
  const [legalOpen, setLegalOpen] = useState(false);

  const sigRef = useRef<HTMLCanvasElement | null>(null);
  const signSecRef = useRef<HTMLElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const canvasReady = useRef(false);

  const content = quote?.content as unknown as QuoteContent | undefined;

  const totals = useMemo(
    () =>
      content
        ? computeQuote(content, { upsell_ids: upsellIds, maintenance_tier: maintTier }, (t) => config[t].price)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, upsellIds, maintTier, config]
  );

  // Signature canvas setup (hi-dpi) + reveal-on-scroll, once the proposal renders.
  const isProposal = !!quote && !!content && quote.status !== "signed" && !signed;

  useEffect(() => {
    if (!isProposal) return;
    setupCanvas();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && "IntersectionObserver" in window) {
      const id = window.setTimeout(() => {
        const secs = document.querySelectorAll(".qp main section");
        const io = new IntersectionObserver(
          (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("rv-in"); io.unobserve(e.target); } }),
          { threshold: 0.06 }
        );
        secs.forEach((s, i) => {
          if (i === 0) return;
          if (s.getBoundingClientRect().top < window.innerHeight) return;
          s.classList.add("rv");
          io.observe(s);
        });
      }, 80);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProposal]);

  function setupCanvas() {
    const c = sigRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#f3f2ee";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    canvasReady.current = true;
  }
  function posOf(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = sigRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = sigRef.current;
    if (!c) return;
    if (!canvasReady.current) setupCanvas();
    c.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = posOf(e);
  }
  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = sigRef.current!.getContext("2d")!;
    const pt = posOf(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    last.current = pt;
    if (!hasDrawn) setHasDrawn(true);
  }
  function onUp() {
    drawing.current = false;
  }
  function clearSig() {
    const c = sigRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  }

  async function approve() {
    if (!name.trim()) return toastError("נא למלא שם מלא.");
    if (!hasDrawn) return toastError("נא לחתום בתיבת החתימה.");
    const dataUrl = sigRef.current ? sigRef.current.toDataURL("image/png") : "";
    setSubmitting(true);
    const { data, error } = await supabase.rpc("sign_quote", {
      p_token: token!,
      p_name: name.trim(),
      p_signature_image: dataUrl,
      p_upsell_ids: upsellIds as unknown as never,
      p_maintenance_tier: maintTier,
    });
    setSubmitting(false);
    const res = data as { ok: boolean; error?: string } | null;
    if (error || !res?.ok) return toastError(res?.error || "האישור נכשל, נסו שוב.");
    setSigned(true);
    celebrateBig();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToSign() {
    const el = signSecRef.current;
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
  }

  /* ---------- loading / not found ---------- */
  if (isLoading) {
    return (
      <Root>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", border: "3px solid rgba(180,214,112,.18)", borderTopColor: "var(--green)", margin: "0 auto 22px", animation: "q-spin .9s linear infinite" }} />
            <div className="k" style={{ fontSize: 24 }}>טוען את ההצעה שלך</div>
            <div style={{ color: "var(--muted)", marginTop: 8 }}>רגע אחד, מסדר הכול יפה</div>
          </div>
        </div>
      </Root>
    );
  }
  if (!quote || !content) {
    return (
      <Root>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 460 }}>
            <div className="k" style={{ width: 64, height: 64, borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto 22px", border: "1px solid var(--line)", background: "var(--card)", color: "var(--faint)", fontSize: 30 }}>?</div>
            <div className="k" style={{ fontSize: 30 }}>ההצעה לא נמצאה</div>
            <p style={{ color: "var(--muted)", margin: "14px 0 26px" }}>יכול להיות שהקישור פג או שגוי. אפשר לפנות אליי ואשלח קישור מעודכן.</p>
          </div>
        </div>
      </Root>
    );
  }

  /* ---------- derived data ---------- */
  const vatPct = content.vat_pct ?? 18;
  const bonusesSum = bonusesTotal(content);
  const total = withVat(totals!.netTotal, vatPct);
  const vat = total - totals!.netTotal;
  const anchor = totals!.oneTimeBase + bonusesSum;
  const split = paymentSplit(total, content);
  const clientFirst = (quote.client_name || "").trim().split(/\s+/)[0] || "";
  const dateStr = formatDate(quote.created_at);

  const why = content.differentiators ?? [];
  const includes = [
    ...(content.pages ?? []).map((p) => p.name),
    ...(content.features ?? []).map((f) => f.name),
  ].filter(Boolean);
  const phases = content.phases ?? [];
  const upgrades = content.upsells ?? [];
  const maintTiers = (content.maintenance?.offer ? content.maintenance.tiers : []).filter((t) => TIER_ORDER.includes(t));
  const bonuses = content.bonuses ?? [];
  const steps = content.next_steps ?? [];
  const faq = content.faq ?? [];
  const legal = content.legal ?? [];
  const testimonial = content.testimonial && content.testimonial.quote?.trim() ? content.testimonial : null;
  const selectedUpgrades = upgrades.filter((u) => upsellIds.includes(u.id));

  // sequential section numbers, only for the sections that render
  const numbered: string[] = [];
  if (why.length) numbered.push("why");
  if (includes.length) numbered.push("inc");
  if (phases.length) numbered.push("phases");
  if (upgrades.length) numbered.push("up");
  if (maintTiers.length) numbered.push("maint");
  if (bonuses.length) numbered.push("bonus");
  if (steps.length) numbered.push("after");
  if (faq.length) numbered.push("faq");
  if (legal.length) numbered.push("legal");
  const numOf = (k: string) => String(numbered.indexOf(k) + 1).padStart(2, "0");
  const maintObj = maintTier ? config[maintTier] : null;

  /* ---------- thank-you ---------- */
  if (quote.status === "signed" || signed) {
    return (
      <Root>
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "40px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 560, width: "100%" }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto 28px", background: "radial-gradient(circle at 50% 40%,rgba(180,214,112,.25),transparent 70%)", animation: "q-pop .5s cubic-bezier(.22,1,.36,1) both" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--green)", animation: "q-pulse 2.2s ease-out infinite" }}>
                <Check size={38} stroke="#0a0a0c" w={3} />
              </div>
            </div>
            <div className="k" style={{ color: "var(--green)", fontSize: 15, marginBottom: 10 }}>ההצעה אושרה בהצלחה</div>
            <h1 className="k" style={{ fontSize: "clamp(30px,5vw,46px)", lineHeight: 1.08, margin: 0 }}>
              תודה{clientFirst ? ` ${clientFirst}` : ""},<br />יוצאים לדרך.
            </h1>
            <p style={{ color: "var(--muted)", maxWidth: 440, margin: "18px auto 0" }}>
              קיבלתי את האישור והחתימה שלך. אני חוזר אליך בקרוב עם פרטי המקדמה, ומשם מתחילים. שמח לעבוד יחד.
            </p>
            <div style={{ marginTop: 32, background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 20, padding: 26, textAlign: "right", maxWidth: 440, marginInline: "auto" }}>
              <div className="k" style={{ fontSize: 17, marginBottom: 16 }}>סיכום ההזמנה</div>
              <SumRow label="סה״כ חד פעמי כולל מע״מ" value={money(total)} green bold border />
              <SumRow label={`מקדמה עכשיו (${split.depositPct}%)`} value={money(split.deposit)} border />
              <SumRow label="יתרה לפני השקה" value={money(split.rest)} />
              {maintObj && <SumRow label={`תחזוקה ${maintObj.name} (חודשי)`} value={money(maintObj.price)} green topBorder />}
            </div>
          </div>
        </div>
      </Root>
    );
  }

  /* ---------- proposal ---------- */
  return (
    <Root>
      {/* sticky letterhead */}
      <header className="qp-sticky" style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(14px)", background: "rgba(10,10,14,.72)", borderBottom: "1px solid var(--line-s)" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <img src="/brand/logo-mark.svg" alt="" style={{ width: 30, height: 30, display: "block" }} />
            <span className="k" style={{ fontSize: 17, letterSpacing: "-.01em" }}>{STUDIO}</span>
          </div>
          <div className="k" style={{ color: "var(--muted)", fontSize: 13, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ color: "var(--ink)" }}>הצעת מחיר</span>
            {content.version && <><span style={{ color: "var(--faint)" }}>·</span><span>{content.version}</span></>}
            {dateStr && <><span style={{ color: "var(--faint)" }}>·</span><span>{dateStr}</span></>}
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="qp-hero">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            {(quote.org_name || quote.client_name) && (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 10, border: "1px solid var(--line)", background: "var(--card)", padding: "9px 18px", borderRadius: 12, position: "relative" }}>
                <span style={{ position: "absolute", top: -1, right: -1, width: 14, height: 14, borderTop: "2px solid var(--green)", borderRight: "2px solid var(--green)", borderRadius: "0 12px 0 0" }} />
                <span style={{ position: "absolute", bottom: -1, left: -1, width: 14, height: 14, borderBottom: "2px solid var(--green)", borderLeft: "2px solid var(--green)", borderRadius: "0 0 0 12px" }} />
                <span style={{ color: "var(--faint)", fontSize: 12, letterSpacing: ".12em" }}>הוכן במיוחד עבור</span>
                <span className="k" style={{ fontSize: 16 }}>{quote.org_name || quote.client_name}</span>
              </span>
            )}
            {content.validity_days ? (
              <span className="k" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(180,214,112,.3)", background: "rgba(180,214,112,.07)", color: "var(--green)", fontSize: 13, padding: "6px 14px", borderRadius: 999 }}>
                <b style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "q-pulse 2.4s ease-out infinite" }} />
                ההצעה בתוקף {content.validity_days} ימים
              </span>
            ) : null}
          </div>
          <h1 className="k" style={{ fontSize: "clamp(38px,7vw,68px)", lineHeight: 1.02, letterSpacing: "-.02em", margin: "26px 0 0" }}>
            {quote.title}<span style={{ color: "var(--green)" }}>.</span>
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "20px 30px", marginTop: 40, borderTop: "1px solid var(--line-s)", paddingTop: 24 }}>
            <MetaCell label="איש הקשר" value={quote.client_name || "לקוח"} />
            <MetaCell label="סוג הפרויקט" value={SITE_TYPE_LABEL[quote.site_type as QuoteSiteType]} />
            <MetaCell label="תאריך וגרסה" value={dateStr || "היום"} sub={content.version} />
          </div>
          {content.intro?.trim() && (
            <p style={{ fontSize: "clamp(17px,2.4vw,21px)", lineHeight: 1.7, color: "#d9d8d2", margin: "34px 0 0", maxWidth: 640, whiteSpace: "pre-wrap" }}>{content.intro}</p>
          )}
        </section>

        {/* WHY */}
        {why.length > 0 && (
          <section>
            <SecHead num={numOf("why")} eyebrow="למה לעבוד איתי" title="לא רק אתר. שותף." />
            <div className="qp-stag" style={{ borderTop: "1px solid var(--line-s)" }}>
              {why.map((w, i) => (
                <div key={w.id} className="qp-whyrow" style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 20, padding: "28px 6px", borderBottom: "1px solid var(--line-s)", alignItems: "baseline" }}>
                  <span className="k3" style={{ fontSize: 32, color: "var(--green)" }}>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="k" style={{ fontSize: 21, margin: "0 0 8px" }}>{w.title}</h3>
                    {w.desc && <p style={{ color: "var(--muted)", fontSize: 15, margin: 0, maxWidth: 580 }}>{w.desc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* INCLUDES */}
        {includes.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
              <SecHead num={numOf("inc")} eyebrow="מה נכלל" title="העמודים והפיצ׳רים." noMargin />
              <div style={{ textAlign: "left" }}>
                <div className="k" style={{ fontSize: 34, lineHeight: 1, color: "var(--green)" }}>{includes.length}</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>עמודים ופיצ׳רים</div>
              </div>
            </div>
            <div className="qp-stag" style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
              {includes.map((nm, i) => (
                <div key={i} className="qp-lift" style={{ display: "flex", alignItems: "center", gap: 14, background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 14, padding: "15px 18px" }}>
                  <span className="k" style={{ fontSize: 15, color: "var(--green)", opacity: 0.75, minWidth: 24 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ width: 1, alignSelf: "stretch", background: "var(--line)", flex: "none" }} />
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{nm}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PHASES */}
        {phases.length > 0 && (
          <section>
            <SecHead num={numOf("phases")} eyebrow="איך זה עובד" title="השלבים והלוח." mb={30} />
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", top: 6, bottom: 6, right: 19, width: 2, background: "linear-gradient(var(--green),rgba(180,214,112,.08))" }} />
              <div className="qp-stag" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                {phases.map((ph, i) => (
                  <div key={ph.id} style={{ display: "flex", gap: 20, alignItems: "flex-start", position: "relative" }}>
                    <div className="k" style={{ flex: "none", width: 40, height: 40, borderRadius: "50%", background: "var(--bg)", border: "2px solid var(--green)", color: "var(--green)", display: "grid", placeItems: "center", fontSize: 16, zIndex: 1 }}>{i + 1}</div>
                    <div style={{ background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 16, padding: "20px 22px", flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 7 }}>
                        <h3 className="k" style={{ fontSize: 19, margin: 0 }}>{ph.name}</h3>
                        {ph.duration?.trim() && <span className="k" style={{ color: "var(--green)", fontSize: 13, background: "rgba(180,214,112,.08)", border: "1px solid rgba(180,214,112,.2)", padding: "4px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>{ph.duration}</span>}
                      </div>
                      {ph.desc && <p style={{ color: "var(--muted)", fontSize: 15, margin: 0 }}>{ph.desc}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* UPGRADES */}
        {upgrades.length > 0 && (
          <section>
            <SecHead num={numOf("up")} eyebrow="רשות, לא חובה" title="שדרוגים לבחירתך." desc="כל שדרוג שתבחר מתעדכן מיד בסיכום המחיר למטה. אפשר לבחור כמה שרוצים, או להשאיר בדיוק כמו שזה." />
            <div className="qp-stag" style={{ display: "grid", gap: 14 }}>
              {upgrades.map((u) => {
                const sel = upsellIds.includes(u.id);
                return (
                  <button key={u.id} type="button" className="qp-tog" onClick={() => setUpsellIds((ids) => (sel ? ids.filter((x) => x !== u.id) : [...ids, u.id]))}
                    style={{ display: "flex", gap: 16, width: "100%", textAlign: "right", cursor: "pointer", background: sel ? "rgba(180,214,112,.07)" : "var(--card)", border: `1px solid ${sel ? "rgba(180,214,112,.45)" : "var(--line-s)"}`, borderRadius: 16, padding: "20px 22px" }}>
                    <div style={{ flex: "none", width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", marginTop: 2, border: `2px solid ${sel ? "var(--green)" : "var(--line)"}`, background: sel ? "var(--green)" : "transparent" }}>
                      <Check size={15} stroke="#0a0a0c" w={3.2} style={{ opacity: sel ? 1 : 0 }} />
                    </div>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <h3 className="k" style={{ fontSize: 18, margin: 0, display: "inline" }}>{u.title}</h3>
                        <span className="k" style={{ color: "var(--green)", whiteSpace: "nowrap" }}>+ {money(u.price)}</span>
                      </div>
                      {u.desc && <p style={{ color: "var(--muted)", fontSize: 14.5, margin: "6px 0 0" }}>{u.desc}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* MAINTENANCE */}
        {maintTiers.length > 0 && (
          <section>
            <SecHead num={numOf("maint")} eyebrow="אחרי ההשקה" title="תחזוקה שוטפת." desc="בחירה של חבילה אחת, או בכלל לא. זו הוצאה חודשית נפרדת מהפרויקט, וכל המחירים כאן כבר כוללים מע״מ." />
            <div className="qp-stag" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))" }}>
              {maintTiers.map((t) => {
                const cfg = config[t];
                const sel = maintTier === t;
                const feats = (cfg.features?.custom ?? cfg.features?.wordpress ?? []).slice(0, 4);
                return (
                  <button key={t} type="button" className="qp-tog" onClick={() => setMaintTier(sel ? null : t)}
                    style={{ display: "block", width: "100%", textAlign: "right", cursor: "pointer", background: sel ? "rgba(180,214,112,.07)" : "var(--card)", border: `1px solid ${sel ? "rgba(180,214,112,.45)" : "var(--line-s)"}`, borderRadius: 18, padding: 22 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                      <h3 className="k" style={{ fontSize: 18, margin: 0 }}>{cfg.name}</h3>
                      <div style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sel ? "var(--green)" : "var(--line)"}`, display: "grid", placeItems: "center" }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--green)", transform: `scale(${sel ? 1 : 0})`, transition: "transform .2s" }} />
                      </div>
                    </div>
                    <div className="k" style={{ fontSize: 26, color: "var(--green)" }}>{money(cfg.price)}<span style={{ fontFamily: "Diplomat,sans-serif", fontWeight: 400, fontSize: 14, color: "var(--muted)" }}> / חודש</span></div>
                    {cfg.tagline && <p style={{ color: "var(--muted)", fontSize: 14, margin: "8px 0 14px" }}>{cfg.tagline}</p>}
                    {feats.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line-s)", paddingTop: 14 }}>
                        {feats.map((f, i) => (
                          <span key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "#cfcec8", textAlign: "right" }}>
                            <Check size={14} stroke="#b4d670" w={2.8} style={{ flex: "none", marginTop: 3 }} />{f}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* BONUSES */}
        {bonuses.length > 0 && (
          <section>
            <SecHead num={numOf("bonus")} eyebrow="על חשבוני" title="בונוסים במתנה." />
            <div className="qp-stag" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
              {bonuses.map((b) => (
                <div key={b.id} style={{ background: "linear-gradient(150deg,rgba(180,214,112,.09),var(--card) 55%)", border: "1px solid rgba(180,214,112,.22)", borderRadius: 16, padding: 22, position: "relative" }}>
                  {b.value > 0 && <span className="k" style={{ position: "absolute", top: 16, left: 16, fontSize: 12, color: "var(--green)", background: "rgba(180,214,112,.12)", border: "1px solid rgba(180,214,112,.28)", padding: "4px 10px", borderRadius: 999 }}>שווי {money(b.value)}</span>}
                  <h3 className="k" style={{ fontSize: 18, margin: "0 0 9px 96px" }}>{b.name}</h3>
                  {b.desc && <p style={{ color: "var(--muted)", fontSize: 14.5, margin: 0 }}>{b.desc}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PRICE */}
        <section style={{ padding: "44px 0 34px", scrollMarginTop: 80 }}>
          <div style={{ background: "radial-gradient(130% 90% at 50% 0%,rgba(180,214,112,.09),transparent 62%),var(--card)", border: "1px solid rgba(180,214,112,.2)", borderRadius: 26, padding: "clamp(26px,5vw,48px)", boxShadow: "0 30px 80px -34px rgba(180,214,112,.28)" }}>
            <p className="qp-eyb c" style={{ justifyContent: "center", marginBottom: 8 }}><span className="ln" />רגע האמת<span className="ln" /></p>
            <h2 className="k" style={{ fontSize: "clamp(26px,4vw,36px)", textAlign: "center", margin: "0 0 30px" }}>ההשקעה בפרויקט.</h2>
            <div style={{ maxWidth: 520, margin: "0 auto", fontVariantNumeric: "tabular-nums" }}>
              {bonusesSum > 0 && (
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "12px 0" }}>
                  <span style={{ color: "var(--muted)", fontSize: 15 }}>שווי כולל של הפרויקט והבונוסים</span>
                  <span className="k" style={{ fontSize: 22, color: "var(--faint)", textDecoration: "line-through", textDecorationColor: "rgba(180,214,112,.55)", whiteSpace: "nowrap" }}>{money(anchor)}</span>
                </div>
              )}
              {bonusesSum > 0 && (
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--line-s)" }}>
                  <span style={{ color: "var(--green)", fontSize: 15 }}>הבונוסים, במתנה</span>
                  <span className="k" style={{ fontSize: 18, color: "var(--green)", whiteSpace: "nowrap" }}>− {money(bonusesSum)}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "13px 0" }}>
                <span style={{ fontSize: 15 }}>מחיר הפרויקט <span style={{ color: "var(--faint)", fontSize: 13 }}>(לא כולל מע״מ)</span></span>
                <span className="k" style={{ fontSize: 18, whiteSpace: "nowrap" }}>{money(totals!.oneTimeBase)}</span>
              </div>
              {selectedUpgrades.length > 0 && (
                <div style={{ padding: "13px 0" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
                    <span style={{ fontSize: 15 }}>שדרוגים שנבחרו <span style={{ color: "var(--faint)", fontSize: 13 }}>({selectedUpgrades.length})</span></span>
                    <span className="k" style={{ fontSize: 18, whiteSpace: "nowrap" }}>+ {money(totals!.upsellsTotal)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 11 }}>
                    {selectedUpgrades.map((su) => (
                      <div key={su.id} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, color: "var(--muted)", fontSize: 13.5 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", flex: "none" }} />{su.title}</span>
                        <span className="k" style={{ whiteSpace: "nowrap" }}>{money(su.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {totals!.discountAmount > 0 && (
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "13px 0" }}>
                  <span style={{ color: "var(--green)", fontSize: 15 }}>{content.discount?.label?.trim() || "הנחה"}</span>
                  <span className="k" style={{ fontSize: 18, color: "var(--green)", whiteSpace: "nowrap" }}>− {money(totals!.discountAmount)}</span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "13px 0", borderBottom: "1px solid var(--line-s)" }}>
                <span style={{ color: "var(--muted)", fontSize: 15 }}>מע״מ ({vatPct}%)</span>
                <span className="k" style={{ fontSize: 18, color: "var(--muted)", whiteSpace: "nowrap" }}>{money(vat)}</span>
              </div>
              <div style={{ textAlign: "center", marginTop: 30 }}>
                <div style={{ color: "var(--muted)", fontSize: 15, marginBottom: 6 }}>סה״כ חד פעמי כולל מע״מ</div>
                <CountUp to={total} format={money} className="k" style={{ fontSize: "clamp(52px,12vw,84px)", lineHeight: 1, color: "var(--green)", letterSpacing: "-.02em", display: "block" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 28 }}>
                <SplitCard label={`מקדמה עכשיו (${split.depositPct}%)`} value={money(split.deposit)} />
                <SplitCard label="יתרה לפני השקה" value={money(split.rest)} />
              </div>
              {maintObj && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, background: "rgba(180,214,112,.06)", border: "1px solid rgba(180,214,112,.2)", borderRadius: 14, padding: "15px 18px" }}>
                  <span style={{ fontSize: 14.5 }}>תחזוקה {maintObj.name} <span style={{ color: "var(--faint)", fontSize: 13 }}>(חודשי, כולל מע״מ)</span></span>
                  <span className="k" style={{ color: "var(--green)", whiteSpace: "nowrap" }}>{money(maintObj.price)} / חודש</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* AFTER */}
        {steps.length > 0 && (
          <section>
            <SecHead num={numOf("after")} eyebrow="מה קורה אחרי שתאשר" title="הצעדים הבאים." mb={22} />
            <div className="qp-stag" style={{ display: "grid", gap: 12 }}>
              {steps.map((s, i) => (
                <div key={s.id} style={{ display: "flex", gap: 15, alignItems: "center", background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 14, padding: "16px 18px" }}>
                  <span className="k" style={{ flex: "none", width: 30, height: 30, borderRadius: 9, background: "rgba(180,214,112,.1)", color: "var(--green)", display: "grid", placeItems: "center", fontSize: 15 }}>{i + 1}</span>
                  <span style={{ fontSize: 15 }}>{s.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <section>
            <SecHead num={numOf("faq")} eyebrow="שאלות נפוצות" title="כדאי לדעת." mb={22} />
            <div className="qp-stag" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {faq.map((f, i) => {
                const open = !!faqOpen[i];
                return (
                  <div key={f.id} style={{ background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 14, overflow: "hidden" }}>
                    <button type="button" onClick={() => setFaqOpen((s) => ({ ...s, [i]: !s[i] }))} className="k" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "18px 20px", background: "none", border: 0, color: "var(--ink)", fontSize: 17, textAlign: "right", cursor: "pointer" }}>
                      {f.q}
                      <span style={{ flex: "none", fontSize: 24, lineHeight: 1, color: "var(--green)", transform: `rotate(${open ? 45 : 0}deg)`, transition: "transform .25s" }}>+</span>
                    </button>
                    <div className={`qp-acc-body${open ? " open" : ""}`}>
                      <div className="in"><div style={{ padding: "0 20px 20px", color: "var(--muted)", fontSize: 15 }}>{f.a}</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* LEGAL */}
        {legal.length > 0 && (
          <section>
            <SecHead num={numOf("legal")} eyebrow="האותיות הקטנות" title="סעיפים משפטיים." mb={22} />
            <div style={{ background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 14, overflow: "hidden" }}>
              <button type="button" onClick={() => setLegalOpen((o) => !o)} className="k" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 20px", background: "none", border: 0, color: "var(--ink)", fontSize: 15.5, textAlign: "right", cursor: "pointer" }}>
                לצפייה בכל הסעיפים
                <span style={{ flex: "none", fontSize: 22, lineHeight: 1, color: "var(--green)", transform: `rotate(${legalOpen ? 45 : 0}deg)`, transition: "transform .25s" }}>+</span>
              </button>
              <div className={`qp-acc-body${legalOpen ? " open" : ""}`}>
                <ul className="in" style={{ margin: 0, padding: "0 20px 18px", color: "var(--muted)", fontSize: 14, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                  {legal.map((l, i) => (
                    <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><span style={{ color: "var(--green)", flex: "none" }}>•</span>{l}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* TESTIMONIAL */}
        {testimonial && (
          <section style={{ padding: "34px 0 0" }}>
            <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 16 }}>
                {[0, 1, 2, 3, 4].map((i) => <Star key={i} />)}
              </div>
              <blockquote className="k3" style={{ fontSize: "clamp(20px,3vw,26px)", lineHeight: 1.5, margin: 0, color: "var(--ink)" }}>״{testimonial.quote}״</blockquote>
              <div style={{ marginTop: 16, color: "var(--muted)", fontSize: 14 }}>
                <b className="k" style={{ color: "var(--ink)" }}>{testimonial.name}</b>{testimonial.role ? ` · ${testimonial.role}` : ""}
              </div>
            </div>
          </section>
        )}

        {/* SIGN */}
        <section ref={signSecRef} style={{ padding: "44px 0 20px", scrollMarginTop: 80 }}>
          <div style={{ background: "var(--card)", border: "1px solid rgba(180,214,112,.22)", borderRadius: 24, padding: "clamp(24px,5vw,44px)" }}>
            <div style={{ textAlign: "center", marginBottom: 26 }}>
              <p className="qp-eyb c" style={{ justifyContent: "center", marginBottom: 10 }}><span className="ln" />אישור וחתימה<span className="ln" /></p>
              <h2 className="k" style={{ fontSize: "clamp(26px,4vw,38px)", margin: 0 }}>מוכן להתחיל?</h2>
              <p style={{ color: "var(--muted)", margin: "12px 0 0" }}>חתימה כאן היא אישור ההצעה. אין חיוב בשלב הזה, אני חוזר אליך עם פרטי המקדמה.</p>
            </div>
            <div style={{ maxWidth: 520, margin: "0 auto" }}>
              <label style={{ display: "block", fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>השם המלא שלך</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" className="qp-input" />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 8px" }}>
                <label style={{ fontSize: 14, color: "var(--muted)" }}>חתימה בציור</label>
                <button type="button" onClick={clearSig} className="k" style={{ background: "none", border: 0, color: "var(--green)", fontSize: 13, cursor: "pointer" }}>ניקוי</button>
              </div>
              <canvas ref={sigRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
                style={{ width: "100%", height: 150, display: "block", background: "var(--bg2)", border: "1px dashed var(--line)", borderRadius: 12, touchAction: "none", cursor: "crosshair" }} />
              <button type="button" className="qp-approve" onClick={approve} disabled={submitting || !name.trim() || !hasDrawn}>
                {submitting ? "רגע…" : `אני מאשר · ${money(total)}`}
              </button>
              <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, margin: "14px 0 0" }}>בלחיצה אני מאשר את תנאי ההצעה והסעיפים המשפטיים שלמעלה.</p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px 24px", marginTop: 18 }}>
                <Trust text="בלי חיוב עכשיו" />
                <Trust text="30 יום אחריות" />
                <Trust text="פרטי ומאובטח" />
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid var(--line-s)", marginTop: 40, padding: "30px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/brand/logo-mark.svg" alt="" style={{ width: 24, height: 24 }} />
            <span className="k" style={{ fontSize: 15 }}>{STUDIO}</span>
          </div>
          <button type="button" onClick={() => window.print()} className="qp-pdf">
            <PrintIcon />שמירה כ-PDF
          </button>
          <div style={{ color: "var(--faint)", fontSize: 13 }}>נבנה באהבה על ידי {STUDIO}</div>
        </footer>
      </main>

      {/* mobile sticky bar */}
      <div className="qbar" style={{ position: "fixed", insetInline: 0, bottom: 0, zIndex: 44, alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", background: "rgba(10,10,14,.9)", backdropFilter: "blur(14px)", borderTop: "1px solid var(--line-s)" }}>
        <div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>סה״כ כולל מע״מ</div>
          <div className="k" style={{ fontSize: 19, color: "var(--green)" }}>{money(total)}</div>
        </div>
        <button type="button" onClick={scrollToSign} className="k" style={{ background: "var(--green)", color: "var(--ink-on-green)", border: 0, borderRadius: 999, padding: "12px 22px", fontSize: 15, cursor: "pointer" }}>לאישור וחתימה</button>
      </div>
      <div className="qbar-pad" />

      {WHATSAPP && (
        <a className="qp-wa" href={`https://wa.me/${String(WHATSAPP).replace(/\D/g, "")}?text=${encodeURIComponent(`היי אורי, יש לי שאלה על ההצעה "${quote.title}"`)}`} target="_blank" rel="noreferrer" aria-label="וואטסאפ">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#0a0a0c"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1112 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 00-.7.3c-.3.3-.9.9-.9 2.1s.9 2.5 1 2.6 1.8 2.9 4.5 4c1.7.7 2.3.8 3.1.7.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1z"/></svg>
        </a>
      )}
    </Root>
  );
}

/* ---------- small presentational helpers ---------- */

function Root({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{STYLES}</style>
      <div className="qp" dir="rtl">{children}</div>
    </>
  );
}

function SecHead({ num, eyebrow, title, desc, mb, noMargin }: { num: string; eyebrow: string; title: string; desc?: string; mb?: number; noMargin?: boolean }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : mb ?? 24 }}>
      <p className="qp-eyb"><span className="n">{num}</span>{eyebrow}</p>
      <h2 className="qp-h2">{title}</h2>
      {desc && <p style={{ color: "var(--muted)", margin: "12px 0 0", maxWidth: 560 }}>{desc}</p>}
    </div>
  );
}

function MetaCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ color: "var(--faint)", fontSize: 12, letterSpacing: ".12em", marginBottom: 7 }}>{label}</div>
      <div className="k" style={{ fontSize: 17 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SplitCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--line-s)", borderRadius: 14, padding: 16, textAlign: "center" }}>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 5 }}>{label}</div>
      <div className="k" style={{ fontSize: 22 }}>{value}</div>
    </div>
  );
}

function SumRow({ label, value, green, bold, border, topBorder }: { label: string; value: string; green?: boolean; bold?: boolean; border?: boolean; topBorder?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: border ? "1px solid var(--line-s)" : undefined, borderTop: topBorder ? "1px solid var(--line-s)" : undefined, marginTop: topBorder ? 2 : undefined }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <b className={bold ? "k" : "k"} style={{ color: green ? "var(--green)" : "var(--ink)", fontSize: bold ? 19 : undefined }}>{value}</b>
    </div>
  );
}

function Trust({ text }: { text: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13 }}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#b4d670" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
      {text}
    </span>
  );
}

function Check({ size, stroke, w, style }: { size: number; stroke: string; w: number; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={style}><path d="M5 12.5l4.5 4.5L19 7" /></svg>
  );
}

function Star() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="#b4d670"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" /></svg>;
}

function PrintIcon() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

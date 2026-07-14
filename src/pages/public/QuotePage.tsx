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
const money = shekel;

/* Direction "ג" (Ori's pick): dark, focused, tabbed layout, minimal scroll. One
 * panel at a time, sticky letterhead + tab bar, fixed bottom price+CTA bar.
 * Self-contained palette (dark + green) under .qp. */

const STYLES = `
.qp{--green:#b4d670;--green-l:#c5df90;--bg:#0a0a0e;--bg2:#0e0d16;--card:#141320;--card2:#1a1926;--ink:#f3f2ee;--muted:#9a98a6;--faint:#75737e;--line:rgba(243,242,238,.12);--line-s:rgba(243,242,238,.07);--ink-on-green:#0a0a0c;background:radial-gradient(120% 55% at 50% -10%,rgba(180,214,112,.06),transparent 60%),var(--bg);color:var(--ink);min-height:100dvh;font-family:Diplomat,system-ui,sans-serif;line-height:1.62;position:relative;overflow-x:hidden}
.qp *{box-sizing:border-box}
.qp a{color:var(--green);text-decoration:none}
.qp ::selection{background:rgba(180,214,112,.28)}
.qp .k{font-family:Kaha,system-ui,sans-serif;font-weight:900}
.qp .k3{font-family:Kaha,system-ui,sans-serif;font-weight:300}
.qp main{max-width:900px;margin:0 auto;padding:26px 22px 120px}
.qp-h2{font-family:Kaha,sans-serif;font-weight:900;font-size:clamp(24px,3.4vw,34px);line-height:1.1;letter-spacing:-.01em;margin:0}
.qp-head{position:sticky;top:0;z-index:40;backdrop-filter:blur(14px);background:rgba(10,10,14,.8);border-bottom:1px solid var(--line-s)}
.qp-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.qp-tabs::-webkit-scrollbar{display:none}
.qp-tab{flex:none;white-space:nowrap;font-family:Kaha,sans-serif;font-weight:900;font-size:14px;color:var(--muted);background:none;border:0;padding:11px 16px;border-radius:999px;cursor:pointer;transition:color .2s,background .2s}
.qp-tab:hover{color:var(--ink)}
.qp-tab.on{color:var(--ink-on-green);background:var(--green)}
.qp-lift{transition:transform .3s cubic-bezier(.22,1,.36,1),border-color .3s}
.qp-lift:hover{transform:translateY(-2px);border-color:rgba(180,214,112,.35)}
.qp-tog{transition:all .28s cubic-bezier(.22,1,.36,1)}
.qp-tog:hover{border-color:rgba(180,214,112,.4)}
.qp-input{width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:14px 16px;color:var(--ink);font-family:Diplomat,sans-serif;font-size:16px;outline:none;transition:border-color .2s}
.qp-input:focus{border-color:var(--green)}
.qp-approve{width:100%;margin-top:20px;background:var(--green);color:var(--ink-on-green);border:0;border-radius:14px;padding:18px;font-family:Kaha,sans-serif;font-weight:900;font-size:18px;cursor:pointer;transition:transform .2s,box-shadow .3s;box-shadow:0 14px 40px -12px rgba(180,214,112,.5)}
.qp-approve:hover:not(:disabled){transform:translateY(-2px)}
.qp-approve:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.4)}
.qp-pdf{display:inline-flex;align-items:center;gap:8px;background:none;border:1px solid var(--line);color:var(--ink);border-radius:999px;padding:9px 18px;font-size:14px;cursor:pointer;font-family:Diplomat,sans-serif;transition:border-color .3s}
.qp-pdf:hover{border-color:var(--green)}
.qp-wa{position:fixed;bottom:96px;left:20px;z-index:45;width:52px;height:52px;border-radius:50%;background:var(--green);display:grid;place-items:center;box-shadow:0 12px 32px -8px rgba(180,214,112,.6);transition:transform .25s}
.qp-wa:hover{transform:scale(1.07)}
.qp-bar{position:fixed;inset-inline:0;bottom:0;z-index:46;background:rgba(10,10,14,.92);backdrop-filter:blur(14px);border-top:1px solid var(--line-s)}
@keyframes q-spin{to{transform:rotate(360deg)}}
@keyframes q-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
@keyframes q-pulse{0%,100%{box-shadow:0 0 0 0 rgba(180,214,112,.35)}50%{box-shadow:0 0 0 12px rgba(180,214,112,0)}}
@keyframes q-rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.qp-panel>section{animation:q-rise .5s cubic-bezier(.22,1,.36,1) both}
.qp-panel>section:nth-child(2){animation-delay:.07s}
.qp-panel>section:nth-child(3){animation-delay:.14s}
.qp-panel>section:nth-child(4){animation-delay:.21s}
.qp-panel>section+section{margin-top:38px}
.qp-acc-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .3s cubic-bezier(.22,1,.36,1)}
.qp-acc-body.open{grid-template-rows:1fr}
.qp-acc-body>.in{overflow:hidden;min-height:0}
@media(prefers-reduced-motion:reduce){.qp-panel>section{animation:none}.qp-acc-body{transition:none}}
@media(max-width:640px){.qp main{padding:20px 15px 116px}.qp-wa{bottom:92px;width:48px;height:48px}}
@media print{.qp-wa,.qp-bar,.qp-head{display:none!important}.qp *{box-shadow:none!important}}
`;

const TABS = [
  { key: "overview", label: "סקירה" },
  { key: "included", label: "מה כלול" },
  { key: "price", label: "מחיר ושדרוגים" },
  { key: "sign", label: "אישור" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

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
  const [tab, setTab] = useState<TabKey>("overview");

  const sigRef = useRef<HTMLCanvasElement | null>(null);
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

  const onSign = tab === "sign";
  useEffect(() => {
    if (onSign) setupCanvas();
    window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  /* loading / not found */
  if (isLoading) {
    return (
      <Root>
        <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
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
        <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ textAlign: "center", maxWidth: 460 }}>
            <div className="k" style={{ fontSize: 30 }}>ההצעה לא נמצאה</div>
            <p style={{ color: "var(--muted)", marginTop: 14 }}>ייתכן שהקישור פג או שגוי. אפשר לפנות אליי ואשלח קישור מעודכן.</p>
          </div>
        </div>
      </Root>
    );
  }

  const vatPct = content.vat_pct ?? 18;
  const bonusesSum = bonusesTotal(content);
  const total = withVat(totals!.netTotal, vatPct);
  const vat = total - totals!.netTotal;
  const anchor = totals!.oneTimeBase + bonusesSum;
  const split = paymentSplit(total, content);
  const clientFirst = (quote.client_name || "").trim().split(/\s+/)[0] || "";
  const dateStr = formatDate(quote.created_at);

  const why = content.differentiators ?? [];
  const includes = [...(content.pages ?? []).map((p) => p.name), ...(content.features ?? []).map((f) => f.name)].filter(Boolean);
  const phases = content.phases ?? [];
  const upgrades = content.upsells ?? [];
  const maintTiers = (content.maintenance?.offer ? content.maintenance.tiers : []).filter((t) => TIER_ORDER.includes(t));
  const bonuses = content.bonuses ?? [];
  const steps = content.next_steps ?? [];
  const faq = content.faq ?? [];
  const legal = content.legal ?? [];
  const testimonial = content.testimonial && content.testimonial.quote?.trim() ? content.testimonial : null;
  const selectedUpgrades = upgrades.filter((u) => upsellIds.includes(u.id));
  const maintObj = maintTier ? config[maintTier] : null;

  /* thank-you */
  if (quote.status === "signed" || signed) {
    const t = computeQuote(content, { upsell_ids: upsellIds, maintenance_tier: maintTier }, (x) => config[x].price);
    const inclVat = withVat(t.netTotal, vatPct);
    const sp = paymentSplit(inclVat, content);
    return (
      <Root>
        <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "40px 22px" }}>
          <div style={{ textAlign: "center", maxWidth: 540, width: "100%" }}>
            <div style={{ width: 92, height: 92, borderRadius: "50%", display: "grid", placeItems: "center", margin: "0 auto 26px", background: "radial-gradient(circle at 50% 40%,rgba(180,214,112,.25),transparent 70%)", animation: "q-pop .5s cubic-bezier(.22,1,.36,1) both" }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--green)", animation: "q-pulse 2.2s ease-out infinite" }}>
                <Check size={36} stroke="#0a0a0c" w={3} />
              </div>
            </div>
            <div className="k" style={{ color: "var(--green)", fontSize: 15, marginBottom: 10 }}>ההצעה אושרה בהצלחה</div>
            <h1 className="k" style={{ fontSize: "clamp(28px,5vw,44px)", lineHeight: 1.08, margin: 0 }}>תודה{clientFirst ? ` ${clientFirst}` : ""},<br />יוצאים לדרך.</h1>
            <p style={{ color: "var(--muted)", maxWidth: 430, margin: "18px auto 0" }}>קיבלתי את האישור והחתימה שלך. אני חוזר אליך בקרוב עם פרטי המקדמה, ומשם מתחילים.</p>
            <div style={{ marginTop: 30, background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 18, padding: 24, textAlign: "right", maxWidth: 420, marginInline: "auto" }}>
              <SumRow label="סה״כ חד פעמי כולל מע״מ" value={money(inclVat)} green bold border />
              <SumRow label={`מקדמה עכשיו (${sp.depositPct}%)`} value={money(sp.deposit)} border />
              <SumRow label="יתרה לפני השקה" value={money(sp.rest)} />
              {maintObj && <SumRow label={`תחזוקה ${maintObj.name} (חודשי)`} value={money(maintObj.price)} green topBorder />}
            </div>
          </div>
        </div>
      </Root>
    );
  }

  /* which tabs have content */
  const hasTab: Record<TabKey, boolean> = {
    overview: !!(content.intro?.trim() || why.length || phases.length || testimonial),
    included: !!(includes.length || bonuses.length),
    price: true,
    sign: true,
  };
  const tabs = TABS.filter((t) => hasTab[t.key]);
  const activeIdx = tabs.findIndex((t) => t.key === tab);
  const active: TabKey = activeIdx >= 0 ? tab : tabs[0].key;
  const nextTab = tabs[tabs.findIndex((t) => t.key === active) + 1]?.key;

  return (
    <Root>
      {/* sticky letterhead + tabs */}
      <div className="qp-head">
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "12px 22px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <img src="/brand/logo-mark.svg" alt="" style={{ width: 26, height: 26, flex: "none" }} />
              <span className="k" style={{ fontSize: 15 }}>{STUDIO}</span>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              הצעת מחיר{quote.client_name ? ` · ${quote.client_name}` : ""}
            </span>
          </div>
          <div className="qp-tabs">
            {tabs.map((t) => (
              <button key={t.key} type="button" className={`qp-tab${t.key === active ? " on" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main>
        <div className="qp-panel" key={active}>
          {active === "overview" && (
            <>
              <section>
                {content.validity_days ? (
                  <span className="k" style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(180,214,112,.3)", background: "rgba(180,214,112,.07)", color: "var(--green)", fontSize: 13, padding: "6px 14px", borderRadius: 999 }}>
                    <b style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block", animation: "q-pulse 2.4s ease-out infinite" }} />
                    ההצעה בתוקף {content.validity_days} ימים
                  </span>
                ) : null}
                <h1 className="k" style={{ fontSize: "clamp(32px,6vw,54px)", lineHeight: 1.03, letterSpacing: "-.02em", margin: "18px 0 0" }}>
                  {quote.title}<span style={{ color: "var(--green)" }}>.</span>
                </h1>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px 28px", marginTop: 28, borderTop: "1px solid var(--line-s)", paddingTop: 22 }}>
                  <MetaCell label="איש הקשר" value={quote.client_name || "לקוח"} />
                  <MetaCell label="סוג הפרויקט" value={SITE_TYPE_LABEL[quote.site_type as QuoteSiteType]} />
                  <MetaCell label="תאריך וגרסה" value={dateStr || "היום"} sub={content.version} />
                </div>
                {content.intro?.trim() && (
                  <p style={{ fontSize: "clamp(16px,2.2vw,20px)", lineHeight: 1.7, color: "#d9d8d2", margin: "26px 0 0", maxWidth: 620, whiteSpace: "pre-wrap" }}>{content.intro}</p>
                )}
              </section>

              {why.length > 0 && (
                <section>
                  <Head eyebrow="למה לעבוד איתי" title="לא רק אתר. שותף." />
                  <div style={{ borderTop: "1px solid var(--line-s)" }}>
                    {why.map((w, i) => (
                      <div key={w.id} style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 18, padding: "24px 4px", borderBottom: "1px solid var(--line-s)", alignItems: "baseline" }}>
                        <span className="k3" style={{ fontSize: 28, color: "var(--green)" }}>{String(i + 1).padStart(2, "0")}</span>
                        <div>
                          <h3 className="k" style={{ fontSize: 20, margin: "0 0 7px" }}>{w.title}</h3>
                          {w.desc && <p style={{ color: "var(--muted)", fontSize: 15, margin: 0, maxWidth: 560 }}>{w.desc}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {phases.length > 0 && (
                <section>
                  <Head eyebrow="איך זה עובד" title="השלבים והלוח." />
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", top: 6, bottom: 6, right: 19, width: 2, background: "linear-gradient(var(--green),rgba(180,214,112,.08))" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                      {phases.map((ph, i) => (
                        <div key={ph.id} style={{ display: "flex", gap: 18, alignItems: "flex-start", position: "relative" }}>
                          <div className="k" style={{ flex: "none", width: 40, height: 40, borderRadius: "50%", background: "var(--bg)", border: "2px solid var(--green)", color: "var(--green)", display: "grid", placeItems: "center", fontSize: 16, zIndex: 1 }}>{i + 1}</div>
                          <div style={{ background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 16, padding: "18px 20px", flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                              <h3 className="k" style={{ fontSize: 18, margin: 0 }}>{ph.name}</h3>
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

              {testimonial && (
                <section>
                  <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
                    <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 14 }}>{[0, 1, 2, 3, 4].map((i) => <Star key={i} />)}</div>
                    <blockquote className="k3" style={{ fontSize: "clamp(19px,3vw,25px)", lineHeight: 1.5, margin: 0, color: "var(--ink)" }}>״{testimonial.quote}״</blockquote>
                    <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 14 }}>
                      <b className="k" style={{ color: "var(--ink)" }}>{testimonial.name}</b>{testimonial.role ? ` · ${testimonial.role}` : ""}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {active === "included" && (
            <>
              {includes.length > 0 && (
                <section>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
                    <Head eyebrow="מה נכלל" title="העמודים והפיצ׳רים." mb={0} />
                    <div style={{ textAlign: "left" }}>
                      <div className="k" style={{ fontSize: 32, lineHeight: 1, color: "var(--green)" }}>{includes.length}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>עמודים ופיצ׳רים</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 11, gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))" }}>
                    {includes.map((nm, i) => (
                      <div key={i} className="qp-lift" style={{ display: "flex", alignItems: "center", gap: 13, background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 14, padding: "14px 16px" }}>
                        <span className="k" style={{ fontSize: 14, color: "var(--green)", opacity: 0.75, minWidth: 22 }}>{String(i + 1).padStart(2, "0")}</span>
                        <span style={{ width: 1, alignSelf: "stretch", background: "var(--line)", flex: "none" }} />
                        <span style={{ fontSize: 15, fontWeight: 500 }}>{nm}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {bonuses.length > 0 && (
                <section>
                  <Head eyebrow="על חשבוני" title="בונוסים במתנה." />
                  <div style={{ display: "grid", gap: 13, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
                    {bonuses.map((b) => (
                      <div key={b.id} style={{ background: "linear-gradient(150deg,rgba(180,214,112,.09),var(--card) 55%)", border: "1px solid rgba(180,214,112,.22)", borderRadius: 16, padding: 20, position: "relative" }}>
                        {b.value > 0 && <span className="k" style={{ position: "absolute", top: 15, left: 15, fontSize: 12, color: "var(--green)", background: "rgba(180,214,112,.12)", border: "1px solid rgba(180,214,112,.28)", padding: "4px 10px", borderRadius: 999 }}>שווי {money(b.value)}</span>}
                        <h3 className="k" style={{ fontSize: 17, margin: "0 0 8px 96px" }}>{b.name}</h3>
                        {b.desc && <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>{b.desc}</p>}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {active === "price" && (
            <>
              {upgrades.length > 0 && (
                <section>
                  <Head eyebrow="רשות, לא חובה" title="שדרוגים לבחירתך." desc="כל שדרוג מתעדכן מיד במחיר למטה. אפשר לבחור כמה שרוצים, או להשאיר כמו שזה." />
                  <div style={{ display: "grid", gap: 13 }}>
                    {upgrades.map((u) => {
                      const sel = upsellIds.includes(u.id);
                      return (
                        <button key={u.id} type="button" className="qp-tog" onClick={() => setUpsellIds((ids) => (sel ? ids.filter((x) => x !== u.id) : [...ids, u.id]))}
                          style={{ display: "flex", gap: 15, width: "100%", textAlign: "right", cursor: "pointer", background: sel ? "rgba(180,214,112,.07)" : "var(--card)", border: `1px solid ${sel ? "rgba(180,214,112,.45)" : "var(--line-s)"}`, borderRadius: 16, padding: "18px 20px" }}>
                          <div style={{ flex: "none", width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", marginTop: 2, border: `2px solid ${sel ? "var(--green)" : "var(--line)"}`, background: sel ? "var(--green)" : "transparent" }}>
                            <Check size={15} stroke="#0a0a0c" w={3.2} style={{ opacity: sel ? 1 : 0 }} />
                          </div>
                          <div style={{ flex: 1, textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
                                <h3 className="k" style={{ fontSize: 18, margin: 0, display: "inline" }}>{u.title}</h3>
                                {u.recommended && <span className="k" style={{ fontSize: 11, color: "var(--green)", background: "rgba(180,214,112,.12)", border: "1px solid rgba(180,214,112,.3)", padding: "2px 9px", borderRadius: 999 }}>מומלץ</span>}
                              </span>
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

              {maintTiers.length > 0 && (
                <section>
                  <Head eyebrow="אחרי ההשקה" title="תחזוקה שוטפת." desc="חבילה אחת, או בכלל לא. הוצאה חודשית נפרדת, וכל המחירים כאן כוללים מע״מ." />
                  <div style={{ display: "grid", gap: 13, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
                    {maintTiers.map((t) => {
                      const cfg = config[t];
                      const sel = maintTier === t;
                      const feats = (cfg.features?.custom ?? cfg.features?.wordpress ?? []).slice(0, 4);
                      return (
                        <button key={t} type="button" className="qp-tog" onClick={() => setMaintTier(sel ? null : t)}
                          style={{ display: "block", width: "100%", textAlign: "right", cursor: "pointer", background: sel ? "rgba(180,214,112,.07)" : "var(--card)", border: `1px solid ${sel ? "rgba(180,214,112,.45)" : "var(--line-s)"}`, borderRadius: 18, padding: 20 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
                            <h3 className="k" style={{ fontSize: 18, margin: 0 }}>{cfg.name}</h3>
                            <div style={{ flex: "none", width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sel ? "var(--green)" : "var(--line)"}`, display: "grid", placeItems: "center" }}>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--green)", transform: `scale(${sel ? 1 : 0})`, transition: "transform .2s" }} />
                            </div>
                          </div>
                          <div className="k" style={{ fontSize: 25, color: "var(--green)" }}>{money(cfg.price)}<span style={{ fontFamily: "Diplomat,sans-serif", fontWeight: 400, fontSize: 14, color: "var(--muted)" }}> / חודש</span></div>
                          {cfg.tagline && <p style={{ color: "var(--muted)", fontSize: 14, margin: "8px 0 13px" }}>{cfg.tagline}</p>}
                          {feats.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--line-s)", paddingTop: 13 }}>
                              {feats.map((f, i) => (
                                <span key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "#cfcec8" }}>
                                  <Check size={14} stroke="#b4d670" w={2.8} style={{ flex: "none", marginTop: 3 }} />{f}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {maintTier && <button type="button" onClick={() => setMaintTier(null)} style={{ background: "none", border: 0, color: "var(--muted)", fontSize: 12.5, marginTop: 10, cursor: "pointer", textDecoration: "underline" }}>ביטול בחירת תחזוקה</button>}
                </section>
              )}

              <section>
                <div style={{ background: "radial-gradient(130% 90% at 50% 0%,rgba(180,214,112,.09),transparent 62%),var(--card)", border: "1px solid rgba(180,214,112,.2)", borderRadius: 24, padding: "clamp(24px,5vw,42px)", boxShadow: "0 30px 80px -34px rgba(180,214,112,.28)" }}>
                  <h2 className="k" style={{ fontSize: "clamp(22px,3.4vw,30px)", textAlign: "center", margin: "0 0 26px" }}>ההשקעה בפרויקט.</h2>
                  <div style={{ maxWidth: 500, margin: "0 auto", fontVariantNumeric: "tabular-nums" }}>
                    {bonusesSum > 0 && (
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "11px 0" }}>
                        <span style={{ color: "var(--muted)", fontSize: 15 }}>שווי כולל של הפרויקט והבונוסים</span>
                        <span className="k" style={{ fontSize: 21, color: "var(--faint)", textDecoration: "line-through", textDecorationColor: "rgba(180,214,112,.55)", whiteSpace: "nowrap" }}>{money(anchor)}</span>
                      </div>
                    )}
                    {bonusesSum > 0 && (
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "11px 0", borderBottom: "1px solid var(--line-s)" }}>
                        <span style={{ color: "var(--green)", fontSize: 15 }}>הבונוסים, במתנה</span>
                        <span className="k" style={{ fontSize: 18, color: "var(--green)", whiteSpace: "nowrap" }}>− {money(bonusesSum)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "12px 0" }}>
                      <span style={{ fontSize: 15 }}>מחיר הפרויקט <span style={{ color: "var(--faint)", fontSize: 13 }}>(לא כולל מע״מ)</span></span>
                      <span className="k" style={{ fontSize: 18, whiteSpace: "nowrap" }}>{money(totals!.oneTimeBase)}</span>
                    </div>
                    {selectedUpgrades.length > 0 && (
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "12px 0" }}>
                        <span style={{ fontSize: 15 }}>שדרוגים שנבחרו <span style={{ color: "var(--faint)", fontSize: 13 }}>({selectedUpgrades.length})</span></span>
                        <span className="k" style={{ fontSize: 18, whiteSpace: "nowrap" }}>+ {money(totals!.upsellsTotal)}</span>
                      </div>
                    )}
                    {totals!.discountAmount > 0 && (
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "12px 0" }}>
                        <span style={{ color: "var(--green)", fontSize: 15 }}>{content.discount?.label?.trim() || "הנחה"}</span>
                        <span className="k" style={{ fontSize: 18, color: "var(--green)", whiteSpace: "nowrap" }}>− {money(totals!.discountAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid var(--line-s)" }}>
                      <span style={{ color: "var(--muted)", fontSize: 15 }}>מע״מ ({vatPct}%)</span>
                      <span className="k" style={{ fontSize: 18, color: "var(--muted)", whiteSpace: "nowrap" }}>{money(vat)}</span>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 26 }}>
                      <div style={{ color: "var(--muted)", fontSize: 15, marginBottom: 6 }}>סה״כ חד פעמי כולל מע״מ</div>
                      <CountUp to={total} format={money} className="k" style={{ fontSize: "clamp(48px,11vw,78px)", lineHeight: 1, color: "var(--green)", letterSpacing: "-.02em", display: "block" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 24 }}>
                      <SplitCard label={`מקדמה עכשיו (${split.depositPct}%)`} value={money(split.deposit)} />
                      <SplitCard label="יתרה לפני השקה" value={money(split.rest)} />
                    </div>
                    {maintObj && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12, background: "rgba(180,214,112,.06)", border: "1px solid rgba(180,214,112,.2)", borderRadius: 14, padding: "14px 17px" }}>
                        <span style={{ fontSize: 14.5 }}>תחזוקה {maintObj.name} <span style={{ color: "var(--faint)", fontSize: 13 }}>(חודשי)</span></span>
                        <span className="k" style={{ color: "var(--green)", whiteSpace: "nowrap" }}>{money(maintObj.price)} / חודש</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}

          {active === "sign" && (
            <>
              {steps.length > 0 && (
                <section>
                  <Head eyebrow="מה קורה אחרי שתאשר" title="הצעדים הבאים." />
                  <div style={{ display: "grid", gap: 11, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
                    {steps.map((s, i) => (
                      <div key={s.id} style={{ background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 14, padding: "16px 17px" }}>
                        <span className="k" style={{ display: "inline-grid", placeItems: "center", width: 30, height: 30, borderRadius: 9, background: "rgba(180,214,112,.1)", color: "var(--green)", fontSize: 15 }}>{i + 1}</span>
                        <p style={{ fontSize: 14.5, margin: "11px 0 0", color: "var(--ink)" }}>{s.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {faq.length > 0 && (
                <section>
                  <Head eyebrow="שאלות נפוצות" title="כדאי לדעת." />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {faq.map((f, i) => {
                      const open = !!faqOpen[i];
                      return (
                        <div key={f.id} style={{ background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 14, overflow: "hidden" }}>
                          <button type="button" onClick={() => setFaqOpen((s) => ({ ...s, [i]: !s[i] }))} className="k" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "17px 19px", background: "none", border: 0, color: "var(--ink)", fontSize: 16.5, textAlign: "right", cursor: "pointer" }}>
                            {f.q}
                            <span style={{ flex: "none", fontSize: 24, lineHeight: 1, color: "var(--green)", transform: `rotate(${open ? 45 : 0}deg)`, transition: "transform .25s" }}>+</span>
                          </button>
                          <div className={`qp-acc-body${open ? " open" : ""}`}><div className="in"><div style={{ padding: "0 19px 19px", color: "var(--muted)", fontSize: 15 }}>{f.a}</div></div></div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {legal.length > 0 && (
                <section>
                  <Head eyebrow="האותיות הקטנות" title="סעיפים משפטיים." />
                  <div style={{ background: "var(--card)", border: "1px solid var(--line-s)", borderRadius: 14, overflow: "hidden" }}>
                    <button type="button" onClick={() => setLegalOpen((o) => !o)} className="k" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "15px 19px", background: "none", border: 0, color: "var(--ink)", fontSize: 15.5, textAlign: "right", cursor: "pointer" }}>
                      לצפייה בכל הסעיפים
                      <span style={{ flex: "none", fontSize: 22, lineHeight: 1, color: "var(--green)", transform: `rotate(${legalOpen ? 45 : 0}deg)`, transition: "transform .25s" }}>+</span>
                    </button>
                    <div className={`qp-acc-body${legalOpen ? " open" : ""}`}>
                      <ul className="in" style={{ margin: 0, padding: "0 19px 17px", color: "var(--muted)", fontSize: 14, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                        {legal.map((l, i) => (
                          <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><span style={{ color: "var(--green)", flex: "none" }}>•</span>{l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </section>
              )}

              <section>
                <div style={{ background: "var(--card)", border: "1px solid rgba(180,214,112,.22)", borderRadius: 22, padding: "clamp(22px,5vw,40px)" }}>
                  <div style={{ textAlign: "center", marginBottom: 24 }}>
                    <h2 className="k" style={{ fontSize: "clamp(24px,4vw,34px)", margin: 0 }}>מוכן להתחיל?</h2>
                    <p style={{ color: "var(--muted)", margin: "10px 0 0" }}>חתימה כאן היא אישור ההצעה. אין חיוב בשלב הזה, אני חוזר אליך עם פרטי המקדמה.</p>
                  </div>
                  <div style={{ maxWidth: 500, margin: "0 auto" }}>
                    <label style={{ display: "block", fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>השם המלא שלך</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ישראל ישראלי" className="qp-input" />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 8px" }}>
                      <label style={{ fontSize: 14, color: "var(--muted)" }}>חתימה בציור</label>
                      <button type="button" onClick={clearSig} className="k" style={{ background: "none", border: 0, color: "var(--green)", fontSize: 13, cursor: "pointer" }}>ניקוי</button>
                    </div>
                    <canvas ref={sigRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
                      style={{ width: "100%", height: 150, display: "block", background: "var(--bg2)", border: "1px dashed var(--line)", borderRadius: 12, touchAction: "none", cursor: "crosshair" }} />
                    <button type="button" className="qp-approve" onClick={approve} disabled={submitting || !name.trim() || !hasDrawn}>
                      {submitting ? "רגע…" : `אני מאשר · ${money(total)}`}
                    </button>
                    <p style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, margin: "13px 0 0" }}>בלחיצה אני מאשר את תנאי ההצעה והסעיפים המשפטיים.</p>
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px 22px", marginTop: 16 }}>
                      <Trust text="בלי חיוב עכשיו" /><Trust text="30 יום אחריות" /><Trust text="פרטי ומאובטח" />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 22 }}>
                  <button type="button" onClick={() => window.print()} className="qp-pdf"><PrintIcon />שמירה כ-PDF</button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* fixed bottom price + CTA bar */}
      <div className="qp-bar">
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "11px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1 }}>סה״כ כולל מע״מ</div>
            <div className="k" style={{ fontSize: 21, color: "var(--green)", marginTop: 3 }}>{money(total)}</div>
          </div>
          {active === "sign" ? (
            <span style={{ fontSize: 13, color: "var(--muted)" }}>השלימו את החתימה למעלה</span>
          ) : (
            <button type="button" className="k" onClick={() => setTab(nextTab === "sign" || !nextTab ? "sign" : nextTab)}
              style={{ background: "var(--green)", color: "var(--ink-on-green)", border: 0, borderRadius: 999, padding: "13px 24px", fontSize: 15, cursor: "pointer" }}>
              {nextTab && nextTab !== "sign" ? "המשך" : "לאישור וחתימה"} <i style={{ fontStyle: "normal" }}>←</i>
            </button>
          )}
        </div>
      </div>

      {WHATSAPP && (
        <a className="qp-wa" href={`https://wa.me/${String(WHATSAPP).replace(/\D/g, "")}?text=${encodeURIComponent(`היי אורי, יש לי שאלה על ההצעה "${quote.title}"`)}`} target="_blank" rel="noreferrer" aria-label="וואטסאפ">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="#0a0a0c"><path d="M12 2a10 10 0 00-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1012 2zm0 18a8 8 0 01-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1112 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8s-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 01-3.2-2.8c-.2-.4.2-.4.6-1.2.1-.1 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 00-.7.3c-.3.3-.9.9-.9 2.1s.9 2.5 1 2.6 1.8 2.9 4.5 4c1.7.7 2.3.8 3.1.7.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1z" /></svg>
        </a>
      )}
    </Root>
  );
}

/* ---------- helpers ---------- */

function Root({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{STYLES}</style>
      <div className="qp" dir="rtl">{children}</div>
    </>
  );
}

function Head({ eyebrow, title, desc, mb }: { eyebrow?: string; title: string; desc?: string; mb?: number }) {
  return (
    <div style={{ marginBottom: mb ?? 20 }}>
      {eyebrow && <div className="k" style={{ color: "var(--green)", fontSize: 12.5, letterSpacing: ".14em", marginBottom: 9 }}>{eyebrow}</div>}
      <h2 className="qp-h2">{title}</h2>
      {desc && <p style={{ color: "var(--muted)", margin: "11px 0 0", maxWidth: 560 }}>{desc}</p>}
    </div>
  );
}

function MetaCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div style={{ color: "var(--faint)", fontSize: 12, letterSpacing: ".12em", marginBottom: 6 }}>{label}</div>
      <div className="k" style={{ fontSize: 16 }}>{value}</div>
      {sub && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SplitCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--line-s)", borderRadius: 14, padding: 15, textAlign: "center" }}>
      <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 5 }}>{label}</div>
      <div className="k" style={{ fontSize: 21 }}>{value}</div>
    </div>
  );
}

function SumRow({ label, value, green, bold, border, topBorder }: { label: string; value: string; green?: boolean; bold?: boolean; border?: boolean; topBorder?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: border ? "1px solid var(--line-s)" : undefined, borderTop: topBorder ? "1px solid var(--line-s)" : undefined, marginTop: topBorder ? 2 : undefined }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <b className="k" style={{ color: green ? "var(--green)" : "var(--ink)", fontSize: bold ? 19 : undefined }}>{value}</b>
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
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={style}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
}

function Star() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="#b4d670"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" /></svg>;
}

function PrintIcon() {
  return <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>;
}

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "motion/react";
import { applyGender } from "@/lib/gender";
import { supabase } from "@/lib/supabase";
import type { Gender, Json } from "@/types/database";
import { TIER_ORDER, TIER_META, tierFeatures, type ServiceTier, type ServiceSiteType } from "@/lib/service-plans";
import { buildTermsSnapshot, TERMS_BLOCKS, usageApproval, consentText, annualTotal, annualMonthly, ANNUAL_DISCOUNT_PCT } from "@/lib/service-agreement";
import { SignaturePad } from "@/components/SignaturePad";
import CounterComp from "@/components/react-bits/Counter";
import TrueFocus from "@/components/react-bits/TrueFocus";
import ClickSpark from "@/components/react-bits/ClickSpark";
import { WelcomingWords } from "@/components/layout/WelcomingWords";

// Counter's vendored props type infers several style props as required; the
// component defaults them at runtime, so treat it loosely typed here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Counter = CounterComp as any;

// Same intro as the partner ref-landing: the multilingual greeting curtain,
// played once per full page load (module flag survives SPA navigation).
let introPlayed = false;

/**
 * Public maintenance-packages marketing landing (no auth), reachable at
 * /l/:token. The token later ties a signup back to a client-lead or a partner
 * referral; for now it is read-only context. UI phase: no DB / email yet
 * (the form is a mock that shows a success state). Committed dark + RTL,
 * Studio brand tokens, and React Bits Pro animation components.
 */

// Landing-page *voice* only: the essence label + persuasive tagline (and which
// card is highlighted). Everything factual, name, price, response time, work
// hours and the feature checklist, comes from service-plans.ts (tierFeatures /
// TIER_META), the same source the client's "השירות שלך" dashboard reads, so the
// two surfaces can never drift. Adapts to WordPress vs custom-code per siteType.
const LANDING_COPY: Record<ServiceTier, { label: string; tagline: string; hot?: boolean }> = {
  core: { label: "שקט נפשי", tagline: "האתר מתוחזק, מאובטח ומגובה, בלי ש{תצטרך|תצטרכי} לחשוב על זה." },
  pro: { label: "השותף שלך", tagline: "כל השקט הנפשי, ובנוסף אני דוחף את האתר קדימה כל חודש.", hot: true },
  ultra: { label: "צמוד אליך", tagline: "ליווי צמוד ופיתוח שוטף, כאילו יש לך איש טכנולוגיה בבית." },
};

// Build the landing tier cards for a given site type, pulling all hard data
// from the shared source and dropping the trailing "עדיפות, תגובה" line (shown
// as its own badge on the card).
function buildTiers(siteType: ServiceSiteType) {
  return TIER_ORDER.map((id) => {
    const meta = TIER_META[id];
    const copy = LANDING_COPY[id];
    return {
      id,
      name: meta.name.replace(/^Studio\s+/, ""), // "Core" / "Pro" / "Ultra VIP"
      fullName: meta.name, // "Studio Core"
      label: copy.label,
      tagline: copy.tagline,
      price: meta.price,
      resp: meta.responseHours,
      hot: !!copy.hot,
      feats: tierFeatures(id, siteType).filter((f) => !f.startsWith("עדיפות")),
    };
  });
}

const WHY = [
  { n: "01", h: "אבטחה שנשחקת", p: "רכיבים ותשתית מתיישנים, חולשות נפתחות, ובוטים סורקים מסביב לשעון. בלי עדכונים וניטור, פריצה היא עניין של זמן.", tag: "בלי עדכונים", alert: "3 חולשות פתוחות", viz: "shield" as const },
  { n: "02", h: "נפילה שלא מגלים בזמן", p: "אתר שנופל באמצע הלילה זה לקוחות שלא חוזרים והזמנות שלא נכנסות. בלי ניטור זמינות, מגלים מאוחר מדי.", tag: "בלי ניטור", alert: "השבתה שלא זוהתה", viz: "downtime" as const },
  { n: "03", h: "מהירות שיורדת", p: "תמונות כבדות, קוד ישן וקאש לא מכוון. הביצועים נשחקים לאט, והחוויה, וגם גוגל, נפגעים.", tag: "בלי תחזוקה", alert: "ציון מהירות בירידה", viz: "decline" as const },
];

const SVC_TABS = [
  {
    id: "speed", label: "מהירות", title: "אתר שנטען מיד.",
    blocks: [
      { t: "מאיץ ומטמון", d: "האתר מוגש מהיר לכל גולש, עם CDN, מטמון וטעינה מותאמת." },
      { t: "אופטימיזציה שוטפת", d: "מדד המהירות נמדד באופן קבוע ומטופל לפני שהוא מתחיל להישחק." },
    ],
  },
  {
    id: "uptime", label: "זמינות", title: "{יודע לפני שאתה מרגיש|יודעת לפני שאת מרגישה}.",
    blocks: [
      { t: "ניטור 24/7", d: "בדיקת זמינות מסביב לשעון, מכמה נקודות בעולם." },
      { t: "התראה מיידית", d: "אם משהו נופל, אני מקבל התראה ומטפל, לרוב עוד לפני שמישהו שם לב." },
    ],
  },
  {
    id: "security", label: "אבטחה", title: "שכבת הגנה בקצה.",
    blocks: [
      { t: "חומת אש והגנה", d: "התקפות אוטומטיות ובוטים נחסמים עוד לפני שהם מגיעים לאתר." },
      { t: "סריקות Malware", d: "סריקה שוטפת של הקבצים, וטיפול מיידי בכל ממצא." },
    ],
  },
  {
    id: "backup", label: "גיבויים", title: "עותק מוכן לכל תרחיש.",
    blocks: [
      { t: "גיבוי יומי אוטומטי", d: "הקבצים והמסד מגובים כל יום, בלי שצריך לזכור כלום." },
      { t: "שחזור מהיר", d: "קרה משהו? מחזירים את האתר לנקודה תקינה תוך דקות." },
    ],
  },
];

const STEPS = [
  { h: "בחירה ואישור", p: "{בוחר|בוחרת} חבילה בדף הזה {ומאשר|ומאשרת} את התנאים. זה מגיע אליי ישירות, בלי תשלום בשלב הזה." },
  { h: "חיבור ניטור ואבטחה", p: "אני מחבר לאתר ניטור זמינות, אבטחה בקצה וגיבויים אוטומטיים, ומגדיר את הדשבורד." },
  { h: "הדשבורד נפתח", p: "{אתה מקבל|את מקבלת} גישה לעמוד ״השירות שלך״, עם המספרים החיים של האתר במקום אחד." },
  { h: "דו״ח כל חודש", p: "בכל תחילת חודש מגיע סיכום ממותג: מה נעשה, איך האתר מתפקד, וכמה שווה הליווי." },
  { h: "תמיכה שוטפת", p: "קריאת שירות בלחיצה, שינויים ושיפורים לפי החבילה. {אתה לא לבד|את לא לבד} מול האתר." },
];

const FAQ = [
  { q: "איך מתבצע התשלום?", a: "בכרטיס אשראי, בחיוב חודשי מחזורי (ריטיינר), בכל 1 לחודש עבור החודש הקרוב. בדף הזה לא מתבצע תשלום, רק בחירה ואישור, ואני חוזר אליך לתיאום." },
  { q: "אפשר לבטל מתי שרוצים?", a: "כן. הליווי ללא התחייבות לתקופה, וניתן להפסיק בכל עת בהודעה של 30 יום מראש בכתב." },
  { q: "מה קורה לשעות שלא ניצלתי?", a: "שעות העבודה הן לחודש השוטף ואינן נצברות. עבודה מעבר להיקף החבילה תתומחר מראש לפי תעריף שעתי מוסכם." },
  { q: "האתר שלי לא בוורדפרס, זה מתאים?", a: "בהחלט. יש חבילות גם לאתרים מותאמים אישית (קוד), עם פריסה אוטומטית, ניטור וגיבויים." },
];

const UPTIME_BARS = 28;

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".rv"));
    if (reduce) { els.forEach((e) => e.classList.add("in")); return; }
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
  return ref;
}

export default function PackagesLanding() {
  const { token } = useParams();
  const [params] = useSearchParams();
  // Gender + personal greeting. For now driven by query params so the page can
  // be previewed both ways (?g=f&name=דנה); once the token->lead/client lookup
  // is wired (DB phase), these come from the addressed client's profile.
  const navigate = useNavigate();
  // Personalization + prefill come from the landing invite (token -> DB via
  // get_landing_context) when present; query params are the fallback for
  // previewing without a real link (?g=f&name=&business=&email=&phone=&tier=&type=).
  const pf = (k: string) => (params.get(k) || "").trim();
  const [gender, setGender] = useState<Gender>(params.get("g") === "f" ? "female" : "male");
  const [greetName, setGreetName] = useState(pf("name"));
  const [ctx, setCtx] = useState<Record<string, unknown> | null | undefined>(token ? undefined : null);
  const g = (male: string, female: string) => (gender === "female" ? female : male);
  const gt = (s: string) => applyGender(s, gender);
  // Merged prefill value: invite (DB) wins over query param.
  const fill = (key: string) =>
    (ctx && typeof ctx[key] === "string" ? (ctx[key] as string) : "") || pf(key);
  const prefilled = !!(greetName || fill("business") || fill("email") || fill("phone"));

  // Site type (WordPress vs custom-code) tailors the feature copy. Ori sets it
  // per recipient via ?type=wp|custom (later from the client's project_service),
  // so the client never has to choose. With no param the page stays generic and
  // shows a small toggle so a shared link still works.
  const forcedType: ServiceSiteType | null =
    params.get("type") === "custom" ? "custom"
    : params.get("type") === "wp" || params.get("type") === "wordpress" ? "wordpress"
    : null;
  const [siteType, setSiteType] = useState<ServiceSiteType>(forcedType ?? "wordpress");
  const typeFromCtx = !!ctx && (ctx.site_type === "wordpress" || ctx.site_type === "custom");
  const showTypeToggle = forcedType === null && !typeFromCtx;
  const tiers = buildTiers(siteType);

  const rootRef = useReveal();
  // The recommended package can be pre-selected via ?tier=core|pro|ultra.
  const tierParam = params.get("tier");
  const [tier, setTier] = useState(
    tierParam && (TIER_ORDER as string[]).includes(tierParam) ? tierParam : "pro"
  );
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [sigImage, setSigImage] = useState("");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  // Resolve the landing invite (token -> prefill + which client to attach to).
  useEffect(() => {
    if (!token) return;
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("get_landing_context", { p_token: token });
      if (!alive) return;
      const c = (data as Record<string, unknown> | null) || null;
      setCtx(c);
      if (c) {
        if (typeof c.name === "string" && c.name.trim()) setGreetName(c.name.trim());
        if (c.gender === "male" || c.gender === "female") setGender(c.gender);
        if (c.site_type === "wordpress" || c.site_type === "custom") setSiteType(c.site_type);
        if (c.tier === "core" || c.tier === "pro" || c.tier === "ultra") setTier(c.tier);
      }
    })();
    return () => { alive = false; };
  }, [token]);
  const [svcTab, setSvcTab] = useState("speed");
  const [intro, setIntro] = useState(!introPlayed);
  useEffect(() => { introPlayed = true; }, []);
  // Personal address moved out of the hero (it overloaded it) into a popup that
  // greets the named recipient once the intro loader clears. Only on the load
  // that actually showed the loader, and only for a personalized link. The name
  // can arrive async from the invite, so we open the popup from an effect once
  // both the loader is done AND the name is known (whichever resolves last).
  const loaderShownRef = useRef(!introPlayed);
  const [loaderDone, setLoaderDone] = useState(!loaderShownRef.current);
  const [greet, setGreet] = useState(false);
  const greetShownRef = useRef(false);
  useEffect(() => {
    if (loaderDone && loaderShownRef.current && greetName && !greetShownRef.current) {
      greetShownRef.current = true;
      setGreet(true);
    }
  }, [loaderDone, greetName]);

  // Hero counters start when the hero footer enters view.
  const [statsOn, setStatsOn] = useState(false);
  const dashRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = dashRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { setStatsOn(true); io.disconnect(); } });
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Floating-cards cluster: counters + bars fire on first view.
  const clusterRef = useRef<HTMLDivElement>(null);
  const [clusterOn, setClusterOn] = useState(false);
  useEffect(() => {
    const el = clusterRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { setClusterOn(true); io.disconnect(); } });
    }, { threshold: 0.22 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Cluster parallax: each card drifts by its data-depth as the section scrolls.
  useEffect(() => {
    const el = clusterRef.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>(".fc"));
    let raf = 0;
    const upd = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - innerHeight / 2) / (innerHeight / 2)));
      cards.forEach((c) => {
        const d = parseFloat(c.dataset.depth || "0");
        c.style.setProperty("--py", (p * d).toFixed(1) + "px");
      });
    };
    const tick = () => { if (!raf) raf = requestAnimationFrame(upd); };
    addEventListener("scroll", tick, { passive: true });
    addEventListener("resize", tick);
    upd();
    return () => { removeEventListener("scroll", tick); removeEventListener("resize", tick); };
  }, []);

  // How-it-works scroll timeline (progress fill + active markers).
  const tlRef = useRef<HTMLDivElement>(null);
  const [tlActive, setTlActive] = useState(-1);
  const [tlFill, setTlFill] = useState(0);
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setTlActive(STEPS.length - 1); setTlFill(1); return; }
    const line = tl.querySelector<HTMLElement>(".tl-line");
    const markers = Array.from(tl.querySelectorAll<HTMLElement>(".tl-marker"));
    let raf = 0;
    const onScroll = () => {
      raf = 0;
      if (!line) return;
      const act = window.innerHeight * 0.55;
      const lr = line.getBoundingClientRect();
      setTlFill(Math.max(0, Math.min(1, (act - lr.top) / lr.height)));
      let cur = -1;
      markers.forEach((m, i) => {
        const b = m.getBoundingClientRect();
        if (b.top + b.height / 2 <= act + 1) cur = i;
      });
      setTlActive(cur);
    };
    const tick = () => { if (!raf) raf = requestAnimationFrame(onScroll); };
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    onScroll();
    return () => { window.removeEventListener("scroll", tick); window.removeEventListener("resize", tick); };
  }, []);

  const G = "#b4d670", CY = "#77becf";
  const current = tiers.find((t) => t.id === tier)!;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    if (!sigImage) { setSubmitErr("צריך לחתום בשדה החתימה לפני האישור."); return; }
    const fd = new FormData(e.currentTarget);
    const meta = TIER_META[tier as ServiceTier];
    const snapshot = buildTermsSnapshot(tier as ServiceTier, siteType, gender);
    const payload = {
      tier,
      site_type: siteType,
      monthly_price: String(meta.price),
      response_hours: String(meta.responseHours),
      work_hours: String(meta.hours),
      billing_cycle: billing,
      full_name: String(fd.get("full_name") || ""),
      business: String(fd.get("business") || ""),
      email: String(fd.get("email") || ""),
      phone: String(fd.get("phone") || ""),
      signature: String(fd.get("full_name") || ""), // printed name alongside the drawn signature
      signature_image: sigImage,
      consent_accepted: true, // the consent checkbox is required to submit
      consent_text: consentText(gender),
      gender,
      terms_version: snapshot.version,
      terms_snapshot: snapshot,
    };
    setSubmitErr("");
    setSubmitting(true);
    const { data, error } = await supabase.rpc("submit_service_agreement", {
      p_token: token || "",
      p_payload: payload as unknown as Json,
    });
    setSubmitting(false);
    if (error) { setSubmitErr("קרתה שגיאה בשליחה, אפשר לנסות שוב."); return; }
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      confetti({ particleCount: 130, spread: 80, origin: { y: 0.72 }, colors: [G, CY, "#f3f2ee"] });
    }
    const at = (data as { access_token?: string } | null)?.access_token;
    if (at) navigate(`/l/agreement/${at}`);
    else setSent(true);
  }

  return (
    <div className="dark pkl" dir="rtl" ref={rootRef}>
      <style>{CSS}</style>

      {intro && <WelcomingWords onDone={() => { setIntro(false); setLoaderDone(true); }} />}

      <AnimatePresence>
        {greet && <GreetPopup name={greetName} gender={gender} onClose={() => setGreet(false)} />}
      </AnimatePresence>

      {/* NAV */}
      <nav className="pkl-nav">
        <div className="pkl-wrap pkl-nav-in">
          <div className="wm">Studio Ori Guy<small>תחזוקה וליווי</small></div>
          <div className="nav-mid">
            <a href="#inside">מבפנים</a><a href="#why">למה תחזוקה</a><a href="#packages">החבילות</a><a href="#faq">שאלות</a>
          </div>
          <a href="#choose" className="cta-btn">בחירת חבילה</a>
        </div>
      </nav>

      {/* HERO */}
      <header className="pkl-hero">
        <div className="pkl-wrap">
          <div className="hero-top">
            <span className="eyebrow">ליווי · תחזוקה · פיתוח</span>
            <span className="live"><b />דוגמה חיה · insights.origuystudio.com</span>
          </div>
          <h1 className="htitle">
            <span>שומר על</span>
            <span className="l2">האתר <span className="out">שלך.</span></span>
          </h1>
          <div className="hero-focus rv">
            <TrueFocus sentence="מהיר מאובטח מעודכן" manualMode={false} blurAmount={4}
              borderColor={G} glowColor="rgba(180,214,112,.5)" animationDuration={0.5} pauseBetweenAnimations={1.1} />
          </div>
          <div className="hero-foot" ref={dashRef}>
            <div>
              <p>ניטור, אבטחה, גיבויים ועדכונים שרצים ברקע, עם דשבורד חי ודו״ח חודשי. {g("אתה על העסק", "את על העסק")}, אני על האתר.</p>
              <div className="hero-ctas">
                <a href="#packages" className="cta-btn big">לחבילות ולמחירים</a>
                <a href="#inside" className="ghost-btn">ככה זה נראה מבפנים</a>
              </div>
            </div>
            <div className="hero-cards">
              <div className="hcard surf lit">
                <div className="fc-head">
                  <span className="dom">insights.origuystudio.com</span>
                  <span className="fc-tags"><span className="tagd">נתוני דוגמה</span><span className="live"><b />פעיל</span></span>
                </div>
                <div className="status">
                  <Stat label="ציון בריאות"><Counter value={statsOn ? 98 : 0} places={[10, 1]} fontSize={30} textColor={G} fontWeight="900" gap={1} gradientHeight={0} /></Stat>
                  <Stat label="זמינות"><Counter value={statsOn ? 99.98 : 0} places={[10, 1, ".", 0.1, 0.01]} fontSize={30} textColor="#f3f2ee" fontWeight="900" gap={1} gradientHeight={0} /><em>%</em></Stat>
                  <Stat label="מהירות"><Counter value={statsOn ? 96 : 0} places={[10, 1]} fontSize={30} textColor={CY} fontWeight="900" gap={1} gradientHeight={0} /></Stat>
                </div>
              </div>
              <div className="hchip surf"><b className="dot" aria-hidden="true" />מנוטר עכשיו · עודכן לפני רגע</div>
            </div>
          </div>
        </div>
      </header>

      {/* INSIDE — floating dashboard collage */}
      <section className="pkl-sec alt" id="inside">
        <div className="pkl-wrap">
          <div className="center-head rv">
            <span className="eyebrow">שקיפות מלאה</span>
            <h2 className="big-h">ככה זה נראה מבפנים.</h2>
            <p className="muted">עמוד ״השירות שלך״ מרכז את כל מה שחשוב על האתר, מתעדכן אוטומטית וזמין לך בכל רגע.</p>
          </div>

          {/* No .rv here: React recomputes this className when clusterOn flips,
              which would wipe the observer-added .in. The .on class doubles as
              the entrance animation instead. */}
          <div className={"cluster" + (clusterOn ? " on" : "")} ref={clusterRef}>
            {/* monthly report */}
            <div className="fc lit fc-report" data-depth="26" style={{ ["--lit" as never]: "rgba(119,190,207,.55)" }}>
              <div className="fc-head"><span className="fc-title">דו״ח חודשי, יולי</span><span className="pill-cy">Studio Pro</span></div>
              <div className="rg">
                <div className="c"><span className="k">עדכונים</span><span className="v">12</span></div>
                <div className="c"><span className="k">גיבויים</span><span className="v">30</span></div>
                <div className="c"><span className="k">מהירות ממוצעת</span><span className="v" style={{ color: G }}>94</span></div>
                <div className="c"><span className="k">שעות שנוצלו</span><span className="v">2.4 / 3</span></div>
              </div>
            </div>

            {/* main dashboard */}
            <div className="fc fc-main" data-depth="6">
              <div className="fc-head">
                <span className="dom">insights.origuystudio.com</span>
                <span className="fc-tags"><span className="tagd">נתוני דוגמה</span><span className="live"><b />פעיל</span></span>
              </div>
              <div className="ringrow">
                <Ring value={clusterOn ? 98 : 0} />
                <div>
                  <div className="rk">ציון בריאות האתר</div>
                  <div className="rvv">מצוין, יציב 30 יום</div>
                </div>
              </div>
              <div className="metrics">
                <div className="mm"><div className="k">מהירות</div><div className="v" style={{ color: G }}><Counter value={clusterOn ? 96 : 0} places={[10, 1]} fontSize={22} textColor={G} fontWeight="900" gap={1} gradientHeight={0} /></div></div>
                <div className="mm"><div className="k">זמינות</div><div className="v" style={{ color: CY }}><Counter value={clusterOn ? 99.98 : 0} places={[10, 1, ".", 0.1, 0.01]} fontSize={22} textColor={CY} fontWeight="900" gap={1} gradientHeight={0} /><em>%</em></div></div>
                <div className="mm"><div className="k">מבקרים</div><div className="v"><Counter value={clusterOn ? 1240 : 0} places={[1000, 100, 10, 1]} fontSize={22} textColor="#f3f2ee" fontWeight="900" gap={1} gradientHeight={0} /></div></div>
              </div>
              <div className="chartbox">
                <svg viewBox="0 0 400 96" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                  <defs>
                    <linearGradient id="clArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={CY} stopOpacity=".32" />
                      <stop offset="1" stopColor={CY} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M0,74 C40,58 70,66 110,46 S180,22 220,34 300,14 340,22 400,12 400,12 L400,96 L0,96 Z" fill="url(#clArea)" />
                  <path d="M0,74 C40,58 70,66 110,46 S180,22 220,34 300,14 340,22 400,12 400,12" fill="none" stroke={CY} strokeWidth={2.2} />
                  <circle cx="400" cy="12" r="3.5" fill={CY} />
                </svg>
              </div>
            </div>

            {/* uptime timeline */}
            <div className="fc lit fc-uptime" data-depth="-18">
              <div className="fc-head"><span className="fc-title">זמינות, 30 יום</span><span className="upv">99.98%</span></div>
              <div className="bars" aria-hidden="true">
                {Array.from({ length: UPTIME_BARS }, (_, i) => (
                  <i key={i} style={{ transitionDelay: `${i * 18}ms` }} />
                ))}
              </div>
              <div className="upcap">כל פס = יום אחד בלי תקלות</div>
            </div>

            {/* threats blocked */}
            <div className="fc fc-threats" data-depth="20">
              <span className="th-ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
              </span>
              <div className="th-n"><Counter value={clusterOn ? 312 : 0} places={[100, 10, 1]} fontSize={30} textColor="#f3f2ee" fontWeight="900" gap={1} gradientHeight={0} /></div>
              <div className="th-k">איומים נחסמו החודש</div>
            </div>

            {/* last-updated chip */}
            <div className="fc fc-updated" data-depth="-26"><b className="dot" aria-hidden="true" />עודכן לאחרונה · היום, 09:24</div>
          </div>

          <ul className="inside-feats rv">
            <li><span className="ck"><Check s={12} /></span>ציון בריאות חי שמתעדכן לבד</li>
            <li><span className="ck"><Check s={12} /></span>מגמות מהירות וזמינות לאורך זמן</li>
            <li><span className="ck"><Check s={12} /></span>תעבורה אמיתית ישירות מ-Cloudflare</li>
            <li><span className="ck"><Check s={12} /></span>חותמת ״עודכן לאחרונה״ על כל נתון</li>
          </ul>
        </div>
      </section>

      {/* WHY — alert-state dashboard cards */}
      <section className="pkl-sec" id="why">
        <div className="pkl-wrap">
          <div className="sec-lbl rv">
            <h2 className="big-h" style={{ maxWidth: "14ch" }}>רוב האתרים לא נופלים ביום אחד. הם נשחקים בשקט.</h2>
            <span className="fc-tags"><span className="eyebrow">מה קורה בלי טיפול</span><span className="tagd">תרחיש לדוגמה</span></span>
          </div>
          <div className="idx">
            {WHY.map((w) => (
              <div className="row surf alert rv" key={w.n}>
                <div className="whead">
                  <span className="alertchip"><b aria-hidden="true" />{w.alert}</span>
                  <span className="tagd">{w.tag}</span>
                </div>
                <div className="wviz" aria-hidden="true">
                  {w.viz === "shield" && (
                    <svg viewBox="0 0 200 64" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: 64 }}>
                      <path d="M100,6 L124,15 V33 C124,48 114,57 100,61 C86,57 76,48 76,33 V15 Z" fill="none" stroke="#f22c61" strokeOpacity=".8" strokeWidth="2.2" />
                      <path d="M100,14 L96,30 L104,32 L98,50" fill="none" stroke="#f22c61" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="132" cy="14" r="9" fill="rgba(242,44,97,.15)" stroke="#f22c61" strokeWidth="1.6" />
                      <path d="M132 9.5v5.5M132 18.4v.1" stroke="#f22c61" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  )}
                  {w.viz === "downtime" && (
                    <div className="downbars">
                      {Array.from({ length: 22 }, (_, i) => (
                        <i key={i} className={i >= 9 && i <= 12 ? "bad" : ""} />
                      ))}
                    </div>
                  )}
                  {w.viz === "decline" && (
                    <svg viewBox="0 0 200 64" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: 64 }}>
                      <path d="M14,16 C40,18 56,22 78,28 S122,42 148,49 182,55 190,57" fill="none" stroke="#f22c61" strokeOpacity=".85" strokeWidth="2.4" />
                      <circle cx="188" cy="56" r="4" fill="#f22c61" />
                      <text x="14" y="10" fontFamily="Kaha" fontWeight="900" fontSize="12" fill="#9a98a6">96</text>
                      <text x="168" y="42" fontFamily="Kaha" fontWeight="900" fontSize="12" fill="#f22c61">71</text>
                    </svg>
                  )}
                </div>
                <h3>{w.h}</h3>
                <p>{w.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES — interactive tabs (features-9 pattern) */}
      <section className="pkl-sec glow glow-c">
        <div className="pkl-wrap">
          <div className="sec-lbl rv"><h2 className="big-h">מה רץ ברקע, בלי שתרגיש.</h2><span className="eyebrow">השירותים</span></div>

          <div className="svctabs rv" role="tablist" aria-label="השירותים">
            {SVC_TABS.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={svcTab === s.id}
                className={"svctab" + (svcTab === s.id ? " on" : "")} onClick={() => setSvcTab(s.id)}>
                <span className="ti" aria-hidden="true"><SvcIcon id={s.id} /></span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={svcTab} className="svcpanel surf"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
              <div className="svcviz" aria-hidden="true">
                {svcTab === "speed" && (
                  <svg width="150" height="86" viewBox="0 0 120 66"><path d="M12,58 A48,48 0 0,1 108,58" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="9" strokeLinecap="round" /><path className="gauge-arc" d="M12,58 A48,48 0 0,1 108,58" fill="none" stroke="#b4d670" strokeWidth="9" strokeLinecap="round" /></svg>
                )}
                {svcTab === "uptime" && (
                  <svg width="170" height="86" viewBox="0 0 130 66"><polyline className="heart" points="4,40 30,40 40,16 52,56 62,40 84,40 94,26 104,52 112,40 126,40" fill="none" stroke="#77becf" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
                {svcTab === "security" && (
                  <svg width="86" height="100" viewBox="0 0 60 72"><path d="M30,4 L54,14 V36 C54,52 44,62 30,68 C16,62 6,52 6,36 V14 Z" fill="none" stroke="#b4d670" strokeWidth="2.4" /><line className="scan" x1="12" y1="36" x2="48" y2="36" stroke="#b4d670" strokeWidth="2.2" /></svg>
                )}
                {svcTab === "backup" && (
                  <svg width="94" height="94" viewBox="0 0 60 60"><g className="spin"><path d="M11,30 a19,19 0 0 1 32,-14" fill="none" stroke="#77becf" strokeWidth="3" strokeLinecap="round" /><path d="M43,10 v7 h-7" fill="none" stroke="#77becf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><path d="M49,30 a19,19 0 0 1 -32,14" fill="none" stroke="#77becf" strokeWidth="3" strokeLinecap="round" /><path d="M17,50 v-7 h7" fill="none" stroke="#77becf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></g></svg>
                )}
              </div>
              <div className="svcbody">
                <h3>{gt(SVC_TABS.find((s) => s.id === svcTab)!.title)}</h3>
                <div className="svcblocks">
                  {SVC_TABS.find((s) => s.id === svcTab)!.blocks.map((b) => (
                    <div key={b.t} className="svcblock">
                      <span className="ck"><Check s={12} /></span>
                      <div><h4>{b.t}</h4><p>{gt(b.d)}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* HOW — timeline */}
      <section className="pkl-sec alt glow glow-p">
        <div className="pkl-wrap">
          <div className="sec-lbl rv"><h2 className="big-h">איך זה עובד.</h2><span className="eyebrow">מהבחירה לדשבורד</span></div>
          <div className="tl" ref={tlRef}>
            <div className="tl-line"><div className="tl-fill" style={{ transform: `scaleY(${tlFill})` }} /></div>
            <div className="tl-list">
              {STEPS.map((s, i) => (
                <div className={"tl-item" + (i <= tlActive ? " active" : "") + (i === tlActive ? " current" : "")} key={i}>
                  <div className="tl-marker">{i + 1}</div>
                  <div className="tl-content"><h4>{s.h}</h4><p>{gt(s.p)}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      <section className="pkl-sec glow glow-g" id="packages">
        <div className="pkl-wrap">
          <div className="center-head rv">
            <span className="eyebrow">החבילות</span>
            <h2 className="big-h">שלוש רמות ליווי.</h2>
            <p className="muted">כל החבילות כוללות אחסון, גיבויים, ניטור ודו״ח חודשי. ככל שעולים, זמן התגובה מתקצר ונכנסות שעות עבודה. מחיר חודשי, ללא התחייבות.</p>
          </div>
          {showTypeToggle && (
            <div className="typetoggle rv" role="group" aria-label="סוג האתר">
              <button type="button" aria-pressed={siteType === "wordpress"}
                className={siteType === "wordpress" ? "on" : ""} onClick={() => setSiteType("wordpress")}>אתר WordPress</button>
              <button type="button" aria-pressed={siteType === "custom"}
                className={siteType === "custom" ? "on" : ""} onClick={() => setSiteType("custom")}>אתר מותאם (קוד)</button>
            </div>
          )}
          <div className="tiers">
            {tiers.map((t) => (
              <div className={"tcard surf rv" + (t.hot ? " hot" : "")} key={t.id}>
                {t.hot && <span className="badge">הכי פופולרי</span>}
                <div className="tn">{t.fullName}</div>
                <div className="tessence">{t.label}</div>
                <div className="tsub">{gt(t.tagline)}</div>
                <div className="tp"><span className="num">₪{t.price.toLocaleString("he-IL")}</span><small>/ לחודש</small></div>
                <div className="tresp"><Bolt /> תגובה עד {t.resp} שעות</div>
                <ul>
                  {t.feats.map((f) => (
                    <li key={f}><span className="ck"><Check s={12} /></span>{f}</li>
                  ))}
                </ul>
                <button type="button" className={"tbtn" + (t.hot ? " hot" : "")} onClick={() => { setTier(t.id); document.getElementById("choose")?.scrollIntoView({ behavior: "smooth" }); }}>בחירת {t.name}</button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pkl-sec alt" id="faq">
        <div className="pkl-wrap">
          <div className="sec-lbl rv"><h2 className="big-h">שאלות נפוצות.</h2><span className="eyebrow">האותיות הקטנות</span></div>
          <div className="faq">
            {FAQ.map((f, i) => <Faq key={i} q={f.q} a={f.a} gt={gt} />)}
          </div>
        </div>
      </section>

      {/* CHOOSE & SIGN */}
      <section className="pkl-sec glow glow-g" id="choose">
        <div className="pkl-wrap" style={{ maxWidth: 880 }}>
          <div className="sec-lbl rv"><h2 className="big-h">בחירה ואישור.</h2><span className="eyebrow">בלי תשלום בשלב הזה</span></div>
          {ctx === undefined ? (
            <div className="signcard surf" style={{ textAlign: "center", color: "var(--muted)" }}>טוען את הפרטים…</div>
          ) : sent ? (
            <div className="ok signcard surf">
              <span className="okic"><Check s={30} /></span>
              <h2 style={{ fontSize: 40 }}>הבחירה נשלחה.</h2>
              <p className="muted" style={{ marginTop: 12 }}>קיבלתי את האישור על חבילת {current.name} ואחזור אליך בהקדם לתיאום. לא בוצע חיוב.</p>
            </div>
          ) : (
            <form className="signcard surf rv" onSubmit={submit}>
              <div className="chips" role="group" aria-label="בחירת חבילה">
                {tiers.map((t) => (
                  <button type="button" key={t.id} aria-pressed={tier === t.id}
                    className={"chip" + (tier === t.id ? " sel" : "")} onClick={() => setTier(t.id)}>
                    <span className="cn">{t.name}</span>
                    <span className="cp">₪{t.price.toLocaleString("he-IL")} / חודש</span>
                  </button>
                ))}
              </div>
              <div className="billing" role="group" aria-label="מחזור חיוב">
                <button type="button" aria-pressed={billing === "monthly"}
                  className={"bl" + (billing === "monthly" ? " on" : "")} onClick={() => setBilling("monthly")}>
                  <span className="bl-t">חיוב חודשי</span>
                  <span className="bl-p">₪{current.price.toLocaleString("he-IL")}<em> / חודש</em></span>
                </button>
                <button type="button" aria-pressed={billing === "annual"}
                  className={"bl" + (billing === "annual" ? " on" : "")} onClick={() => setBilling("annual")}>
                  <span className="bl-t">חיוב שנתי <span className="save">{ANNUAL_DISCOUNT_PCT}% הנחה</span></span>
                  <span className="bl-p">₪{annualTotal(current.price).toLocaleString("he-IL")}<em> / שנה</em></span>
                  <span className="bl-sub">שווה ל-₪{annualMonthly(current.price).toLocaleString("he-IL")} לחודש</span>
                </button>
              </div>
              {prefilled && (
                <p className="prefill-note"><Check s={13} /> {g("מילאתי מראש את הפרטים שיש לי, אפשר לעדכן כל שדה.", "מילאתי מראש את הפרטים שיש לי, אפשר לעדכן כל שדה.")}</p>
              )}
              <div className="sgrid">
                <Field label="שם מלא" id="f-name"><input id="f-name" name="full_name" placeholder="ישראל ישראלי" defaultValue={greetName} required /></Field>
                <Field label="שם העסק" id="f-biz"><input id="f-biz" name="business" placeholder="העסק שלי בע״מ" defaultValue={fill("business")} required /></Field>
                <Field label="אימייל" id="f-email"><input id="f-email" name="email" type="email" placeholder="you@business.co.il" defaultValue={fill("email")} required /></Field>
                <Field label="טלפון" id="f-phone"><input id="f-phone" name="phone" placeholder="050-0000000" defaultValue={fill("phone")} required /></Field>
              </div>
              {/* Site type is pre-determined (Ori knows the client's site), so it
                  is shown read-only here, not chosen. The hidden input carries it
                  into the eventual submission payload. */}
              <input type="hidden" name="site_type" value={siteType} />
              <div className="typenote">
                סוג האתר: <b>{siteType === "wordpress" ? "אתר WordPress" : "אתר מותאם אישית (קוד)"}</b>
                {showTypeToggle && <span> · אפשר להחליף למעלה באזור החבילות</span>}
              </div>
              {/* Legal blocks render from the versioned TERMS_BLOCKS source, the
                  same text frozen into the saved agreement, so page == record. */}
              <div className="legal">
                {TERMS_BLOCKS.map((b, i) => (
                  <Legal key={b.title} title={b.title} open={i === 0}>
                    <ul>
                      {b.items.map((it) => {
                        const idx = it.indexOf(": ");
                        return idx > 0
                          ? <li key={it}><b>{it.slice(0, idx + 1)}</b>{it.slice(idx + 1)}</li>
                          : <li key={it}>{it}</li>;
                      })}
                    </ul>
                  </Legal>
                ))}
                <Legal title="אישור שימוש בחבילת תחזוקה">{usageApproval(current.fullName, gender)}</Legal>
              </div>
              <label className="consent"><input type="checkbox" required /> {consentText(gender)}</label>
              <div className="f full sigfield"><SignaturePad onChange={setSigImage} /></div>
              {submitErr && <p className="disc" style={{ color: "#ff7ea3" }}>{submitErr}</p>}
              <ClickSpark sparkColor={G} sparkCount={10} sparkRadius={18} duration={500}>
                <button type="submit" className="submit" disabled={submitting}>
                  {submitting ? "שולח…" : `${g("אני מאשר ובוחר", "אני מאשרת ובוחרת")} את ${current.name}`}
                </button>
              </ClickSpark>
              <p className="disc">הטקסט המשפטי הוא טיוטה שתעבור אצל עו״ד לפני פרסום.</p>
            </form>
          )}
        </div>
      </section>

      <footer className="pkl-footer"><div className="pkl-wrap footer-in">
        <div className="wm">Studio Ori Guy</div>
        <div className="foot-links"><Link to="/terms">תקנון</Link><Link to="/privacy">מדיניות פרטיות</Link></div>
        <div>© {new Date().getFullYear()} · ליווי, תחזוקה ופיתוח לאתרים</div>
      </div></footer>
    </div>
  );
}

/* ---------- small helpers ---------- */
/* Personal welcome popup, shown once after the intro loader for a named link.
   Dismiss via the button, the X, a backdrop click, or Escape. */
function GreetPopup({ name, gender, onClose }: { name: string; gender: Gender; onClose: () => void }) {
  const g = (m: string, f: string) => (gender === "female" ? f : m);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <motion.div className="greet-backdrop" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <motion.div className="greet-card surf" role="dialog" aria-modal="true" aria-label="ברכה אישית"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 26, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }} transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}>
        <button type="button" className="greet-x" onClick={onClose} aria-label="סגירה">×</button>
        <span className="greet-badge"><b className="dot" aria-hidden="true" />Studio Ori Guy</span>
        <h2 className="greet-h">היי {name},</h2>
        <p className="greet-p">הכנתי לך את הדף הזה במיוחד. ריכזתי כאן את כל מה שחשוב על תחזוקה, אבטחה וליווי לאתר שלך, ואיך אני שומר עליו בשבילך.</p>
        <button type="button" className="greet-cta" onClick={onClose}>{g("יאללה, בוא נתחיל", "יאללה, בואי נתחיל")}</button>
      </motion.div>
    </motion.div>
  );
}
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="s"><div className="n">{children}</div><div className="k">{label}</div></div>;
}
function Field({ label, id, full, children }: { label: string; id: string; full?: boolean; children: React.ReactNode }) {
  return <div className={"f" + (full ? " full" : "")}><label htmlFor={id}>{label}</label>{children}</div>;
}
function Check({ s = 15 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
  );
}
function Bolt() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 14H11l-1.5 8L18 10h-6.5L13 2z" /></svg>
  );
}
function SvcIcon({ id }: { id: string }) {
  const p = {
    speed: <path d="M5 17a8 8 0 1114 0M12 17l3.5-4.5" />,
    uptime: <path d="M3 12h4l2.5-6 4 12 2.5-6h5" />,
    security: <path d="M12 3l7 3v5c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z" />,
    backup: <><path d="M4 12a8 8 0 0113.7-5.6L20 8" /><path d="M20 4v4h-4" /><path d="M20 12a8 8 0 01-13.7 5.6L4 16" /><path d="M4 20v-4h4" /></>,
  }[id];
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
  );
}
/* Card accordion: question card with a + toggle that expands inline. Height is
   measured so the reveal is smooth everywhere. No .rv (the open/close re-render
   would wipe the observer-added .in). */
function Faq({ q, a, gt }: { q: string; a: string; gt: (s: string) => string }) {
  const [open, setOpen] = useState(false);
  const inner = useRef<HTMLDivElement>(null);
  return (
    <div className={"q surf" + (open ? " open" : "")}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {q}<span className="chev" aria-hidden="true">+</span>
      </button>
      <div className="a" style={{ maxHeight: open ? (inner.current?.scrollHeight ?? 400) : 0 }}>
        <div ref={inner}><p>{gt(a)}</p></div>
      </div>
    </div>
  );
}
function Legal({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open}>
      <summary>{title}<span className="plus" aria-hidden="true">+</span></summary>
      <div className="lbody">{children}</div>
    </details>
  );
}
function Ring({ value }: { value: number }) {
  const C = 2 * Math.PI * 42;
  return (
    <svg width={86} height={86} viewBox="0 0 100 100" style={{ flex: "none" }} role="img" aria-label={`ציון בריאות ${Math.round(value)}`}>
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="#b4d670" strokeWidth="7" strokeLinecap="round"
        transform="rotate(-90 50 50)" strokeDasharray={C} strokeDashoffset={C * (1 - value / 100)}
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)" }} />
      <text x="50" y="49" textAnchor="middle" fontFamily="Kaha" fontWeight="900" fontSize="26" fill="#f3f2ee">{Math.round(value)}</text>
      <text x="50" y="64" textAnchor="middle" fontSize="8" fill="#9a98a6">בריאות</text>
    </svg>
  );
}

const CSS = `
.pkl{--bg:#0a0a0e;--bg2:#0e0d16;--card:#141320;--ink:#f3f2ee;--muted:#9a98a6;--faint:#75737e;--line:rgba(243,242,238,.14);--line-s:rgba(243,242,238,.07);--green:#b4d670;--cyan:#77becf;--ink-on-green:#0a0a0c;background:var(--bg);color:var(--ink);font-family:"Diplomat",system-ui,sans-serif;min-height:100vh;position:relative;line-height:1.62}
.pkl::after{content:"";position:fixed;inset:0;z-index:90;pointer-events:none;opacity:.04;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.pkl h1,.pkl h2,.pkl h3,.pkl h4{font-family:"Kaha","Diplomat",sans-serif;font-weight:900;line-height:.92;letter-spacing:-.02em;margin:0;text-wrap:balance}
.pkl a{color:inherit;text-decoration:none}
.pkl a:focus-visible,.pkl button:focus-visible,.pkl input:focus-visible,.pkl select:focus-visible,.pkl summary:focus-visible{outline:2px solid var(--green);outline-offset:3px;border-radius:6px}
.pkl ::selection{background:var(--green);color:var(--ink-on-green)}
.pkl ::-moz-selection{background:var(--green);color:var(--ink-on-green)}
/* Latin brand text renders in Diplomat (the sans brand font), never a serif fallback */
.pkl .latin{font-family:"Diplomat",system-ui,sans-serif !important}

/* personal welcome popup (shown after the intro loader for a named link) */
.pkl .greet-backdrop{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:24px;background:rgba(6,5,14,.64);backdrop-filter:blur(7px)}
.pkl .greet-card{position:relative;max-width:440px;width:100%;padding:36px 30px 32px;border-radius:24px;text-align:center}
.pkl .greet-x{position:absolute;top:14px;inset-inline-start:16px;width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--muted);font-size:20px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:color .2s,border-color .2s}
.pkl .greet-x:hover{color:var(--ink);border-color:var(--green)}
.pkl .greet-badge{display:inline-flex;align-items:center;gap:8px;font-family:"Diplomat",system-ui,sans-serif;font-weight:800;font-size:12px;color:var(--muted);border:1px solid var(--line);padding:6px 14px;border-radius:999px}
.pkl .greet-badge .dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pl 2s infinite}
.pkl .greet-h{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:clamp(30px,7vw,40px);margin-top:18px}
.pkl .greet-p{color:var(--muted);font-size:15.5px;margin-top:14px;line-height:1.62;max-width:34ch;margin-inline:auto}
.pkl .greet-cta{margin-top:26px;font-family:"Diplomat",system-ui,sans-serif;font-weight:800;font-size:15px;background:var(--green);color:var(--ink-on-green);border:0;padding:14px 30px;border-radius:999px;cursor:pointer;transition:filter .2s}
.pkl .greet-cta:hover{filter:brightness(1.07)}
@media(prefers-reduced-motion:reduce){.pkl .greet-badge .dot{animation:none}}
.pkl .tcard .tessence{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:15px;color:var(--green);margin-top:6px}
.pkl-wrap{max-width:1300px;margin-inline:auto;padding-inline:40px}
@media(max-width:640px){.pkl-wrap{padding-inline:22px}}
.pkl .muted{color:var(--muted)}
.pkl .eyebrow{font-family:"Diplomat";font-weight:700;letter-spacing:.22em;text-transform:uppercase;font-size:11px;color:var(--green);white-space:nowrap}
.pkl .rv{opacity:0;transform:translateY(22px);transition:opacity .85s cubic-bezier(.16,1,.3,1),transform .85s cubic-bezier(.16,1,.3,1)}
.pkl .rv.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.pkl .rv{opacity:1;transform:none;transition:none}}

/* nav */
.pkl-nav{position:sticky;top:0;z-index:40;background:rgba(10,10,14,.8);backdrop-filter:blur(12px)}
.pkl-nav::after{content:"";position:absolute;inset-inline:0;bottom:0;height:1px;background:linear-gradient(to left,rgba(180,214,112,.5),rgba(119,190,207,.3) 38%,rgba(243,242,238,.08) 72%,transparent)}
.pkl-nav-in{display:flex;align-items:center;justify-content:space-between;height:70px}
.pkl .wm{font-family:"Diplomat",system-ui,sans-serif;font-weight:800;font-size:17px;letter-spacing:-.01em}
.pkl .wm small{font-family:"Diplomat";font-weight:600;color:var(--muted);font-size:12px;margin-inline-start:10px}
.pkl .nav-mid{display:flex;gap:26px;font-size:14px;font-weight:600;color:var(--muted)}
.pkl .nav-mid a:hover{color:var(--ink)}
@media(max-width:900px){.pkl .nav-mid{display:none}}
.pkl .cta-btn{font-family:"Diplomat";font-weight:800;font-size:14px;background:var(--green);color:var(--ink-on-green);padding:10px 20px;border-radius:999px;transition:filter .2s}
.pkl .cta-btn:hover{filter:brightness(1.07)}

/* hero */
.pkl-hero{padding:8vh 0 5vh;min-height:90vh;display:flex;flex-direction:column;justify-content:center;overflow-x:clip;position:relative;isolation:isolate}
.pkl-hero::before{content:"";position:absolute;inset:0;z-index:-2;background:url(/img/hero-bg.png) center right/cover no-repeat;transform:scaleX(-1);opacity:.78;pointer-events:none}
.pkl-hero::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(to left,var(--bg) 24%,rgba(10,10,14,.26) 58%,transparent),linear-gradient(0deg,var(--bg),transparent 40%);pointer-events:none}
.pkl .hero-top{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:14px;margin-bottom:4vh}
.pkl .live{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)}
.pkl .live b{width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block;animation:pl 2s infinite}
@keyframes pl{50%{opacity:.3}}
@media(prefers-reduced-motion:reduce){.pkl .live b{animation:none}}
.pkl .htitle{font-size:clamp(52px,12vw,168px);letter-spacing:-.03em}
.pkl .htitle .l2{display:block;padding-inline-start:12vw}
.pkl .htitle .out{color:transparent;-webkit-text-stroke:1.4px var(--green)}
.pkl .hero-focus{margin-top:3.5vh}
.pkl .focus-word{font-size:2rem !important;line-height:1 !important;font-family:"Kaha" !important}
.pkl .focus-container{gap:.7em !important}
.pkl .hero-foot{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:end;margin-top:5vh}
@media(max-width:820px){.pkl .hero-foot{grid-template-columns:1fr;gap:26px}.pkl .htitle .l2{padding-inline-start:6vw}}
@media(max-width:640px){
  .pkl-hero{padding:5vh 0 7vh;min-height:auto}
  .pkl .hero-top{margin-bottom:7vh}
  .pkl .hero-focus{margin-top:6vh}
  .pkl .hero-foot{margin-top:8vh;gap:34px}
  .pkl .hero-ctas{margin-top:22px}
  .pkl .hero-cards{width:100%}
  .pkl .hcard{width:100%}
}
.pkl .hero-foot p{font-size:clamp(16px,2vw,20px);color:var(--muted);max-width:42ch}
.pkl .hero-ctas{display:flex;gap:12px;margin-top:26px;flex-wrap:wrap}
.pkl .cta-btn.big{font-size:15px;padding:14px 26px}
.pkl .ghost-btn{font-family:"Diplomat";font-weight:800;font-size:15px;padding:14px 24px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--ink);transition:border-color .2s,color .2s}
.pkl .ghost-btn:hover{border-color:var(--green);color:var(--green)}
.pkl .hero-cards{position:relative;justify-self:end;display:flex;flex-direction:column;align-items:flex-end;gap:14px;isolation:isolate}
.pkl .hero-cards::before{content:"";position:absolute;inset:-22% -14%;z-index:-1;background:radial-gradient(60% 70% at 70% 20%,rgba(180,214,112,.2),transparent 70%),radial-gradient(55% 65% at 20% 85%,rgba(119,190,207,.14),transparent 70%);filter:blur(40px);pointer-events:none}
@media(max-width:820px){.pkl .hero-cards{justify-self:start;align-items:flex-start}}
.pkl .hcard{padding:18px 20px;transform:rotate(-1.5deg);animation:hf1 8s ease-in-out infinite alternate}
.pkl .hchip{display:inline-flex;align-items:center;gap:9px;padding:11px 17px;border-radius:999px;font-size:12.5px;color:var(--muted);white-space:nowrap;transform:rotate(2deg);animation:hf2 7s .6s ease-in-out infinite alternate;align-self:center}
.pkl .hchip .dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pl 2s infinite}
@keyframes hf1{to{transform:rotate(-1.5deg) translateY(-9px)}}
@keyframes hf2{to{transform:rotate(2deg) translateY(-7px)}}
@media(prefers-reduced-motion:reduce){.pkl .hcard,.pkl .hchip,.pkl .hchip .dot{animation:none}}
.pkl .status{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-end}
.pkl .status .s .n{display:flex;align-items:center;direction:ltr;height:40px}
.pkl .status .s .n em{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:22px;font-style:normal;color:var(--ink)}
.pkl .status .s .k{font-size:11px;color:var(--faint);margin-top:4px}

/* shared card surface — the one visual language for every panel on the page.
   Purple undertone from the brand's dark family, so cards read warm, not gray. */
.pkl .surf{background:linear-gradient(180deg,#181725,#100f17);border:1px solid var(--line);border-radius:20px;box-shadow:0 30px 70px rgba(5,4,14,.5)}

/* ambient color washes — Aurora-family light behind key sections */
.pkl-sec>.pkl-wrap{position:relative;z-index:1}
.pkl .glow::before{content:"";position:absolute;top:-4%;left:50%;transform:translateX(-50%);width:min(920px,92%);height:56%;pointer-events:none;filter:blur(72px);z-index:0}
.pkl .glow-g::before{background:radial-gradient(closest-side,rgba(180,214,112,.1),transparent 72%)}
.pkl .glow-c::before{background:radial-gradient(closest-side,rgba(119,190,207,.11),transparent 72%)}
.pkl .glow-p::before{background:radial-gradient(closest-side,rgba(84,62,224,.16),transparent 72%)}

/* lit top edge — a thin light line on the hero and cluster data cards */
.pkl .lit{position:relative}
.pkl .lit::before{content:"";position:absolute;top:0;inset-inline:18px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,var(--lit,rgba(180,214,112,.55)),transparent)}

/* sections */
.pkl-sec{padding:12vh 0;position:relative}
.pkl-sec.alt{background:var(--bg2)}
.pkl .sec-lbl{display:flex;justify-content:space-between;align-items:baseline;gap:20px;padding-bottom:22px;margin-bottom:50px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.pkl .big-h{font-size:clamp(32px,6vw,72px)}
.pkl .center-head{text-align:center;max-width:62ch;margin-inline:auto;margin-bottom:48px}
.pkl .center-head .eyebrow{justify-content:center}
.pkl .center-head h2{margin-top:14px}
.pkl .center-head p{margin-top:14px;font-size:17px}

/* floating dashboard cluster */
.pkl .cluster{position:relative;height:640px;margin-top:10px;opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.16,1,.3,1),transform .9s cubic-bezier(.16,1,.3,1)}
.pkl .cluster.on{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.pkl .cluster{opacity:1;transform:none;transition:none}}
.pkl .cluster::before{content:"";position:absolute;inset:6% 14%;background:radial-gradient(55% 60% at 62% 34%,rgba(180,214,112,.16),transparent 70%),radial-gradient(50% 55% at 24% 74%,rgba(119,190,207,.12),transparent 70%),radial-gradient(45% 50% at 82% 82%,rgba(84,62,224,.12),transparent 72%);filter:blur(52px);pointer-events:none}
.pkl .fc{position:absolute;background:linear-gradient(180deg,#181725,#100f17);border:1px solid var(--line);border-radius:18px;box-shadow:0 44px 90px rgba(5,4,14,.6);padding:20px;transform:translateY(var(--py,0)) rotate(var(--rot,0deg));will-change:transform}
.pkl .fc-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-bottom:13px;margin-bottom:14px;border-bottom:1px solid var(--line-s);font-size:12.5px;color:var(--muted)}
.pkl .fc-title{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:15px;color:var(--ink)}
.pkl .fc-tags{display:flex;gap:8px;align-items:center}
.pkl .tagd{font-size:10.5px;color:var(--faint);border:1px solid var(--line);padding:3px 9px;border-radius:999px;white-space:nowrap}
.pkl .pill-cy{font-size:11px;font-weight:800;color:var(--cyan);background:rgba(119,190,207,.12);border:1px solid rgba(119,190,207,.3);padding:4px 10px;border-radius:999px;white-space:nowrap}
.pkl .fc-main{--rot:0deg;width:min(440px,94%);inset-inline:0;margin-inline:auto;top:56px;z-index:2}
.pkl .fc-main .dom{font-weight:700}
.pkl .ringrow{display:flex;align-items:center;gap:18px;margin-bottom:16px}
.pkl .rk{font-size:13px;color:var(--muted)}
.pkl .rvv{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:15px;margin-top:4px;color:var(--ink)}
.pkl .metrics{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line-s);border-radius:12px;overflow:hidden}
.pkl .metrics .mm{padding:12px 14px;border-inline-start:1px solid var(--line-s)}
.pkl .metrics .mm:first-child{border-inline-start:0}
.pkl .metrics .mm .k{font-size:11px;color:var(--muted)}
.pkl .metrics .mm .v{margin-top:4px;display:flex;align-items:baseline}
.pkl .metrics .mm .v em{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:16px;font-style:normal}
.pkl .chartbox{height:88px;margin-top:12px;border:1px solid var(--line-s);border-radius:12px;overflow:hidden}
.pkl .fc-report{--rot:-3deg;width:300px;top:6px;inset-inline-start:2%;z-index:1}
.pkl .rg{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pkl .rg .c{background:rgba(255,255,255,.03);border:1px solid var(--line-s);border-radius:11px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.pkl .rg .c .k{font-size:10.5px;color:var(--muted)}
.pkl .rg .c .v{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:19px;color:var(--ink)}
.pkl .fc-uptime{--rot:2.5deg;width:300px;top:72px;inset-inline-end:1.5%;z-index:1}
.pkl .upv{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:17px;color:var(--green)}
.pkl .bars{display:flex;gap:3px}
.pkl .bars i{flex:1;height:26px;border-radius:3px;background:var(--green);opacity:.85;transform:scaleY(.12);transform-origin:bottom;transition:transform .5s cubic-bezier(.16,1,.3,1)}
.pkl .cluster.on .bars i{transform:scaleY(1)}
.pkl .bars i:last-child{animation:pl 2s infinite}
.pkl .upcap{font-size:11px;color:var(--faint);margin-top:10px}
.pkl .fc-threats{--rot:-2deg;width:236px;bottom:38px;inset-inline-end:9%;z-index:3;display:flex;flex-direction:column;gap:8px}
.pkl .th-ic{width:42px;height:42px;border-radius:12px;background:rgba(180,214,112,.12);border:1px solid rgba(180,214,112,.28);color:var(--green);display:grid;place-items:center}
.pkl .th-n{direction:ltr;display:flex;justify-content:flex-end}
.pkl .th-k{font-size:12.5px;color:var(--muted)}
.pkl .fc-updated{--rot:2deg;bottom:96px;inset-inline-start:7%;z-index:3;display:inline-flex;align-items:center;gap:9px;padding:12px 18px;border-radius:999px;font-size:13px;color:var(--muted);white-space:nowrap}
.pkl .fc-updated .dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pl 2s infinite}
@media(prefers-reduced-motion:reduce){.pkl .fc-updated .dot,.pkl .bars i:last-child{animation:none}.pkl .bars i{transform:scaleY(1);transition:none}}
@media(max-width:940px){
  .pkl .cluster{height:auto;display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:none}
  .pkl .cluster .fc{position:static;width:100% !important;margin:0 !important;transform:none !important;--rot:0deg}
  .pkl .fc-main{order:-1;grid-column:1/-1}
  .pkl .fc-report{grid-column:1/-1}
  .pkl .fc-uptime{grid-column:1/-1}
  .pkl .fc-updated{justify-content:center;border-radius:18px;align-self:stretch;height:auto;white-space:normal;text-align:center}
}
.pkl .inside-feats{list-style:none;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:0;margin:40px 0 0}
@media(max-width:900px){.pkl .inside-feats{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.pkl .inside-feats{grid-template-columns:1fr}}
.pkl .inside-feats li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;color:var(--muted)}
.pkl .ck{width:20px;height:20px;border-radius:7px;background:rgba(180,214,112,.12);color:var(--green);display:grid;place-items:center;flex:none;margin-top:2px}

/* why — alert-state dashboard cards (the "without care" story, in red) */
.pkl .idx{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
@media(max-width:900px){.pkl .idx{grid-template-columns:1fr}}
.pkl .idx .row{display:flex;flex-direction:column;gap:12px;padding:24px}
.pkl .idx .row.alert{border-color:rgba(242,44,97,.22)}
.pkl .whead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-bottom:13px;border-bottom:1px solid var(--line-s)}
.pkl .alertchip{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;font-weight:800;color:#ff7ea3;background:rgba(242,44,97,.1);border:1px solid rgba(242,44,97,.3);padding:4px 11px;border-radius:999px;white-space:nowrap}
.pkl .alertchip b{width:6px;height:6px;border-radius:50%;background:#f22c61;animation:pl 1.6s infinite}
@media(prefers-reduced-motion:reduce){.pkl .alertchip b{animation:none}}
.pkl .wviz{height:72px;display:flex;align-items:center}
.pkl .downbars{display:flex;gap:3px;width:100%}
.pkl .downbars i{flex:1;height:26px;border-radius:3px;background:var(--green);opacity:.75}
.pkl .downbars i.bad{background:#f22c61;opacity:.9;height:12px;align-self:flex-end}
.pkl .idx h3{font-family:"Diplomat";font-weight:800;font-size:19px}
.pkl .idx p{color:var(--muted);font-size:14.5px}

/* services — interactive tabs */
.pkl .svctabs{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
@media(max-width:640px){.pkl .svctabs{display:flex;overflow-x:auto;padding-bottom:6px}}
.pkl .svctab{display:flex;flex-direction:column;align-items:center;gap:10px;padding:18px 12px;font-family:"Diplomat";font-weight:800;font-size:14.5px;color:var(--muted);background:rgba(255,255,255,.025);border:1px solid var(--line-s);border-radius:16px;cursor:pointer;transition:color .2s,border-color .2s,background .2s;flex:1;min-width:110px}
.pkl .svctab .ti{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.04);border:1px solid var(--line-s);color:var(--faint);transition:inherit}
.pkl .svctab:hover{color:var(--ink)}
.pkl .svctab.on{color:var(--ink);background:linear-gradient(180deg,#16161d,#101015);border-color:rgba(180,214,112,.45)}
.pkl .svctab.on .ti{color:var(--green);background:rgba(180,214,112,.12);border-color:rgba(180,214,112,.3)}
.pkl .svcpanel{display:grid;grid-template-columns:.8fr 1.2fr;gap:30px;align-items:center;padding:clamp(22px,3.4vw,38px)}
@media(max-width:760px){.pkl .svcpanel{grid-template-columns:1fr;gap:22px}}
.pkl .svcviz{min-height:150px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line-s);border-radius:16px;background:radial-gradient(85% 110% at 50% 0%,rgba(119,190,207,.07),rgba(255,255,255,.015) 65%)}
.pkl .svcbody h3{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:clamp(24px,3vw,34px)}
.pkl .svcblocks{display:flex;flex-direction:column;gap:16px;margin-top:18px}
.pkl .svcblock{display:flex;gap:12px;align-items:flex-start}
.pkl .svcblock h4{font-family:"Diplomat";font-weight:800;font-size:15.5px}
.pkl .svcblock p{color:var(--muted);font-size:14px;margin-top:3px;max-width:52ch}
.pkl .gauge-arc{stroke-dasharray:151;stroke-dashoffset:151;animation:pklGauge 2.6s cubic-bezier(.16,1,.3,1) infinite alternate}
@keyframes pklGauge{to{stroke-dashoffset:45}}
.pkl .heart{stroke-dasharray:320;stroke-dashoffset:320;animation:pklDash 2.6s linear infinite}
@keyframes pklDash{to{stroke-dashoffset:0}}
.pkl .scan{animation:pklScan 2.8s ease-in-out infinite}
@keyframes pklScan{0%,100%{transform:translateY(-15px);opacity:0}18%,82%{opacity:.9}50%{transform:translateY(15px)}}
.pkl .spin{animation:pklSpin 4.5s linear infinite;transform-origin:30px 30px}
@keyframes pklSpin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.pkl .gauge-arc,.pkl .heart,.pkl .scan,.pkl .spin{animation:none}.pkl .gauge-arc{stroke-dashoffset:60}.pkl .heart{stroke-dashoffset:0}}

/* timeline */
.pkl .tl{position:relative;max-width:760px;margin:0 auto}
.pkl .tl-line{position:absolute;top:1.5em;bottom:1.5em;inset-inline-start:1.5em;width:2px;background:var(--line)}
.pkl .tl-fill{position:absolute;inset:0;transform-origin:50% 0;background:var(--green)}
.pkl .tl-list{display:flex;flex-direction:column;gap:5.5em}
.pkl .tl-item{display:flex;gap:2em;align-items:flex-start}
.pkl .tl-marker{flex:none;width:3em;height:3em;border-radius:999px;display:grid;place-items:center;font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:16px;background:linear-gradient(180deg,#181725,#100f17);border:1px solid var(--line);color:var(--muted);box-shadow:0 14px 34px rgba(5,4,14,.45);transition:all .4s cubic-bezier(.645,.045,.355,1);position:relative;z-index:1}
.pkl .tl-item.active .tl-marker{background:var(--green);color:var(--ink-on-green);border-color:var(--green)}
.pkl .tl-item.current .tl-marker{box-shadow:0 0 0 .5em rgba(180,214,112,.16)}
.pkl .tl-content{padding-top:.4em;transition:opacity .3s;opacity:.28}
.pkl .tl-item.active .tl-content{opacity:.5}.pkl .tl-item.current .tl-content{opacity:1}
.pkl .tl-content h4{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:clamp(24px,3.2vw,38px)}
.pkl .tl-content p{color:var(--muted);font-size:15.5px;margin-top:9px;max-width:42ch}
@media(max-width:600px){.pkl .tl-list{gap:4em}.pkl .tl-item{gap:1.4em}}

/* site-type toggle (WordPress vs custom code) — segmented control */
.pkl .typetoggle{display:flex;gap:4px;width:max-content;max-width:100%;margin:-14px auto 36px;padding:4px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid var(--line-s)}
.pkl .typetoggle button{font-family:"Diplomat",system-ui,sans-serif;font-weight:800;font-size:13.5px;color:var(--muted);background:none;border:0;padding:10px 20px;border-radius:999px;cursor:pointer;transition:color .2s,background .2s}
.pkl .typetoggle button:hover{color:var(--ink)}
.pkl .typetoggle button.on{color:var(--ink-on-green);background:var(--green)}
.pkl .typenote{margin-top:18px;font-size:13px;color:var(--muted);text-align:center}
.pkl .typenote b{color:var(--ink);font-weight:800}

/* package cards — one aligned hierarchy, everything starts at the same edge */
.pkl .tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;align-items:stretch}
@media(max-width:900px){.pkl .tiers{grid-template-columns:1fr;max-width:460px;margin-inline:auto}}
.pkl .tcard{border-radius:22px;padding:30px;display:flex;flex-direction:column;align-items:stretch;text-align:start;position:relative;transition:transform .25s,border-color .25s,box-shadow .25s}
.pkl .tcard:hover{transform:translateY(-4px);border-color:rgba(180,214,112,.35)}
.pkl .tcard.hot{border-color:rgba(180,214,112,.5);box-shadow:0 34px 74px rgba(180,214,112,.09);background:linear-gradient(180deg,rgba(180,214,112,.07),var(--card) 46%)}
.pkl .tcard .badge{position:absolute;top:-13px;inset-inline-start:26px;font-size:11px;font-weight:800;color:var(--ink-on-green);background:var(--green);padding:5px 13px;border-radius:999px}
.pkl .tcard .tn{font-family:"Diplomat",system-ui,sans-serif;font-weight:800;font-size:24px;letter-spacing:-.01em}
.pkl .tcard .tsub{color:var(--muted);font-size:13.5px;margin-top:8px;line-height:1.5;min-height:3.9em}
.pkl .tcard .tp{display:flex;align-items:baseline;gap:7px;font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:44px;line-height:1;margin:18px 0 6px}
.pkl .tcard .tp .num{direction:ltr;unicode-bidi:isolate}
.pkl .tcard .tp small{font-family:"Diplomat";font-weight:600;font-size:14px;color:var(--muted)}
.pkl .tcard .tresp{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--cyan);margin-bottom:16px}
.pkl .tcard ul{list-style:none;margin:0 0 22px;padding:18px 0 0;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:12px;flex:1}
.pkl .tcard li{display:flex;gap:10px;font-size:14px;align-items:flex-start}
.pkl .tcard li.h{color:var(--muted);font-weight:700;font-size:12.5px}
.pkl .tcard .tbtn{font-family:"Diplomat";font-weight:800;font-size:15px;padding:14px;border-radius:999px;cursor:pointer;width:100%;border:1px solid var(--line);background:rgba(255,255,255,.04);color:var(--ink);transition:.2s}
.pkl .tcard .tbtn:hover{border-color:var(--green);color:var(--green)}
.pkl .tcard .tbtn.hot{background:var(--green);color:var(--ink-on-green);border-color:var(--green)}
.pkl .tcard .tbtn.hot:hover{color:var(--ink-on-green);filter:brightness(1.07)}

/* faq — question cards */
.pkl .faq{display:flex;flex-direction:column;gap:12px}
.pkl .faq .q{padding:0 24px}
.pkl .faq .q>button{width:100%;text-align:start;background:none;border:0;color:var(--ink);font-family:"Diplomat",system-ui,sans-serif;font-weight:800;font-size:clamp(16px,2vw,19px);padding:22px 0;cursor:pointer;display:flex;justify-content:space-between;gap:16px;align-items:center}
.pkl .faq .chev{color:var(--green);transition:transform .3s;font-size:17px;width:28px;height:28px;display:grid;place-items:center;border:1px solid var(--line);border-radius:50%;flex:none}
.pkl .faq .q.open .chev{color:var(--green);transform:rotate(45deg);background:rgba(180,214,112,.12);border-color:rgba(180,214,112,.4)}
.pkl .faq .a{overflow:hidden;transition:max-height .42s cubic-bezier(.16,1,.3,1)}
.pkl .faq .a p{padding:2px 0 22px;color:var(--muted);font-size:15px;max-width:62ch}

/* sign card */
.pkl .signcard{border-radius:24px;padding:clamp(24px,4vw,42px)}
.pkl .chips{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px}
.pkl .chip{flex:1;min-width:130px;display:flex;flex-direction:column;gap:3px;align-items:center;padding:14px;font-family:inherit;cursor:pointer;border-radius:14px;background:#1c1b28;border:1.5px solid rgba(243,242,238,.25);color:var(--ink);transition:border-color .2s,background .2s}
.pkl .chip:hover{border-color:var(--green)}
.pkl .chip .cn{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:17px}
.pkl .chip .cp{font-size:12.5px;color:var(--muted)}
.pkl .chip.sel{background:var(--green);border-color:var(--green);color:var(--ink-on-green)}
.pkl .chip.sel .cp{color:rgba(10,10,12,.72)}
/* billing cycle (monthly vs annual, 15% off) */
.pkl .billing{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px}
@media(max-width:520px){.pkl .billing{grid-template-columns:1fr}}
.pkl .bl{display:flex;flex-direction:column;gap:5px;align-items:flex-start;text-align:start;padding:14px 16px;border-radius:14px;background:#1c1b28;border:1.5px solid rgba(243,242,238,.2);color:var(--ink);cursor:pointer;font-family:inherit;transition:border-color .2s,background .2s}
.pkl .bl:hover{border-color:var(--green)}
.pkl .bl.on{border-color:var(--green);background:rgba(180,214,112,.1)}
.pkl .bl .bl-t{font-family:"Diplomat",system-ui,sans-serif;font-weight:800;font-size:14px;display:flex;align-items:center;gap:8px}
.pkl .bl .save{font-size:10.5px;font-weight:800;color:var(--ink-on-green);background:var(--green);padding:2px 8px;border-radius:999px}
.pkl .bl .bl-p{font-family:"Kaha","Diplomat",system-ui,sans-serif;font-weight:900;font-size:20px;direction:rtl}
.pkl .bl .bl-p em{font-family:"Diplomat";font-weight:600;font-size:12px;font-style:normal;color:var(--muted)}
.pkl .bl .bl-sub{font-size:11.5px;color:var(--green)}
.pkl .prefill-note{display:flex;align-items:center;gap:8px;margin:0 2px 16px;font-size:13px;color:var(--green)}
.pkl .prefill-note svg{flex:none}
.pkl .sgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:640px){.pkl .sgrid{grid-template-columns:1fr}}
.pkl .f{display:flex;flex-direction:column;gap:7px}
.pkl .f.full{grid-column:1/-1}
.pkl .f label{font-size:12.5px;color:var(--muted);font-weight:700}
.pkl .f input,.pkl .f select{background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:12px;color:var(--ink);font-family:inherit;font-size:16px;padding:13px 15px}
.pkl .f input:focus,.pkl .f select:focus{outline:none;border-color:var(--green)}
.pkl .f input::placeholder{color:var(--faint)}
.pkl form .f.full{margin-top:16px}
.pkl .legal{margin-top:26px;border-top:1px solid var(--line)}
.pkl .legal details{border-bottom:1px solid var(--line-s)}
.pkl .legal summary{cursor:pointer;padding:16px 0;font-weight:800;font-size:15px;display:flex;justify-content:space-between;align-items:center;list-style:none}
.pkl .legal summary::-webkit-details-marker{display:none}
.pkl .legal .plus{color:var(--green);transition:transform .2s;width:24px;height:24px;display:grid;place-items:center;border:1px solid var(--line);border-radius:50%;font-size:15px;flex:none}
.pkl .legal details[open] .plus{transform:rotate(45deg)}
.pkl .legal .lbody{padding:0 0 16px;color:var(--muted);font-size:13.5px;line-height:1.75}
.pkl .legal .lbody ul{margin:4px 0 0;padding-inline-start:18px}
.pkl .legal .lbody b{color:var(--ink)}
.pkl .sigfield{margin-top:16px}
.pkl .sig-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px}
.pkl .sig-head>span{font-size:12.5px;color:var(--muted);font-weight:700}
.pkl .sig-clear{font-family:"Diplomat",system-ui,sans-serif;font-weight:700;font-size:12.5px;color:var(--muted);background:none;border:0;cursor:pointer;transition:color .2s}
.pkl .sig-clear:hover{color:var(--green)}
.pkl .sig-wrap{position:relative;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
.pkl .sig-canvas{display:block;width:100%;height:140px;touch-action:none;cursor:crosshair}
.pkl .sig-hint{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;color:#9a98a6;font-size:14px}
.pkl .consent{display:flex;gap:11px;align-items:flex-start;margin:24px 0 4px;font-size:14px;color:var(--muted)}
.pkl .consent input{width:19px;height:19px;accent-color:var(--green);margin-top:2px;flex:none}
.pkl .submit{font-family:"Diplomat";font-weight:800;font-size:16px;background:var(--green);color:var(--ink-on-green);border:0;padding:17px 28px;border-radius:999px;cursor:pointer;width:100%;margin-top:18px;transition:filter .2s}
.pkl .submit:hover{filter:brightness(1.07)}
.pkl .disc{margin-top:14px;font-size:12px;color:var(--faint);text-align:center}
.pkl .ok{text-align:center}
.pkl .okic{width:64px;height:64px;border-radius:50%;background:rgba(180,214,112,.14);border:1px solid rgba(180,214,112,.4);color:var(--green);display:grid;place-items:center;margin:0 auto 18px}

/* footer */
.pkl-footer{padding:8vh 0 6vh;border-top:0;position:relative}
.pkl-footer::before{content:"";position:absolute;inset-inline:0;top:0;height:1px;background:linear-gradient(to left,transparent,rgba(180,214,112,.45) 30%,rgba(119,190,207,.35) 60%,rgba(84,62,224,.35) 85%,transparent)}
.pkl .footer-in{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:14px}
.pkl .foot-links{display:flex;gap:18px}
.pkl .foot-links a{color:var(--muted);transition:color .2s}
.pkl .foot-links a:hover{color:var(--green)}
`;

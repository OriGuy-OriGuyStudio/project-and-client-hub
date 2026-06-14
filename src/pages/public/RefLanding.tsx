import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Handshake,
  LayoutGrid,
  LifeBuoy,
  MessagesSquare,
  MonitorSmartphone,
  Quote,
  Sparkles,
  Star,
} from "lucide-react";
import { MeshBanner } from "@/components/ui/mesh-banner";
import { AutoScrollShot } from "@/components/ui/auto-scroll-shot";
import { resolveReferral, trackReferralClick, submitReferralLead } from "@/lib/referral";
import { projectTypeHe } from "@/lib/status";
import { celebrate } from "@/lib/confetti";
import type { PartnerProjectType } from "@/types/database";

const WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;
const HERO_COLORS = ["#16151c", "#1d9e75", "#77becf", "#B4D670", "#91be37"];
const TYPES: PartnerProjectType[] = ["business_site", "ecommerce", "system", "other"];

// Portfolio items. Add webm/mp4/poster (files under /public/portfolio/) per item
// when the recordings are ready; until then each shows an animated placeholder.
const PORTFOLIO: {
  title: string;
  subtitle?: string;
  status?: string;
  webm?: string;
  mp4?: string;
  poster?: string;
}[] = [
  { title: "פרויקט ראשון", subtitle: "אתר עסקי", status: "בקרוב" },
  { title: "פרויקט שני", subtitle: "חנות אונליין", status: "בקרוב" },
  { title: "פרויקט שלישי", subtitle: "עולה לאוויר בקרוב", status: "בעבודה" },
];

function waLink() {
  if (!WHATSAPP) return undefined;
  return `https://wa.me/${WHATSAPP.replace(/\D/g, "")}`;
}

/** Public referral landing reached via a partner's link (`/ref/:code`). */
export default function RefLanding() {
  const { code = "" } = useParams();
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const clickId = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Studio Ori Guy · אתרים שגורמים ללקוחות לבחור בך";
    let alive = true;
    resolveReferral(code).then((r) => {
      if (alive && r.valid && r.partner_name) setPartnerName(r.partner_name);
    });
    trackReferralClick(code).then((id) => (clickId.current = id));
    return () => {
      alive = false;
    };
  }, [code]);

  // Reveal sections as they scroll into view.
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".reveal-up");
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  function scrollToForm() {
    document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* ───────── Hero ───────── */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <MeshBanner colors={HERO_COLORS} className="absolute inset-0" />
        <div className="absolute inset-0 bg-background/55" />
        <div className="relative z-10 mx-auto w-full max-w-3xl px-6 py-20 text-center">
          {partnerName && (
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/70 px-4 py-1.5 text-sm text-foreground backdrop-blur">
              <Handshake className="size-4 text-primary" />
              הופנית ע"י <span className="font-semibold text-primary">{partnerName}</span>
            </span>
          )}
          <h1 className="font-heading text-4xl font-black leading-tight text-white sm:text-6xl">
            אני בונה אתרים שגורמים
            <br />
            ללקוחות לבחור בך.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/80">
            אני אורי, סטודיו של איש אחד. לוקח מעט לקוחות בכל פעם, יושב על כל פרט,
            ובונה לך אתר שמרגיש בדיוק כמו העסק שלך, רק יותר טוב. בלי תבניות, בלי
            קיצורי דרך.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-95"
            >
              בוא נדבר <ArrowLeft className="size-4" />
            </button>
            {waLink() && (
              <a
                href={waLink()}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-7 py-3.5 font-medium text-foreground backdrop-blur transition-colors hover:border-primary/50"
              >
                וואטסאפ
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ───────── Why me ───────── */}
      <Section title="למה לעבוד עם סטודיו של איש אחד?">
        <div className="grid gap-5 sm:grid-cols-3">
          <Feature icon={MessagesSquare} title="מדבר איתי ישירות">
            לא נציג, לא מתווך. אתה מסביר מה אתה צריך, ואני בונה.
          </Feature>
          <Feature icon={Sparkles} title="כל אתר נבנה מאפס בשבילך">
            הצבעים, הטיפוגרפיה, האנימציות, הכל מותאם לעסק ולקהל שלך.
          </Feature>
          <Feature icon={CheckCircle2} title="אתה רואה הכל לאורך הדרך">
            בלי לרדוף אחריי, בלי לנחש איפה הדברים עומדים.
          </Feature>
        </div>
      </Section>

      {/* ───────── Orion (the differentiator) ───────── */}
      <section className="reveal-up px-6 py-16">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] to-transparent p-8 sm:p-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-3 py-1 text-xs font-medium text-primary">
            <LayoutGrid className="size-3.5" /> Orion · המערכת שלך
          </span>
          <h2 className="mt-4 font-heading text-2xl font-black text-foreground sm:text-3xl">
            יש לך מערכת משלך. לא וואטסאפ מבולגן ולא מיילים אבודים.
          </h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
            בניתי בעצמי, מאפס, מערכת בשם <span className="font-semibold text-foreground">Orion</span> שמלווה
            אותך מהיום הראשון. בזמן הפרויקט אתה רואה בדיוק באיזה שלב אנחנו, מאשר
            שלבים, רואה קבצים ומדבר איתי, הכל במקום אחד. ואחרי שעולים לאוויר היא
            נשארת איתך: אחריות, תחזוקה, והכל מסודר.
          </p>
          <p className="mt-3 max-w-2xl leading-relaxed text-foreground">
            רוב הסטודיו נותנים לך אתר ונעלמים. אצלי יש לך מקום אחד שתמיד פתוח
            לפניך. את זה לא תמצא אצל אף אחד אחר.
          </p>
        </div>
      </section>

      {/* ───────── Project types ───────── */}
      <Section title="מה אתה צריך?">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TypeCard icon={MonitorSmartphone} title="אתר עסקי / תדמית">
            אתר שמספר מי אתה ולמה כדאי לבחור בך.
          </TypeCard>
          <TypeCard icon={Briefcase} title="חנות אונליין">
            חנות שנעים לקנות בה, מהטלפון ומהמחשב.
          </TypeCard>
          <TypeCard icon={LayoutGrid} title="מערכת / אפליקציה">
            כלי שעובד בדיוק כמו שהעסק שלך עובד.
          </TypeCard>
          <TypeCard icon={Sparkles} title="משהו אחר">
            יש לך רעיון? בוא נשמע אותו.
          </TypeCard>
        </div>
      </Section>

      {/* ───────── Portfolio ─────────
          To wire a real project: drop the recording in /public/portfolio/ and add
          webm/mp4/poster paths below (videos play muted, looping, while in view). */}
      <Section title="כמה דברים שעשיתי לאחרונה">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PORTFOLIO.map((p) => (
            <AutoScrollShot key={p.title} {...p} />
          ))}
        </div>
      </Section>

      {/* ───────── Testimonials (placeholder) ───────── */}
      <Section title="מה לקוחות אומרים">
        <div className="grid gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-6">
              <Quote className="size-6 text-primary/60" />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                המלצה תתווסף כאן בקרוב, ישירות מגוגל.
              </p>
              <div className="mt-4 flex items-center gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="size-4 fill-current" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ───────── Maintenance + Partner program ───────── */}
      <Section title="">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="reveal-up rounded-2xl border border-border bg-card p-7">
            <LifeBuoy className="size-7 text-brand-cyan-base" />
            <h3 className="mt-3 font-heading text-xl font-bold text-foreground">
              העבודה לא נגמרת בהשקה
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              יש חבילות תחזוקה שדואגות שהאתר שלך תמיד מעודכן, מאובטח ועובד, בלי
              שתצטרך לחשוב על זה. אתה לא נשאר לבד אחרי שעולים לאוויר.
            </p>
          </div>
          <div className="reveal-up rounded-2xl border border-border bg-card p-7">
            <Handshake className="size-7 text-primary" />
            <h3 className="mt-3 font-heading text-xl font-bold text-foreground">
              אהבת? אתה יכול גם להרוויח מזה
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              מי שמפנה אליי עסקים מקבל עמלה על כל עסקה שנסגרת. אם יש לך אנשים
              שצריכים אתר, בוא נדבר על זה.
            </p>
          </div>
        </div>
      </Section>

      {/* ───────── Lead form / thank-you ───────── */}
      <section id="lead-form" className="reveal-up px-6 py-20">
        <LeadForm code={code} clickId={clickId} />
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} סטודיו אורי גיא · נבנה עם Orion 🚀
      </footer>
    </div>
  );
}

/* ───────────────────────── building blocks ───────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="reveal-up px-6 py-14">
      <div className="mx-auto max-w-5xl">
        {title && (
          <h2 className="mb-8 text-center font-heading text-2xl font-black text-foreground sm:text-3xl">
            {title}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MessagesSquare;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function TypeCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof MessagesSquare;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <Icon className="size-6 text-brand-cyan-base" />
      <h3 className="mt-3 font-heading text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function LeadForm({
  code,
  clickId,
}: {
  code: string;
  clickId: React.MutableRefObject<string | null>;
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    type: "business_site" as PartnerProjectType,
    message: "",
    company: "", // honeypot
  });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setError(null);
    if (form.company) {
      setDone(true); // honeypot tripped — silently "succeed"
      return;
    }
    if (!form.name.trim() || !form.phone.trim()) {
      setError("צריך שם וטלפון.");
      return;
    }
    setSending(true);
    const r = await submitReferralLead({
      code,
      name: form.name,
      phone: form.phone,
      email: form.email,
      type: form.type,
      message: form.message,
      clickId: clickId.current,
    });
    setSending(false);
    if (!r.ok) {
      setError("משהו השתבש. אפשר לנסות שוב או לכתוב לי בוואטסאפ.");
      return;
    }
    setDone(true);
    celebrate();
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-primary/30 bg-card p-10 text-center">
        <CheckCircle2 className="mx-auto size-12 text-primary" />
        <h2 className="mt-4 font-heading text-2xl font-black text-foreground">
          קיבלתי, תודה{form.name ? ` ${form.name.split(" ")[0]}` : ""}.
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          אני עובר על הפרטים וחוזר אליך בקרוב. אם בא לך להאיץ, אפשר גם בוואטסאפ.
        </p>
        {waLink() && (
          <a
            href={waLink()}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-6 inline-flex rounded-full bg-primary px-7 py-3 font-semibold text-primary-foreground"
          >
            וואטסאפ
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-border bg-card p-8 sm:p-10">
      <h2 className="text-center font-heading text-2xl font-black text-foreground sm:text-3xl">
        בוא נתחיל.
      </h2>
      <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
        תשאיר פרטים ואני חוזר אליך, בדרך כלל באותו יום. בלי התחייבות, רק שיחה.
      </p>

      <div className="mt-6 space-y-3">
        <input
          className="h-11 w-full rounded-xl border border-border bg-field px-4 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="שם מלא *"
          value={form.name}
          maxLength={160}
          onChange={(e) => update("name", e.target.value)}
        />
        <input
          className="h-11 w-full rounded-xl border border-border bg-field px-4 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="טלפון *"
          dir="ltr"
          value={form.phone}
          maxLength={40}
          onChange={(e) => update("phone", e.target.value)}
        />
        <input
          className="h-11 w-full rounded-xl border border-border bg-field px-4 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="מייל (לא חובה)"
          dir="ltr"
          type="email"
          value={form.email}
          maxLength={160}
          onChange={(e) => update("email", e.target.value)}
        />
        <select
          className="h-11 w-full rounded-xl border border-border bg-field px-4 text-sm text-foreground outline-none focus:border-primary/50"
          value={form.type}
          onChange={(e) => update("type", e.target.value as PartnerProjectType)}
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {projectTypeHe[t]}
            </option>
          ))}
        </select>
        <textarea
          className="w-full rounded-xl border border-border bg-field px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
          placeholder="כמה מילים על הפרויקט"
          rows={3}
          value={form.message}
          maxLength={2000}
          onChange={(e) => update("message", e.target.value)}
        />
        {/* honeypot — hidden from humans */}
        <input
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
          value={form.company}
          onChange={(e) => update("company", e.target.value)}
        />
      </div>

      {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

      <button
        onClick={submit}
        disabled={sending}
        className="mt-5 w-full rounded-full bg-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-lift transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
      >
        {sending ? "שולח…" : "שלח, נדבר"}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        הפרטים שלך נשמרים אצלי בלבד.
      </p>
    </div>
  );
}

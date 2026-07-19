import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useSpring,
  animate,
  type MotionValue,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowDown,
  CheckCircle2,
  Handshake,
  LayoutGrid,
  LifeBuoy,
  MessagesSquare,
  Play,
  Quote,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import Aurora from "@/components/ui/aurora";
import SpotlightCard from "@/components/ui/spotlight-card";
import ClickSpark from "@/components/ui/click-spark";
import Magnet from "@/components/ui/magnet";
import FallingEasterEgg from "@/components/ui/falling-easter-egg";
import { WelcomingWords } from "@/components/layout/WelcomingWords";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import { resolveReferral, trackReferralClick, submitReferralLead } from "@/lib/referral";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { verifyTurnstile } from "@/lib/turnstile";
import { projectTypeHe } from "@/lib/status";
import { celebrate } from "@/lib/confetti";
import { isPhone, isEmail } from "@/lib/validation";
import type { PartnerProjectType } from "@/types/database";

gsap.registerPlugin(ScrollTrigger);

const WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;
const TYPES: PartnerProjectType[] = ["business_site", "ecommerce", "system", "other"];

// Brand imagery lives in the public Supabase `portfolio` bucket (cutout PNGs of
// Ori + the Pixel mascot). encodeURI handles the spaces in the file names.
const BUCKET =
  "https://tirasinbjsotcrqggipe.supabase.co/storage/v1/object/public/portfolio";
const IMG = {
  oriPixel: encodeURI(`${BUCKET}/freepik__background__23497 1.png`), // Ori holding Pixel
  oriThink: encodeURI(`${BUCKET}/Ori Think 1.png`),
  oriHero: encodeURI(`${BUCKET}/Ori-Guy-About-Hero 2.png`),
  oriSocial: encodeURI(`${BUCKET}/Social story 1.png`),
};

// Laptop mockup frame (transparent screen). Each project's screen-recording video
// is layered behind it and shows through the screen cut-out.
const MACBOOK = "/macbook-mockup.png";

const PROJECTS: {
  name: string;
  client: string;
  desc: string;
  videos: { src: string; caption?: string }[];
  link?: { href: string; label: string };
  centerMobile?: boolean;
}[] = [
  {
    name: "יולי מסטרמן",
    client: "מעצבת פנים",
    desc: "איפיון, עיצוב ופיתוח אתר תדמית.",
    videos: [{ src: `${BUCKET}/yuli.mp4` }],
    centerMobile: true,
  },
  {
    name: "ישראל ברכץ",
    client: "אנעים זמירות",
    desc: "איפיון, עיצוב ופיתוח אתר חנות אונליין.",
    videos: [
      { src: `${BUCKET}/israel-home.mp4`, caption: "דף הבית" },
      { src: `${BUCKET}/israel-checkout.mp4`, caption: "תהליך הרכישה" },
    ],
    centerMobile: true,
  },
  {
    name: "ליאור שדה",
    client: "Moving Art",
    desc: 'כאן לא עיצבתי, אלא שדרגתי אתר קיים: הוספת שפה עברית (האתר היה אנגלית בלבד), הקמת מערך בלוג ל-SEO (בשיתוף השת"פ יבגני סיני), שיפור ביצועים אגרסיבי תוך שמירה מלאה על העיצוב, מחיקת פלאגינים והחלפתם בקוד מותאם אישית, ושיפור נגישות.',
    videos: [{ src: `${BUCKET}/lior.mp4` }],
    link: {
      href: "https://insights.origuystudio.com/%d7%9e%d7%94-%d7%a7%d7%95%d7%a8%d7%94-%d7%9b%d7%a9%d7%9e%d7%a9%d7%a7%d7%99%d7%a2%d7%99%d7%9d-%d7%a8%d7%91%d7%a2%d7%95%d7%9f-%d7%91%d7%90%d7%aa%d7%a8-%d7%9e%d7%94-%d7%a9%d7%a7%d7%a8%d7%94-%d7%a2%d7%9d/",
      label: "קרא על העבודה",
    },
  },
];

// Designed Orion product video (Remotion render, hosted in the public bucket).
const ORION_VIDEO = `${BUCKET}/orion-marketing.mp4`;
const ORION_POSTER = `${BUCKET}/orion-marketing-poster.jpg`;

const MARQUEE = [
  "בלי תבניות",
  "סטודיו של איש אחד",
  "קוד מותאם אישית",
  "Orion",
  "אחריות ותחזוקה",
  "פוקוס מלא",
  "מאפס · בשבילך",
];

const NAV = [
  { id: "story", label: "הסיפור" },
  { id: "orion", label: "Orion" },
  { id: "showreel", label: "סרטון" },
  { id: "work", label: "עבודות" },
  { id: "reviews", label: "המלצות" },
  { id: "contact", label: "צור קשר" },
];

// Internal policy pages (src/pages/public/LegalPage.tsx) - linked in the footer
// + the form's consent checkbox.
const LEGAL = {
  terms: "/terms",
  privacy: "/privacy",
};

function waLink() {
  if (!WHATSAPP) return undefined;
  return `https://wa.me/${WHATSAPP.replace(/\D/g, "")}`;
}

/** Public referral landing reached via a partner's link (`/ref/:code`). */
export default function RefLanding() {
  const { code = "" } = useParams();
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [egg, setEgg] = useState(false);
  const clickId = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Ori Guy Studio · אתרים שגורמים ללקוחות לבחור בך";
    let alive = true;
    resolveReferral(code).then((r) => {
      if (alive && r.valid && r.partner_name) setPartnerName(r.partner_name);
    });
    trackReferralClick(code).then((id) => (clickId.current = id));
    return () => {
      alive = false;
    };
  }, [code]);

  // Reveal sections as they scroll into view; re-trigger every time (so scrolling
  // back up then down replays the animations).
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll(".reveal-up");
    if (!els?.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => e.target.classList.toggle("is-in", e.isIntersecting));
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  function scrollToForm() {
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div
      ref={rootRef}
      className="min-h-screen overflow-x-clip bg-background text-foreground"
      dir="rtl"
    >
      <IntroCurtain />
      <ClickSpark />
      <FallingEasterEgg active={egg} onClose={() => setEgg(false)} />
      <ScrollProgressBar />
      <GlassNav onCta={scrollToForm} />
      <MobileNavFab />

      <Hero partnerName={partnerName} onCta={scrollToForm} onEgg={() => setEgg(true)} />
      <VelocityMarquee />
      <SocialProofStrip />

      <HighlightText text="זה לא עוד אתר מהמדף. זה אתר או מערכת שגורמים ללקוחות לעצור, להאמין, ולבחור בך." />

      <WhyMe />
      <Stats />

      <section id="story">
        <StorySection
          img={IMG.oriThink}
          eyebrow="איך אני עובד"
          title="אני יושב על כל פרט, עד שזה מרגיש נכון."
          body="אני לא לוקח עשרה פרויקטים במקביל. אני לוקח מעט לקוחות בכל פעם, נכנס לעסק שלך לעומק, ובונה משהו שמרגיש בדיוק כמוך, רק יותר חד, יותר מדויק ויותר מהמם. אתה מדבר איתי ישירות, מההתחלה ועד שעולים לאוויר."
          align="start"
          num="01"
        />
      </section>

      <StickyTitles
        items={[
          "בלי תבניות.",
          "בלי מתווכים.",
          "רק אתה, אני, והדבר הכי טוב שאפשר לבנות.",
        ]}
      />

      <ProjectTypes />
      <HowItWorks />

      <section id="orion">
        <OrionPeek />
      </section>

      <OrionShowreel />

      <StorySection
        img={IMG.oriSocial}
        eyebrow="אחרי ההשקה"
        title="אתה לא נשאר לבד אחרי שעולים לאוויר."
        body="הרבה בוני אתרים נותנים לך אתר ונעלמים. אצלי Orion נשאר איתך: אחריות, תחזוקה, ומקום אחד שתמיד פתוח לפניך. תמיד יש לך למי לפנות, ותמיד ברור לך מה קורה."
        align="end"
        num="02"
      />

      <section id="work">
        <Portfolio />
      </section>

      <Maintenance />
      <Testimonials />
      <FAQ />

      <section id="contact" className="reveal-up px-4 py-20 sm:px-6 sm:py-28">
        <LeadForm code={code} clickId={clickId} partnerName={partnerName} />
      </section>

      <PartnerCard />

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-start">
          <p className="font-heading text-base font-black text-foreground">
            <button
              onClick={() => setEgg(true)}
              title="בא לך הפתעה?"
              className="group relative transition-transform hover:scale-[1.03]"
            >
              Ori Guy Studio
              <span className="absolute -right-3.5 -top-1 text-primary opacity-0 transition-opacity group-hover:opacity-100">
                ✦
              </span>
            </button>
            <span className="ms-2 text-xs font-normal text-muted-foreground">· נבנה עם Orion 🚀</span>
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <a href={LEGAL.terms} target="_blank" rel="noreferrer noopener" className="transition-colors hover:text-foreground">
              תנאי שימוש
            </a>
            <a href={LEGAL.privacy} target="_blank" rel="noreferrer noopener" className="transition-colors hover:text-foreground">
              מדיניות פרטיות
            </a>
            <span>© {new Date().getFullYear()} כל הזכויות שמורות</span>
          </nav>
        </div>
        <p className="mx-auto mt-6 max-w-5xl text-center text-[11px] text-muted-foreground/70 sm:text-start">
          מטעמי נוחות הטקסט מנוסח בלשון זכר, אך פונה לכל המינים.
        </p>
      </footer>
    </div>
  );
}

/* ───────────────────────── Scroll progress + glass nav ───────────────────────── */

function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-50 h-1 origin-right bg-primary"
    />
  );
}

function GlassNav({ onCta }: { onCta: () => void }) {
  const [active, setActive] = useState<string>("");
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  function go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4 py-3 transition-all sm:px-6">
      {/* On scroll the bar narrows (width), height stays — content pulls into a
          centered glass pill. */}
      <div
        className={
          "mx-auto flex items-center justify-between gap-3 transition-all duration-300 " +
          (solid ? "max-w-4xl rounded-2xl ref-glass px-3 py-1.5" : "max-w-7xl")
        }
      >
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="font-heading text-lg font-black tracking-tight text-foreground"
        >
          Ori Guy Studio
        </button>

        <nav className="ref-glass hidden items-center gap-1 rounded-2xl px-1.5 py-1.5 sm:flex">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={
                "rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors " +
                (active === n.id
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:text-foreground")
              }
            >
              {n.label}
            </button>
          ))}
        </nav>

        <button
          onClick={onCta}
          className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-95"
        >
          בוא נדבר
        </button>
      </div>
    </header>
  );
}

/* Mobile-only floating menu (bottom-right). Scaling-hamburger pattern adapted from
   Osmo to the brand (green panel) + RTL; CSS lives under `.ham-nav` in index.css. */
function MobileNavFab() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  function go(id: string) {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }
  return (
    <div className="ham-nav sm:hidden" data-status={open ? "active" : "not-active"}>
      <div className="ham-nav__bg-dark" onClick={() => setOpen(false)} />
      <div className="ham-nav__box">
        <div className="ham-nav__bg" />
        <button type="button" className="ham-nav__close" onClick={() => setOpen(false)} aria-label="סגירה">
          <X className="size-5" />
        </button>
        <div className="ham-nav__group">
          <p className="ham-nav__title">תפריט</p>
          <ul className="ham-nav__ul">
            {NAV.map((n) => (
              <li key={n.id}>
                <button type="button" className="ham-nav__a" onClick={() => go(n.id)}>
                  <span className={"ham-nav__label " + (active === n.id ? "font-bold" : "font-light")}>
                    {n.label}
                  </span>
                  <span className="ham-nav__dot" />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          className="ham-nav__toggle"
          onClick={() => setOpen(true)}
          aria-label="תפריט"
          aria-expanded={open}
        >
          <span className="ham-nav__bar" />
          <span className="ham-nav__bar" />
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

/* ───────────────────────── Intro ─────────────────────────
   Reuses the multilingual "Welcoming Words" greeting from the login → dashboard
   flow as the ref-landing intro. Plays once per full page load. */
let introPlayed = false;

function IntroCurtain() {
  const [show, setShow] = useState(!introPlayed);
  useEffect(() => {
    introPlayed = true;
  }, []);
  if (!show) return null;
  return <WelcomingWords onDone={() => setShow(false)} />;
}

function Hero({
  partnerName,
  onCta,
  onEgg,
}: {
  partnerName: string | null;
  onCta: () => void;
  onEgg: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const fade = useTransform(scrollYProgress, [0, 0.85], [1, 0]);
  const lift = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  // Cursor parallax for the focal object.
  const mx = useSpring(0, { stiffness: 45, damping: 18 });
  const my = useSpring(0, { stiffness: 45, damping: 18 });
  const fxX = useTransform(mx, [-1, 1], [28, -28]);
  const fxY = useTransform(my, [-1, 1], [20, -20]);

  function onMouse(e: React.MouseEvent<HTMLElement>) {
    if (reduced) return;
    mx.set((e.clientX / window.innerWidth - 0.5) * 2);
    my.set((e.clientY / window.innerHeight - 0.5) * 2);
  }

  // Per-line reveal helper.
  const line = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: "0.6em" },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.9, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <section
      ref={ref}
      onMouseMove={onMouse}
      className="ref-grain ref-vignette relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[#0a0910] text-center"
    >
      {/* React Bits Aurora - flowing brand-color aurora, gentle cursor parallax */}
      <motion.div
        style={reduced ? undefined : { x: fxX, y: fxY }}
        className="pointer-events-none absolute -inset-[8%] z-0"
        aria-hidden="true"
      >
        <Aurora className="h-full w-full opacity-70" amplitude={1.15} blend={0.55} speed={0.7} />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0a0910]/50 via-[#0a0910]/10 to-[#0a0910]" />

      <motion.div
        style={reduced ? undefined : { y: lift, opacity: fade }}
        className="relative z-10 mx-auto max-w-5xl px-6"
      >
        {partnerName && (
          <motion.span
            {...line(0.05)}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/50 px-4 py-1.5 text-sm text-white/90 backdrop-blur"
          >
            <Handshake className="size-4 text-primary" />
            הופנית ע"י <span className="font-semibold text-primary">{partnerName}</span>
          </motion.span>
        )}

        <h1 className="font-heading font-black leading-[0.92] tracking-tight text-white">
          <motion.span
            {...line(0.12)}
            className="block text-[clamp(1.4rem,4.5vw,2.6rem)] font-medium text-white/55"
          >
            הרושם הראשון
          </motion.span>
          <motion.span {...line(0.26)} className="block text-[clamp(3.4rem,13vw,9rem)]">
            קורה <span className="ref-stroke">פעם</span> אחת.
          </motion.span>
          <motion.span
            {...line(0.42)}
            className="mt-1 block text-[clamp(2.6rem,10vw,6.8rem)]"
          >
            בוא נעשה אותו{" "}
            <span className="ref-gradient-text whitespace-nowrap">
              בלתי נשכח
            </span>
            <button
              onClick={onEgg}
              aria-label="הפתעה"
              className="ml-2 inline-flex -translate-y-[0.4em] align-middle transition-transform hover:scale-125 hover:rotate-12"
            >
              <Sparkles className="size-[0.5em] fill-primary text-primary" />
            </button>
          </motion.span>
        </h1>

        <motion.p
          {...line(0.62)}
          className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg"
        >
          אני אורי - סטודיו של איש אחד. בלי תבניות, בלי מתווכים. רק אתה, אני,
          והאתר שיגרום ללקוחות שלך לעצור ולבחור בך.
        </motion.p>

        <motion.div
          {...line(0.78)}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Magnet disabled={reduced} padding={70} magnetStrength={4}>
            <button
              onClick={onCta}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-primary px-8 py-4 font-semibold text-primary-foreground shadow-lift transition-transform hover:scale-[1.03] active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                בוא נדבר
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              </span>
              <span className="absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-500 group-hover:translate-x-full" />
            </button>
          </Magnet>
          {waLink() && (
            <a
              href={waLink()}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-card/30 px-8 py-4 font-medium text-white backdrop-blur transition-colors hover:border-primary/60"
            >
              וואטסאפ
            </a>
          )}
        </motion.div>

        <motion.p
          {...line(0.95)}
          className="mt-8 text-[11px] leading-relaxed text-white/40"
        >
          מטעמי נוחות הטקסט מנוסח בלשון זכר, אך פונה לכל המינים.
        </motion.p>
      </motion.div>

      {!reduced && (
        <motion.div
          style={{ opacity: fade }}
          className="absolute inset-x-0 bottom-6 z-10 flex flex-col items-center gap-1 text-white/50"
        >
          <span className="text-xs">גלול</span>
          <motion.span animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            <ArrowDown className="size-4" />
          </motion.span>
        </motion.div>
      )}
    </section>
  );
}

/* ───────────────────────── Marquee ─────────────────────────
   Seamless CSS marquee: the content is duplicated, the track scrolls by exactly
   one copy (-50%) so it loops with no gap. Reliable + always visible. */

// The visible content (one "copy"), repeated to comfortably exceed the viewport.
const MARQUEE_COPY = [...MARQUEE, ...MARQUEE];

function VelocityMarquee() {
  const reduced = usePrefersReducedMotion();
  // dir=ltr on the WRAPPER: in the RTL page the wide track gets right-aligned and
  // overflows left, so translateX(-50%) slid it off-screen. LTR block flow keeps the
  // track at the left edge → canonical seamless marquee.
  return (
    <div
      dir="ltr"
      className="relative w-full overflow-hidden border-y border-border bg-card/30 py-6"
    >
      <div
        className={
          "flex items-center " +
          (reduced ? "w-full flex-wrap justify-center" : "ref-marquee w-max")
        }
      >
        {[...MARQUEE_COPY, ...MARQUEE_COPY].map((t, i) => (
          <span
            key={i}
            className="mx-5 font-heading text-3xl font-black tracking-tight text-foreground/70 sm:mx-8 sm:text-5xl"
          >
            {t}
            <span className="mx-3 text-primary">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Highlight text on scroll ───────────────────────── */

function HighlightText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "start 0.35"],
  });
  // spring-smooth the scrub so the fill glides instead of snapping
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  const words = text.split(" ");

  if (reduced) {
    return (
      <section className="px-6 py-24 sm:py-32">
        <p className="mx-auto max-w-4xl text-center font-heading text-3xl font-black leading-tight text-foreground sm:text-5xl">
          {text}
        </p>
      </section>
    );
  }

  return (
    <section className="px-6 py-24 sm:py-32">
      <p
        ref={ref}
        className="mx-auto max-w-4xl text-center font-heading text-3xl font-black leading-tight text-foreground sm:text-5xl"
      >
        {words.map((w, i) => (
          <HighlightWord
            key={i}
            word={w}
            range={[i / words.length, (i + 1) / words.length]}
            progress={progress}
          />
        ))}
      </p>
    </section>
  );
}

function HighlightWord({
  word,
  range,
  progress,
}: {
  word: string;
  range: [number, number];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  const blur = useTransform(progress, range, ["blur(7px)", "blur(0px)"]);
  return (
    <>
      <motion.span style={{ opacity, filter: blur }} className="inline-block">
        {word}
      </motion.span>{" "}
    </>
  );
}

/* ───────────────────────── Sticky stacked titles ───────────────────────── */

function StickyTitles({ items }: { items: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  // Spring-smooth the scroll so the title hand-offs feel fluid, not jumpy.
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 });

  return (
    <div ref={ref} style={{ height: `${items.length * 85}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-6">
        {/* atmospheric backdrop: rotating rays + brand dot-grid + glow */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-card/20 to-background" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[150vmin] -translate-x-1/2 -translate-y-1/2">
          <div className="ref-rays absolute inset-0 opacity-30" />
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(180,214,112,0.10) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(circle at 50% 50%, #000, transparent 62%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000, transparent 62%)",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
        {items.map((t, i) => (
          <StickyTitleItem
            key={i}
            text={t}
            index={i}
            total={items.length}
            progress={reduced ? scrollYProgress : progress}
            reduced={reduced}
          />
        ))}
      </div>
    </div>
  );
}

function StickyTitleItem({
  text,
  index,
  total,
  progress,
  reduced,
}: {
  text: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  const seg = 1 / total;
  const start = index * seg;
  const isLast = index === total - 1;
  const opacity = useTransform(
    progress,
    [start, start + seg * 0.28, start + seg * 0.72, start + seg],
    [0, 1, 1, isLast ? 1 : 0]
  );
  const y = useTransform(progress, [start, start + seg], [50, -50]);
  const blur = useTransform(
    progress,
    [start, start + seg * 0.28, start + seg * 0.72, start + seg],
    ["blur(14px)", "blur(0px)", "blur(0px)", isLast ? "blur(0px)" : "blur(14px)"]
  );

  return (
    <motion.h2
      style={reduced ? { opacity } : { opacity, y, filter: blur }}
      className="absolute max-w-5xl text-center font-heading text-4xl font-black leading-[1.05] text-foreground sm:text-7xl"
    >
      {text}
    </motion.h2>
  );
}

/* ───────────────────────── Why me ───────────────────────── */

function WhyMe() {
  return (
    <Section title="למה לעבוד עם סטודיו של איש אחד?">
      <div className="grid gap-5 sm:grid-cols-3">
        <Feature icon={MessagesSquare} title="אתה מדבר איתי ישירות">
          לא נציג, לא מתווך. אתה מסביר מה אתה צריך, ואני בונה.
        </Feature>
        <Feature icon={Sparkles} title="כל אתר נבנה מאפס בשבילך">
          הצבעים, הטיפוגרפיה והאנימציות, כולם מותאמים לעסק ולקהל שלך.
        </Feature>
        <Feature icon={CheckCircle2} title="אתה רואה הכל לאורך הדרך">
          בלי לרדוף אחריי, בלי לנחש איפה הדברים עומדים.
        </Feature>
      </div>
    </Section>
  );
}

/* ───────────────────────── Stats (gamified) ───────────────────────── */

function Stats() {
  return (
    <section className="-mt-10 px-6 pb-16 pt-0 sm:-mt-16">
      <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
        <StatCard value={100} suffix="%" label="זמינות אישית לכל לקוח" ring={1} />
        <StatCard value={0} label="מתווכים בינך לביני" ring={0.04} />
        <StatCard value={24} suffix="/7" label="Orion פתוח לפניך" ring={1} />
      </div>
    </section>
  );
}

function StatCard({
  value,
  suffix,
  label,
  ring,
}: {
  value: number;
  suffix?: string;
  label: string;
  ring: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: "-60px" });
  const reduced = usePrefersReducedMotion();
  const C = 2 * Math.PI * 34;
  const [offset, setOffset] = useState(C);

  // Subtle 3D mouse-tilt for tactile interaction.
  const rx = useSpring(0, { stiffness: 200, damping: 18 });
  const ry = useSpring(0, { stiffness: 200, damping: 18 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rx.set(-py * 10);
    ry.set(px * 12);
  }
  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  useEffect(() => {
    if (!inView) return;
    if (reduced) return setOffset(C * (1 - ring));
    const controls = animate(C, C * (1 - ring), {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: setOffset,
    });
    return () => controls.stop();
  }, [inView, reduced, C, ring]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={reduced ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 800 }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-center transition-colors hover:border-primary/40"
    >
      {/* glow that follows the hover */}
      <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-primary/0 via-primary/0 to-primary/10 opacity-0 transition-opacity group-hover:opacity-100" />
      <svg
        className={
          "absolute -left-6 -top-6 size-24 -rotate-90 opacity-30 transition-opacity group-hover:opacity-60 " +
          (reduced ? "" : "group-hover:[animation:ref-spin_9s_linear_infinite]")
        }
        viewBox="0 0 80 80"
      >
        <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="3" className="text-border" />
        <circle
          cx="40"
          cy="40"
          r="34"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          className="text-primary"
        />
      </svg>
      <div className="relative font-heading text-5xl font-black text-primary">
        <Counter to={value} inView={inView} />
        {suffix}
      </div>
      <p className="relative mt-2 text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
}

function Counter({ to, inView }: { to: number; inView: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(reduced ? to : 0);

  useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(0, to, {
      duration: 1.4,
      ease: "easeOut",
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduced]);

  return <span>{val}</span>;
}

/* ───────────────────────── Parallax story section ───────────────────────── */

function StorySection({
  img,
  eyebrow,
  title,
  body,
  align,
  num,
}: {
  img: string;
  eyebrow: string;
  title: string;
  body: string;
  align: "start" | "end";
  num: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "10%"]);
  const imageFirst = align === "start";

  return (
    <section ref={ref} className="overflow-x-clip px-6 py-20 sm:py-28">
      <div
        className={
          "mx-auto grid max-w-5xl items-center gap-10 sm:grid-cols-2 " +
          (imageFirst ? "" : "sm:[direction:rtl]")
        }
      >
        {/* Portrait that BREAKS the frame - the head overflows the panel's top border */}
        <motion.div
          style={reduced ? undefined : { y }}
          className={"relative " + (imageFirst ? "" : "sm:order-2")}
        >
          {/* fixed-aspect frame; the image is TALLER than the frame and bottom-aligned,
              so the head clearly pokes out above the top border (overflow not clipped) */}
          <div className="relative mx-auto aspect-[4/5] w-full max-w-[18rem]">
            <div className="absolute inset-0 rounded-[2rem] border border-border bg-gradient-to-br from-primary/15 via-brand-cyan-base/10 to-card" />
            <div className="absolute inset-x-6 top-1/4 aspect-square rounded-full bg-primary/25 blur-3xl" />
            <img
              src={img}
              alt="אורי גיא"
              loading="lazy"
              className="absolute inset-x-0 bottom-0 z-10 mx-auto block h-[132%] w-auto max-w-none object-contain object-bottom drop-shadow-2xl"
            />
            {/* dissolve the cutout's bottom edge into the panel so nothing looks chopped */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 rounded-b-[2rem] bg-gradient-to-t from-card to-transparent" />
          </div>
        </motion.div>

        <div className={"reveal-up " + (imageFirst ? "" : "sm:order-1")}>
          {/* designed index number sits in-flow next to the eyebrow */}
          <div className="flex items-center gap-4">
            <span className="ref-gradient-text font-heading text-6xl font-black leading-none sm:text-7xl">
              {num}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" /> {eyebrow}
            </span>
          </div>
          <h2 className="mt-6 font-heading text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl">
            {title}
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Project types ───────────────────────── */

const TYPE_CARDS: {
  title: string;
  desc: string;
  accent: string;
  Visual: (p: { accent: string }) => React.ReactNode;
}[] = [
  { title: "אתר עסקי / תדמית", desc: "אתר שמספר מי אתה ולמה כדאי לבחור בך.", accent: "#B4D670", Visual: BrowserMotif },
  { title: "חנות אונליין", desc: "חנות שנעים לקנות בה, מהטלפון ומהמחשב.", accent: "#77becf", Visual: ShopMotif },
  { title: "מערכת / אפליקציה", desc: "כלי שעובד בדיוק כמו שהעסק שלך עובד.", accent: "#8b7bf0", Visual: AppMotif },
  { title: "משהו אחר", desc: "יש לך רעיון? בוא נשמע אותו.", accent: "#91be37", Visual: IdeaMotif },
];

function ProjectTypes() {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Stacking sticky cards: each card pins under the nav and the next fans over it
  // (rotate + slight offset) with an elastic bounce as it locks. Runs on every
  // breakpoint via gsap.matchMedia (smaller fan on mobile so nothing overflows);
  // reduced-motion falls back to a plain vertical stack.
  useEffect(() => {
    if (reduced) return;
    const root = ref.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    const build =
      (xs: number[], ys: number[], rots: number[]) =>
      () => {
        const cards = gsap.utils.toArray<HTMLElement>("[data-stack-card]", root);
        cards.forEach((card, i) => {
          const t = card.querySelector<HTMLElement>("[data-stack-target]");
          if (!t) return;
          const stickyTop = parseFloat(getComputedStyle(card).top) || 88;
          gsap.set(t, { zIndex: cards.length - i, transformOrigin: "center center" });
          gsap.fromTo(
            t,
            { rotate: 0, x: 0, y: 0 },
            {
              rotate: rots[i % rots.length],
              // RTL: flip the horizontal fan direction.
              x: `${-xs[i % xs.length]}em`,
              y: `${ys[i % ys.length]}em`,
              ease: "power1.in",
              scrollTrigger: { trigger: card, start: "top 80%", end: `top ${stickyTop}px`, scrub: true },
            }
          );
          ScrollTrigger.create({ trigger: card, start: `top ${stickyTop}px`, onEnter: () => bounceStack(t) });
        });
      };
    mm.add("(min-width: 640px)", build([-6, 3, -3, 5], [2, 0, 3.5, 1], [-5, 3, 6, -3]));
    mm.add("(max-width: 639px)", build([-2, 1.3, -1.3, 2], [1.2, 0, 2, 0.8], [-3, 2, 4, -2]));
    return () => mm.revert();
  }, [reduced]);

  return (
    <Section title="מה אתה צריך?">
      <div ref={ref} className="mx-auto flex max-w-sm flex-col items-center gap-8 sm:max-w-md sm:gap-24">
        {TYPE_CARDS.map((c, i) => (
          <div
            key={c.title}
            data-stack-card
            className={cn("w-full", !reduced && "sticky top-20 sm:top-24")}
          >
            <StackCard {...c} index={i} />
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Quick elastic stretch when a stacking card locks into place. */
function bounceStack(el: HTMLElement) {
  const w = el.offsetWidth || 1;
  const h = el.offsetHeight || 1;
  const stretch = 0.045 * w;
  gsap
    .timeline()
    .to(el, {
      scaleX: (w + stretch) / w,
      scaleY: (h - stretch * 0.4) / h,
      duration: 0.1,
      ease: "power1.out",
    })
    .to(el, { scaleX: 1, scaleY: 1, duration: 1, ease: "elastic.out(1, 0.3)" });
}

function StackCard({
  title,
  desc,
  accent,
  Visual,
  index,
}: {
  title: string;
  desc: string;
  accent: string;
  Visual: (p: { accent: string }) => React.ReactNode;
  index: number;
}) {
  return (
    <div
      data-stack-target
      className="relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[2rem] border border-border bg-[#0c0b11] p-6 text-right shadow-lift sm:p-8"
    >
      <div
        className="absolute inset-x-0 top-0 h-2/3"
        style={{ background: `radial-gradient(120% 100% at 50% 0%, ${accent}45, ${accent}14 45%, transparent 72%)` }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
          maskImage: "radial-gradient(circle at 50% 0%, #000, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 0%, #000, transparent 70%)",
        }}
      />
      <div className="relative flex items-start justify-between">
        <span className="font-heading text-6xl font-bold leading-none text-white/90 sm:text-7xl">
          {index + 1}.
        </span>
      </div>
      <div className="relative flex flex-1 items-center justify-center py-4">
        <Visual accent={accent} />
      </div>
      <div className="relative">
        <h3 className="font-heading text-2xl font-bold text-white sm:text-3xl">{title}</h3>
        <p className="mt-1.5 text-white/60">{desc}</p>
      </div>
    </div>
  );
}

/* Brand CSS motifs (no AI imagery) for the project-type cards. Each has a subtle
   looping animation, gated on prefers-reduced-motion. No video, no extra assets. */
function BrowserMotif({ accent }: { accent: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="w-40 rounded-xl border border-white/10 bg-white/[0.04] p-2 shadow-lift backdrop-blur" dir="ltr">
      <div className="mb-2 flex gap-1">
        <span className="size-1.5 rounded-full bg-white/30" />
        <span className="size-1.5 rounded-full bg-white/30" />
        <span className="size-1.5 rounded-full bg-white/30" />
      </div>
      <div className="relative h-7 overflow-hidden rounded" style={{ background: `linear-gradient(90deg, ${accent}66, ${accent}22)` }}>
        {!reduced && (
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3 -skew-x-12"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)" }}
            animate={{ x: ["-120%", "430%"] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
          />
        )}
      </div>
      <div className="mt-1.5 h-1.5 w-2/3 rounded bg-white/15" />
      <div className="mt-1 h-1.5 w-1/2 rounded bg-white/10" />
      <div className="mt-1.5 grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-6 rounded bg-white/[0.06]"
            animate={reduced ? undefined : { opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}

function ShopMotif({ accent }: { accent: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="w-32 rounded-xl border border-white/10 bg-white/[0.04] p-2 shadow-lift" dir="ltr">
      <div className="relative h-16 overflow-hidden rounded-lg" style={{ background: `linear-gradient(135deg, ${accent}55, ${accent}15)` }}>
        {!reduced && (
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3 -skew-x-12"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }}
            animate={{ x: ["-120%", "430%"] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: "easeInOut" }}
          />
        )}
      </div>
      <div className="mt-2 h-1.5 w-3/4 rounded bg-white/15" />
      <div className="mt-2 flex items-center justify-between">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: accent, background: `${accent}22` }}>
          ₪199
        </span>
        <motion.span
          className="text-sm leading-none"
          style={{ color: accent }}
          animate={reduced ? undefined : { scale: [1, 1.3, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          ＋
        </motion.span>
      </div>
    </div>
  );
}

function AppMotif({ accent }: { accent: string }) {
  const reduced = usePrefersReducedMotion();
  const onPattern = [true, false, true];
  return (
    <div className="w-36 rounded-xl border border-white/10 bg-white/[0.04] p-3 shadow-lift" dir="ltr">
      <div className="mb-2.5 h-1.5 w-1/2 rounded bg-white/15" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-2 flex items-center justify-between">
          <div className="h-1.5 w-1/2 rounded bg-white/10" />
          <motion.div
            className="flex h-3.5 w-7 items-center rounded-full p-0.5"
            animate={
              reduced
                ? { backgroundColor: onPattern[i] ? `${accent}66` : `${accent}22` }
                : { backgroundColor: [`${accent}22`, `${accent}66`, `${accent}66`, `${accent}22`] }
            }
            transition={{ duration: 3, times: [0, 0.3, 0.7, 1], repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
          >
            <motion.div
              className="size-2.5 rounded-full"
              style={{ background: accent }}
              animate={reduced ? { x: onPattern[i] ? 14 : 0 } : { x: [0, 14, 14, 0] }}
              transition={{ duration: 3, times: [0, 0.3, 0.7, 1], repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
            />
          </motion.div>
        </div>
      ))}
    </div>
  );
}

function IdeaMotif({ accent }: { accent: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="relative flex size-24 items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: `${accent}33` }}
        animate={reduced ? undefined : { opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="relative"
        animate={reduced ? undefined : { scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Sparkles className="size-14" style={{ color: accent }} />
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Interactive Orion peek + video slot ───────────────────────── */

const ORION_TABS = [
  {
    key: "roadmap",
    label: "מפת דרכים",
    title: "תמיד ברור לך באיזה שלב אני.",
    body: "כל שלב בפרויקט מסומן וברור. אתה רואה מה הסתיים, מה בעבודה ומה הבא בתור, בלי לשאול.",
    render: () => (
      <div className="space-y-3">
        {[
          { t: "אפיון ואסטרטגיה", done: true },
          { t: "עיצוב", done: true },
          { t: "פיתוח", active: true },
          { t: "השקה", done: false },
        ].map((s) => (
          <div key={s.t} className="flex items-center gap-3">
            <span
              className={
                "flex size-6 items-center justify-center rounded-full text-[11px] " +
                (s.done
                  ? "bg-primary text-primary-foreground"
                  : s.active
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground")
              }
            >
              {s.done ? "✓" : ""}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
              <div
                className={"h-full rounded-full " + (s.done ? "w-full bg-primary" : s.active ? "w-1/2 bg-primary/70" : "w-0")}
              />
            </div>
            <span className={"w-28 text-xs " + (s.active ? "text-primary" : "text-muted-foreground")}>{s.t}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "approve",
    label: "אישורים",
    title: "אתה מאשר שלבים בלחיצה.",
    body: "כשמשהו מוכן לעיניך, אתה מאשר אותו ישירות במערכת. אני יודע מיד שאפשר להמשיך.",
    render: () => (
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-sm font-semibold text-foreground">עיצוב עמוד הבית</p>
          <p className="mt-1 text-xs text-muted-foreground">מחכה לאישור שלך</p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground">אישור ✓</span>
            <span className="rounded-xl border border-border px-4 py-1.5 text-xs text-muted-foreground">בקשת שינוי</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "chat",
    label: "צ'אט",
    title: "אתה מדבר איתי במקום אחד.",
    body: "בלי וואטסאפ מבולגן ובלי מיילים אבודים. כל שיחה, קובץ והחלטה נשמרים יחד, וגם פיקסל, ה-AI שבניתי, עונה לך מיד.",
    render: () => (
      <div className="space-y-2.5">
        <div className="ms-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          מתי עולים לאוויר?
        </div>
        <div className="me-auto max-w-[80%] rounded-2xl rounded-tl-sm border border-border bg-background px-3.5 py-2 text-sm text-foreground">
          השלב האחרון בפיתוח, סוף השבוע אתה מאשר ואני מעלה לאוויר 🚀
        </div>
        <div className="me-auto flex max-w-[80%] items-center gap-1.5 rounded-2xl rounded-tl-sm border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" /> פיקסל מקליד…
        </div>
      </div>
    ),
  },
  {
    key: "files",
    label: "קבצים",
    title: "כל הקבצים במקום אחד.",
    body: "לוגו, תמונות, מסמכים וגרסאות, מסודרים בתיקיות, מאובטחים וזמינים לך בכל רגע. בלי לחפש בהיסטוריית מיילים.",
    render: () => (
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { n: "לוגו-סופי.svg", c: "#B4D670" },
          { n: "מסמך-אפיון.pdf", c: "#77becf" },
          { n: "תמונות-אתר.zip", c: "#8b7bf0" },
          { n: "חוזה.pdf", c: "#91be37" },
        ].map((f) => (
          <div key={f.n} className="flex items-center gap-2 rounded-xl border border-border bg-background p-2.5">
            <span className="size-7 shrink-0 rounded-md" style={{ background: `${f.c}33`, border: `1px solid ${f.c}55` }} />
            <span className="truncate text-xs text-foreground">{f.n}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: "warranty",
    label: "אחריות",
    title: "אחריות ותחזוקה שקופות.",
    body: "אתה רואה בדיוק עד מתי האתר באחריות, מה כלול, ומתי בוצעה התחזוקה האחרונה. הכל גלוי לפניך.",
    render: () => (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">אחריות פעילה</p>
            <p className="mt-0.5 text-xs text-muted-foreground">בתוקף עד 14.09.2026</p>
          </div>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">תקין ✓</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-foreground">תחזוקה אחרונה</p>
          <p className="text-xs text-muted-foreground">לפני 6 ימים</p>
        </div>
      </div>
    ),
  },
];

function OrionPeek() {
  const [tab, setTab] = useState(ORION_TABS[0].key);
  const active = ORION_TABS.find((t) => t.key === tab) ?? ORION_TABS[0];

  return (
    <section className="reveal-up px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-3 py-1 text-xs font-medium text-primary">
            <LayoutGrid className="size-3.5" /> Orion · המערכת שלך
          </span>
          <h2 className="mt-4 font-heading text-3xl font-black text-foreground sm:text-4xl">
            יש לך מערכת משלך. נסה אותה עכשיו.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            בניתי בעצמי, מאפס, מערכת בשם <span className="font-semibold text-foreground">Orion</span> שמלווה
            אותך מהיום הראשון ועד הרבה אחרי ההשקה. לחץ על הלשוניות, ככה זה מרגיש.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-2">
          <div>
            <div className="mx-auto flex max-w-[19rem] flex-wrap justify-center gap-2 sm:max-w-none sm:justify-start">
              {ORION_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={
                    "rounded-xl px-4 py-2 text-sm font-medium transition-colors " +
                    (t.key === tab
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:border-primary/40")
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="mb-4 flex items-center gap-1.5 border-b border-border pb-3">
                <span className="size-2.5 rounded-full bg-destructive/60" />
                <span className="size-2.5 rounded-full bg-[#f5c451]/70" />
                <span className="size-2.5 rounded-full bg-brand-green-base/70" />
                <span className="mx-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="relative flex size-1.5">
                    <span className="ref-ping absolute inline-flex size-full rounded-full bg-primary/70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                  </span>
                  orion.origuystudio.com
                </span>
              </div>
              {active.render()}
            </motion.div>

            <div className="mt-4">
              <h3 className="font-heading text-xl font-bold text-foreground">{active.title}</h3>
              <p className="mt-1 leading-relaxed text-muted-foreground">{active.body}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div
              data-orion-video-slot
              className="relative aspect-video overflow-hidden rounded-3xl border border-border bg-[#0d0c12]"
            >
              <img
                src={ORION_POSTER}
                alt="תצוגה של מערכת Orion"
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
            <p className="rounded-2xl border border-border bg-card p-5 leading-relaxed text-foreground">
              במהלך הפרויקט אתה לא צריך לנחש איפה דברים עומדים. הכל שקוף
              לפניך, בזמן אמת, במקום אחד, מהיום הראשון. את זה רוב הלקוחות לא
              מקבלים בשום מקום אחר.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Orion showreel (teaser → click-to-play w/ sound) ───────────────────────── */

function OrionShowreel() {
  const [open, setOpen] = useState(false);
  const reduced = usePrefersReducedMotion();
  const teaserRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const lightVideoRef = useRef<HTMLVideoElement>(null);
  const animating = useRef(false);

  // Muted teaser loops while in view.
  useEffect(() => {
    const v = teaserRef.current;
    if (!v || reduced) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduced]);

  // Manual FLIP: measure the card and the lightbox frame, then animate the frame
  // FROM the card's position/scale to its own (the "expand from the card" morph).
  const flip = (dir: "in" | "out", onDone?: () => void) => {
    const card = cardRef.current;
    const frame = frameRef.current;
    const bd = backdropRef.current;
    if (!card || !frame) {
      onDone?.();
      return;
    }
    const c = card.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    // If we can't measure (hidden card, zero-size viewport), skip the morph so
    // open/close still resolves instead of hanging on a never-completing tween.
    if (!c.width || !c.height || !f.width || !f.height) {
      if (bd) gsap.set(bd, { opacity: dir === "in" ? 1 : 0 });
      onDone?.();
      return;
    }
    const sx = c.width / f.width;
    const sy = c.height / f.height;
    const dx = c.left + c.width / 2 - (f.left + f.width / 2);
    const dy = c.top + c.height / 2 - (f.top + f.height / 2);
    const atCard = { x: dx, y: dy, scaleX: sx, scaleY: sy, transformOrigin: "center center" };
    if (dir === "in") {
      gsap.fromTo(bd, { opacity: 0 }, { opacity: 1, duration: 0.55, ease: "power2.out" });
      gsap.fromTo(
        frame,
        { ...atCard, opacity: 0.5 },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, duration: 0.8, ease: "power3.out" }
      );
    } else {
      gsap.to(bd, { opacity: 0, duration: 0.45, ease: "power2.inOut" });
      gsap.to(frame, { ...atCard, opacity: 0.4, duration: 0.5, ease: "power3.inOut", onComplete: onDone });
    }
  };

  useLayoutEffect(() => {
    if (!open) return;
    const v = lightVideoRef.current;
    if (v) {
      v.currentTime = 0;
      void v.play().catch(() => {});
    }
    if (reduced) {
      if (backdropRef.current) gsap.set(backdropRef.current, { opacity: 1 });
      return;
    }
    flip("in");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    if (animating.current) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      lightVideoRef.current?.pause();
      animating.current = false;
      setOpen(false);
    };
    if (reduced) return finish();
    animating.current = true;
    flip("out", finish);
    // Safety net: always resolve even if the tween's onComplete never fires.
    window.setTimeout(finish, 800);
  };

  // Esc closes; lock the page scroll while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <section id="showreel" className="reveal-up px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-3 py-1 text-xs font-medium text-primary">
          <Play className="size-3.5 fill-current" /> סרטון
        </span>
        <h2 className="mt-4 font-heading text-3xl font-black text-foreground sm:text-5xl">
          ראה את Orion בפעולה.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          חצי דקה שמראה איך זה מרגיש לעבוד איתי, מהכניסה הראשונה ועד ההשקה. הפעל עם סאונד.
        </p>

        <div className="mx-auto mt-10 w-full max-w-3xl">
          <button
            ref={cardRef}
            onClick={() => !open && !animating.current && setOpen(true)}
            className="group relative block aspect-video w-full overflow-hidden rounded-3xl border border-border bg-[#0d0c12] shadow-lift"
            aria-label="הפעלת הסרטון עם סאונד"
          >
            <video
              ref={teaserRef}
              poster={ORION_POSTER}
              muted
              loop
              playsInline
              preload="none"
              className="h-full w-full object-cover"
            >
              <source src={ORION_VIDEO} type="video/mp4" />
            </video>
            <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/15">
              <span className="flex items-center gap-3 rounded-full bg-card/85 px-5 py-2.5 shadow-lift backdrop-blur">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Play className="size-4 translate-x-0.5 fill-current" />
                </span>
                <span className="font-heading text-sm font-bold text-foreground">הפעל עם סאונד</span>
              </span>
            </span>
          </button>
        </div>
      </div>

      {/* Lightbox (portaled to body so `fixed` can't be trapped by a transformed ancestor) */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[10000]">
            <div
              ref={backdropRef}
              onClick={close}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 sm:p-10">
              <div
                ref={frameRef}
                className="pointer-events-auto relative aspect-video w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-[#0d0c12] shadow-2xl"
              >
                <video
                  ref={lightVideoRef}
                  src={ORION_VIDEO}
                  poster={ORION_POSTER}
                  controls
                  autoPlay
                  playsInline
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
            <button
              onClick={close}
              aria-label="סגירה"
              className="absolute end-5 top-5 z-[10002] flex size-11 items-center justify-center rounded-full border border-border bg-card/80 text-foreground backdrop-blur transition hover:bg-card"
            >
              <X className="size-5" />
            </button>
          </div>,
          document.body
        )}
    </section>
  );
}

/* ───────────────────────── Portfolio ───────────────────────── */

function MockupVideo({ src, caption }: { src: string; caption?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  // Start from the beginning only when the laptop reaches the MIDDLE of the
  // viewport, so the visitor never misses the intro. Pause when it leaves.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          v.currentTime = 0;
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: 0 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <figure className="w-full">
      <div className="relative w-full">
        {/* Video behind the laptop PNG, positioned to the transparent screen
            cut-out (rect measured from the mockup). Black bg = screen "on". */}
        <div
          className="absolute overflow-hidden rounded-md bg-black"
          style={{ top: "15.8%", left: "11.05%", width: "77.9%", height: "67.2%" }}
        >
          <video
            ref={ref}
            src={src}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        </div>
        <img
          src={MACBOOK}
          alt=""
          draggable={false}
          className="pointer-events-none relative z-10 block w-full select-none"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  );
}

function ProjectShowcase({ project, flip }: { project: (typeof PROJECTS)[number]; flip: boolean }) {
  const center = project.centerMobile;
  return (
    <div
      className={`reveal-up flex flex-col items-center gap-8 lg:gap-12 ${
        flip ? "lg:flex-row-reverse" : "lg:flex-row"
      }`}
    >
      {/* Bigger mockup column (58%); multi-video projects stack so each laptop stays large */}
      <div className="w-full lg:w-[58%]">
        {project.videos.length > 1 ? (
          <div className="grid gap-6">
            {project.videos.map((v) => (
              <MockupVideo key={v.src} src={v.src} caption={v.caption} />
            ))}
          </div>
        ) : (
          <MockupVideo src={project.videos[0].src} />
        )}
      </div>
      <div className={`w-full lg:w-[42%] ${center ? "text-center lg:text-start" : "text-start"}`}>
        <h3 className="font-heading text-2xl font-black text-foreground sm:text-3xl">{project.name}</h3>
        <p className="mt-1 text-sm font-medium text-primary">{project.client}</p>
        <p className="mt-4 leading-relaxed text-muted-foreground">{project.desc}</p>
        {project.link && (
          <a
            href={project.link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 rounded-2xl border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50"
          >
            {project.link.label} <ArrowLeft className="size-4" />
          </a>
        )}
      </div>
    </div>
  );
}

function Portfolio() {
  return (
    <section className="reveal-up overflow-hidden px-5 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-3 text-center font-heading text-3xl font-black tracking-tight text-foreground sm:text-5xl">
          כמה דברים שעשיתי לאחרונה
        </h2>
        <p className="mb-14 text-center text-muted-foreground">פרויקטים אמיתיים, רצים בתוך הדפדפן.</p>
        <div className="space-y-20 sm:space-y-28">
          {PROJECTS.map((p, i) => (
            <ProjectShowcase key={p.name} project={p} flip={i % 2 === 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Early social proof ───────────────────────── */

function SocialProofStrip() {
  return (
    <div className="px-6 py-8">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-4">
        <span className="flex gap-0.5 text-primary">
          {Array.from({ length: 5 }).map((_, j) => (
            <Star key={j} className="size-5 fill-current" />
          ))}
        </span>
        <span className="text-sm text-muted-foreground sm:text-base">
          <b className="font-heading text-foreground">5.0 בגוגל</b> · ביקורות אמיתיות מלקוחות וממומחי SEO
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

const STEPS = [
  { n: "01", t: "שיחת היכרות", d: "מבינים מה אתה צריך ולאן רוצים להגיע. בלי התחייבות, רק שיחה." },
  { n: "02", t: "אפיון ועיצוב", d: "בונים יחד את המבנה והמראה, ומלטשים עד שזה מרגיש בדיוק נכון." },
  { n: "03", t: "פיתוח", d: "אני בונה מאפס, קוד נקי ומהיר, ואתה עוקב אחרי כל שלב ב-Orion." },
  { n: "04", t: "השקה ואחריות", d: "עולים לאוויר, ואני נשאר איתך עם תחזוקה, אחריות ותמיכה." },
];

function HowItWorks() {
  const reduced = usePrefersReducedMotion();
  return (
    <Section title="איך עובדים יחד">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={reduced ? false : { opacity: 0, y: 40, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, margin: "-70px" }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 130, damping: 14 }}
            className="relative rounded-2xl border border-border bg-card p-6"
          >
            <span className="ref-gradient-text font-heading text-4xl font-black leading-none">{s.n}</span>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{s.t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

const FAQS = [
  {
    q: "כמה זה עולה?",
    a: "כל פרויקט מתומחר לפי הצרכים שלו. בשיחת ההיכרות (בלי התחייבות) נדבר על מה שאתה צריך, ותקבל הצעת מחיר מדויקת ושקופה, בלי הפתעות.",
  },
  {
    q: "כמה זמן זה לוקח?",
    a: "תלוי בהיקף. אתר תדמית בדרך כלל לוקח כמה שבועות, מערכת מורכבת יותר. תקבל לוח זמנים ברור מראש ותוכל לעקוב אחרי כל שלב ב-Orion.",
  },
  {
    q: "מה אם לא אהבתי את העיצוב?",
    a: "בדיוק בשביל זה יש סבבי אישור. אתה מאשר כל שלב לפני שממשיכים, כך שאתה אף פעם לא מופתע לרעה בסוף.",
  },
  {
    q: "האתר שלי? אני הבעלים?",
    a: "לגמרי. האתר, הדומיין והקוד הם שלך ועל שמך. אתה לא כבול אליי, ואתה חופשי לעשות בהם כרצונך.",
  },
  {
    q: "אני לא טכני, זו בעיה?",
    a: "ממש לא. אני מסביר הכל בשפה פשוטה, ו-Orion שומר את כל הקבצים, ההחלטות והשיחות מסודרים במקום אחד, כך שלא תצטרך לזכור כלום.",
  },
  {
    q: "מה אם אני מסתבך עם המערכת?",
    a: "אתה לא לבד לרגע. בתוך Orion יש הסברים מובנים שמלווים אותך בכל חלק, ופיקסל, ה-AI שלי, נמצא שם כדי לעזור לך בכל שאלה (ובהמשך גם יבצע בשבילך פעולות במערכת). ומעבר לזה, אני זמין לך באופן אישי, גם בצ'אט של המערכת וגם בוואטסאפ. אם משהו לא ברור, פשוט תשאל.",
  },
  {
    q: "מה קורה אחרי ההשקה?",
    a: "אתה לא נשאר לבד. יש חבילות תחזוקה ואחריות, ותמיד יש לך מקום אחד לפנות אליו אם משהו צריך תשומת לב.",
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section title="שאלות שנשאלות">
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQS.map((f, i) => (
          <FaqItem
            key={i}
            q={f.q}
            a={f.a}
            open={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
          />
        ))}
      </div>
    </Section>
  );
}

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 p-5 text-right"
      >
        <span className="font-heading text-base font-bold text-foreground">{q}</span>
        <span
          className={
            "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg leading-none text-primary transition-transform " +
            (open ? "rotate-45" : "")
          }
        >
          ＋
        </span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{a}</p>
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Maintenance + partner ───────────────────────── */

function Maintenance() {
  return (
    <Section title="">
      <SpotlightCard className="reveal-up mx-auto max-w-2xl rounded-2xl border border-border bg-card p-7 text-center">
        <div className="relative z-10">
          <LifeBuoy className="mx-auto size-8 text-brand-cyan-base" />
          <h3 className="mt-3 font-heading text-xl font-bold text-foreground">
            העבודה לא נגמרת בהשקה
          </h3>
          <p className="mx-auto mt-2 max-w-lg leading-relaxed text-muted-foreground">
            יש חבילות תחזוקה שדואגות שהאתר שלך תמיד מעודכן, מאובטח ועובד, בלי
            שתצטרך לחשוב על זה. אתה לא נשאר לבד אחרי שעולים לאוויר.
          </p>
        </div>
      </SpotlightCard>
    </Section>
  );
}

/** Partner-program invite — placed AFTER the lead form so it doesn't compete
 *  with the primary CTA. */
function PartnerCard() {
  return (
    <section className="reveal-up px-6 pb-20">
      <SpotlightCard className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-7">
        <HeartDraw />
        <div className="relative z-10 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:text-start">
          <div className="text-center sm:text-start">
            <Handshake className="mx-auto size-7 text-primary sm:mx-0" />
            <h3 className="mt-3 font-heading text-xl font-bold text-foreground">
              אהבת? אתה יכול גם להרוויח מזה
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              מי שמפנה אליי עסקים מקבל עמלה על כל עסקה שנסגרת. אם יש לך אנשים
              שצריכים אתר, בוא נדבר על זה.
            </p>
          </div>
        </div>
      </SpotlightCard>
    </section>
  );
}

/** A line-drawn heart that traces itself as the card scrolls into view. */
function HeartDraw() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { margin: "-80px" }); // once:false → re-draws on re-entry
  const reduced = usePrefersReducedMotion();

  return (
    <svg
      ref={ref}
      viewBox="0 0 32 29"
      className="pointer-events-none absolute -bottom-14 -left-14 z-0 size-44"
      fill="none"
      aria-hidden="true"
    >
      <motion.path
        d="M16 28C16 28 2 19.5 2 9.5C2 5 5.5 2 9 2C12 2 14.5 4 16 6.5C17.5 4 20 2 23 2C26.5 2 30 5 30 9.5C30 19.5 16 28 16 28Z"
        stroke="rgba(180, 214, 112, 0.07)"
        strokeWidth="1.25"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={inView || reduced ? { pathLength: 1 } : { pathLength: 0 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />
    </svg>
  );
}

/* ───────────────────────── Testimonials ───────────────────────── */

const REVIEWS = [
  {
    name: "ליאור שדה",
    sub: "Moving-Art · ממליץ מקומי",
    when: "לפני 13 שבועות",
    text: "הגעתי לסטודיו אורי גיא בשביל לבנות אתר וזו פשוט הייתה חוויה מעולה מתחילתה ועד סופה. השירות ברמה הכי גבוהה שיש - קשובים, סבלניים וסופר מקצועיים לאורך כל התהליך. הם הבינו בדיוק את הראש שלי והתוצאה יצאה פגז, הרבה מעבר למה שציפיתי. ממליץ בחום!",
  },
  {
    name: "יבגני סיני",
    sub: "מומחה SEO · ממליץ מקומי",
    when: "לפני 14 שבועות",
    text: "בתור מומחה SEO עבדתי עם לא מעט מתכנתים, ואורי הוא ללא ספק אחד המקצוענים הטובים ביותר שפגשתי. שילוב של הבנה טכנית עמוקה, ירידה לפרטים ויכולת להבין צרכים מורכבים. הוא לא רק 'כותב קוד' - הוא מבין את המשמעות של זה על ביצועי האתר וחוויית הגולשים. תמיד זמין, מגיב מהר, ועם פתרונות יצירתיים. ממליץ בחום!",
  },
  {
    name: "אביבית",
    sub: "ספרית כלבים, באר שבע",
    when: "לפני 14 שבועות",
    text: "פניתי לאורי במטרה שיבנה עבורי אתר. התהליך היה מהנה והסתיים בפרק זמן סביר. אורי הקשיב לבקשותיי והתאים עבורי אתר שענה על ציפיותיי. מאוד ממליצה.",
  },
  {
    name: "עומרי פרץ",
    sub: "ממליץ מקומי",
    when: "לפני 16 שבועות",
    text: "וואו אורי, אתה בן אדם מדהים, שליו, עניו וצנוע. איך הפכת לי חלום למציאות בכמה ימים זה לא אמיתי! תודה על הסבר מפורט ומדויק, על היחס והשירות האדיב, ועל המחיר. תודה רבה אלוף!!",
  },
];

function Testimonials() {
  const featured = REVIEWS[1]; // יבגני - מומחה SEO, ההמלצה הכי משכנעת
  const rest = REVIEWS.filter((_, i) => i !== 1);
  return (
    <Section title="מה לקוחות אומרים" id="reviews">
      <div className="-mt-4 mb-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="flex gap-0.5 text-primary">
          {Array.from({ length: 5 }).map((_, j) => (
            <Star key={j} className="size-4 fill-current" />
          ))}
        </span>
        5.0 · ביקורות אמיתיות מגוגל
      </div>
      {/* featured review + a 3-up row → editorial, not a flat 2×2 grid */}
      <div className="space-y-5">
        <ReviewCard {...featured} index={0} featured />
        <div className="grid gap-5 sm:grid-cols-3">
          {rest.map((r, i) => (
            <ReviewCard key={r.name} {...r} index={i + 1} />
          ))}
        </div>
      </div>
    </Section>
  );
}

function ReviewCard({
  name,
  sub,
  when,
  text,
  index,
  featured,
}: {
  name: string;
  sub: string;
  when: string;
  text: string;
  index: number;
  featured?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      initial={
        reduced
          ? false
          : { opacity: 0, y: 50, scale: 0.9, rotate: featured ? 0 : index % 2 ? 3 : -3 }
      }
      whileInView={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      viewport={{ once: false, margin: "-80px" }}
      transition={{ delay: index * 0.1, type: "spring", stiffness: 130, damping: 13 }}
      className="h-full"
    >
      <SpotlightCard
        className={
          "flex h-full flex-col rounded-2xl border border-border bg-card " +
          (featured ? "p-8 sm:p-10" : "p-7")
        }
      >
        {/* top: designed quote mark + stars + Google */}
        <div className="relative z-10 flex items-start justify-between gap-3">
          <span
            aria-hidden="true"
            className={
              "flex items-center justify-center rounded-2xl bg-primary/15 text-primary " +
              (featured ? "size-12" : "size-10")
            }
          >
            <Quote className={"fill-current " + (featured ? "size-6" : "size-5")} />
          </span>
          <div className="flex flex-col items-end gap-1.5">
            <span className="flex gap-0.5 text-primary">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star key={j} className="size-4 fill-current" />
              ))}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="flex size-4 items-center justify-center rounded-full bg-gradient-to-br from-primary to-brand-cyan-base text-[8px] font-black text-primary-foreground">
                G
              </span>
              ביקורת Google
            </span>
          </div>
        </div>

        <p
          className={
            "relative z-10 mt-5 flex-1 leading-relaxed text-foreground/90 " +
            (featured ? "text-[0.95rem] sm:text-xl" : "text-[0.95rem]")
          }
        >
          {text}
        </p>

        {/* footer: name + role + when (no avatar) */}
        <div className="relative z-10 mt-6 flex items-end justify-between gap-3 border-t border-border pt-5">
          <div>
            <p className="font-heading text-sm font-bold text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
        </div>
      </SpotlightCard>
    </motion.div>
  );
}

/* ───────────────────────── building blocks ───────────────────────── */

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="reveal-up px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        {title && (
          <h2 className="mb-10 text-center font-heading text-3xl font-black tracking-tight text-foreground sm:text-5xl">
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
    <SpotlightCard className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
      <div className="relative z-10">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform group-hover:scale-110">
          <Icon className="size-5" />
        </span>
        <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </SpotlightCard>
  );
}

/* ───────────────────────── Lead form ───────────────────────── */

function LeadForm({
  code,
  clickId,
  partnerName,
}: {
  code: string;
  clickId: React.MutableRefObject<string | null>;
  partnerName: string | null;
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
  const [agree, setAgree] = useState(false);
  const [tfToken, setTfToken] = useState("");

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setError(null);
    if (form.company) {
      setDone(true); // honeypot tripped - silently "succeed"
      return;
    }
    if (!form.name.trim()) {
      setError("צריך שם.");
      return;
    }
    if (!isPhone(form.phone.trim()) && !isEmail(form.email.trim())) {
      setError("צריך טלפון או מייל תקין כדי שאחזור אליך.");
      return;
    }
    if (!agree) {
      setError("צריך לאשר את תנאי השימוש ומדיניות הפרטיות.");
      return;
    }
    if (!tfToken) {
      setError("אנא אשרו שאינכם רובוט לפני השליחה.");
      return;
    }
    setSending(true);
    const human = await verifyTurnstile(tfToken);
    if (!human) {
      setSending(false);
      setTfToken("");
      setError("אימות האבטחה נכשל, נסו שוב.");
      return;
    }
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
      if (r.error === "duplicate")
        setError("כבר קיבלנו את הפרטים האלה, אני אחזור אליך בקרוב.");
      else if (r.error === "invalid")
        setError("צריך טלפון או מייל תקין כדי שאחזור אליך.");
      else setError("משהו השתבש. אפשר לנסות שוב או לכתוב לי בוואטסאפ.");
      return;
    }
    setDone(true);
    celebrate();
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-lg rounded-3xl border border-primary/30 bg-card px-6 py-9 text-center sm:p-10"
      >
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
            className="mt-6 inline-flex rounded-2xl bg-primary px-7 py-3 font-semibold text-primary-foreground"
          >
            וואטסאפ
          </a>
        )}
      </motion.div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-[0.85fr_1.15fr]">
      {/* left rail - pitch + value props (less banal than a lone form) */}
      <div className="reveal-up">
        {partnerName && (
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card px-4 py-1.5 text-sm text-foreground">
            <Handshake className="size-4 text-primary" />
            הופנית על־ידי <span className="font-semibold text-primary">{partnerName}</span>
          </span>
        )}
        <h2 className="font-heading text-4xl font-black leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          בוא נדבר על
          <br />
          <span className="ref-gradient-text">הפרויקט שלך.</span>
        </h2>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
          תשאיר פרטים ואני חוזר אליך, בדרך כלל באותו יום. בלי התחייבות, רק שיחה.
        </p>
        <ul className="mt-7 space-y-3">
          {["תשובה אישית באותו יום", "אתה מדבר ישירות איתי, בלי מתווכים", "הצעת מחיר מותאמת לפרויקט"].map(
            (t) => (
              <li key={t} className="flex items-center gap-3 text-foreground">
                <CheckCircle2 className="size-5 shrink-0 text-primary" />
                {t}
              </li>
            )
          )}
        </ul>
        {waLink() && (
          <a
            href={waLink()}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-7 inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 font-medium text-foreground transition-colors hover:border-primary/50"
          >
            או דברו איתי בוואטסאפ
          </a>
        )}
      </div>

      {/* the form card */}
      <div className="reveal-up rounded-3xl border border-border bg-card px-6 py-8 shadow-lift sm:p-9">
        <div className="space-y-3.5">
          <Field placeholder="שם מלא *" value={form.name} maxLength={160} onChange={(v) => update("name", v)} />
          <Field placeholder="טלפון *" dir="auto" value={form.phone} maxLength={40} onChange={(v) => update("phone", v)} />
          <Field placeholder="מייל (לא חובה)" dir="auto" type="email" value={form.email} maxLength={160} onChange={(v) => update("email", v)} />
          <select
            className="h-12 w-full rounded-xl border border-border bg-field px-4 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
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
            className="w-full rounded-xl border border-border bg-field px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="כמה מילים על הפרויקט"
            rows={3}
            value={form.message}
            maxLength={2000}
            onChange={(e) => update("message", e.target.value)}
          />
          <input
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            value={form.company}
            onChange={(e) => update("company", e.target.value)}
          />
        </div>

        {/* consent - required (Israeli Privacy Law, Amendment 13) */}
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[#B4D670]"
          />
          <span>
            קראתי ואני מאשר/ת את{" "}
            <a href={LEGAL.terms} target="_blank" rel="noreferrer noopener" className="text-primary underline">
              תנאי השימוש
            </a>{" "}
            ואת{" "}
            <a href={LEGAL.privacy} target="_blank" rel="noreferrer noopener" className="text-primary underline">
              מדיניות הפרטיות
            </a>
            , ומסכים/ה שאורי יצור איתי קשר בנוגע לפנייה.
          </span>
        </label>

        <div className="mt-4 flex justify-center">
          <TurnstileWidget onToken={setTfToken} theme="auto" />
        </div>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        <button
          onClick={submit}
          disabled={sending}
          className="group relative mt-5 w-full overflow-hidden rounded-2xl bg-primary px-7 py-4 font-semibold text-primary-foreground shadow-lift transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-60"
        >
          <span className="relative z-10">{sending ? "שולח…" : "שלח, נדבר"}</span>
          <span className="absolute inset-0 -translate-x-full bg-white/25 transition-transform duration-500 group-hover:translate-x-full" />
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          הפרטים שלך נשמרים אצלי בלבד.
        </p>
      </div>
    </div>
  );
}

function Field({
  placeholder,
  value,
  onChange,
  maxLength,
  dir,
  type,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  dir?: "ltr" | "rtl" | "auto";
  type?: string;
}) {
  return (
    <input
      className="h-12 w-full rounded-xl border border-border bg-field px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/30"
      placeholder={placeholder}
      value={value}
      maxLength={maxLength}
      dir={dir}
      type={type}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ArrowLeft } from "lucide-react";
import { signInWithGoogle } from "@/lib/auth";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DotsGrid } from "@/components/brand/DotsGrid";
import { Footer } from "@/components/layout/Footer";

export default function Login() {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-anim='mark']", { scale: 0.7, opacity: 0, duration: 0.5 })
        .from(
          "[data-anim='item']",
          { y: 16, opacity: 0, duration: 0.45, stagger: 0.08 },
          "-=0.2"
        );
    }, rootRef);
    return () => ctx.revert();
  }, [reduced]);

  async function handleSignIn() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      setError("ההתחברות נכשלה. נסה שוב.");
      setBusy(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative isolate flex h-screen items-center justify-center overflow-hidden px-6"
    >
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Interactive dots field + warm glow behind the content */}
      <DotsGrid className="-z-10" />
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
        <div data-anim="mark" className="flex flex-col items-center gap-4">
          <img
            src="/brand/logo-mark.svg"
            alt="Studio Ori Guy"
            className="h-16 w-16"
          />
          <div className="space-y-1">
            <p className="font-heading text-lg font-black text-foreground">
              Studio Ori Guy
            </p>
            <p className="text-sm text-muted-foreground">פורטל לקוחות</p>
          </div>
        </div>

        <div data-anim="item" className="space-y-4">
          <h1 className="font-heading text-3xl font-black leading-snug text-foreground lg:text-4xl">
            ברוך הבא לפורטל שלך
          </h1>
          <p className="mx-auto max-w-sm text-base leading-relaxed text-muted-foreground">
            שמח שאתה כאן. מכאן אתה עוקב אחרי הפרויקט בכל רגע, רואה איפה הדברים
            עומדים ומאשר מה שצריך. הכול במקום אחד, בלי לרדוף אחרי מיילים.
          </p>
        </div>

        <button
          data-anim="item"
          onClick={handleSignIn}
          disabled={busy}
          className="group flex w-full max-w-xs items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-start transition-colors hover:border-primary/50 disabled:opacity-60"
        >
          <span className="flex items-center gap-3">
            <GoogleIcon />
            <span className="font-medium text-foreground">
              {busy ? "מעביר ל-Google…" : "התחברות עם Google"}
            </span>
          </span>
          <ArrowLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
        </button>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <p
          data-anim="item"
          className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground"
        >
          הגישה שמורה ללקוחות שלי. אם החשבון שלך עוד לא מזוהה, שלח לי הודעה ואני
          פותח לך גישה.
        </p>

        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          הטקסטים במערכת כתובים בלשון זכר מטעמי נוחות, ומיועדים לכל המגדרים.
        </p>
      </div>

      <Footer className="absolute inset-x-0 bottom-0 z-20 justify-center border-t-0 bg-transparent text-[11px] sm:justify-between" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-white">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.38z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.1 0 5.7-1.03 7.6-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.71H1.76v2.98A11.99 11.99 0 0 0 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.6 14.71A7.2 7.2 0 0 1 5.22 12c0-.94.16-1.86.38-2.71V6.31H1.76A12 12 0 0 0 .49 12c0 1.94.46 3.77 1.27 5.39l3.84-2.68z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.68 0 3.2.58 4.39 1.71l3.29-3.29C17.7 1.19 15.1 0 12 0 7.31 0 3.26 2.69 1.76 6.31L5.6 9.29C6.5 6.59 9.02 4.75 12 4.75z"
        />
      </svg>
    </span>
  );
}

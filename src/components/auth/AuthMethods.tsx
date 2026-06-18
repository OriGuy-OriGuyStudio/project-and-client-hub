import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { signInWithGoogle, signInWithEmail } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isEmail } from "@/lib/validation";

/**
 * Login methods: Google (the preferred path) with a "התחברות עם מייל" link below
 * it that swaps the Google button for a magic-link email form (for users without
 * a Google account, e.g. a partner). Shared by the client + partner login pages.
 */
export function AuthMethods({ googleLabel = "התחברות עם Google" }: { googleLabel?: string }) {
  const [mode, setMode] = useState<"google" | "email">("google");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function google() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      setError("ההתחברות נכשלה. נסה שוב.");
      setBusy(false);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    const addr = email.trim();
    if (!isEmail(addr)) {
      setError("הכנס כתובת מייל תקינה.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await signInWithEmail(addr);
      if (r.ok) {
        setSentTo(addr);
      } else if (r.reason === "unauthorized") {
        setError("המייל הזה לא מורשה לכניסה. עדכנתי את אורי, והוא יחזור אליך.");
      } else if (r.reason === "invalid") {
        setError("כתובת מייל לא תקינה.");
      } else {
        setError("שליחת הלינק נכשלה. נסה שוב.");
      }
    } catch (err) {
      // A real send error (e.g. rate limit / SMTP) — surface the actual reason.
      const msg = err instanceof Error ? err.message : "";
      setError(msg ? `שליחת הלינק נכשלה: ${msg}` : "שליחת הלינק נכשלה. נסה שוב.");
    } finally {
      setBusy(false);
    }
  }

  // After a link is sent — confirmation state.
  if (sentTo) {
    return (
      <div data-anim="item" className="w-full max-w-xs space-y-3 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Mail className="size-6" />
        </div>
        <p className="font-medium text-foreground">שלחתי לך לינק כניסה</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          פתח את המייל שנשלח אל <span dir="ltr" className="font-medium text-foreground">{sentTo}</span> ולחץ
          על הלינק כדי להיכנס.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="text-sm text-link transition-colors hover:underline"
        >
          לא קיבלת? שליחה שוב
        </button>
      </div>
    );
  }

  // Email magic-link form.
  if (mode === "email") {
    return (
      <form onSubmit={sendLink} data-anim="item" className="w-full max-w-xs space-y-3">
        <Input
          type="email"
          dir="ltr"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          aria-label="כתובת מייל"
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "שולח…" : "שלחו לי לינק כניסה"}
        </Button>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setMode("google");
            setError(null);
          }}
          className="block w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          חזרה לכניסה עם Google
        </button>
      </form>
    );
  }

  // Default — Google button + the "login with email" link below it.
  return (
    <div data-anim="item" className="flex w-full max-w-xs flex-col items-center gap-3">
      <button
        onClick={google}
        disabled={busy}
        className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-start transition-colors hover:border-primary/50 disabled:opacity-60"
      >
        <span className="flex items-center gap-3">
          <GoogleIcon />
          <span className="font-medium text-foreground">
            {busy ? "מעביר ל-Google…" : googleLabel}
          </span>
        </span>
        <ArrowLeft className="size-4 text-muted-foreground transition-transform group-hover:-translate-x-1" />
      </button>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => setMode("email")}
        className="text-sm text-link transition-colors hover:underline"
      >
        התחברות עם מייל
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <span className="flex size-9 items-center justify-center rounded-xl bg-white">
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path fill="#4285F4" d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.38z" />
        <path fill="#34A853" d="M12 24c3.1 0 5.7-1.03 7.6-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.71H1.76v2.98A11.99 11.99 0 0 0 12 24z" />
        <path fill="#FBBC05" d="M5.6 14.71A7.2 7.2 0 0 1 5.22 12c0-.94.16-1.86.38-2.71V6.31H1.76A12 12 0 0 0 .49 12c0 1.94.46 3.77 1.27 5.39l3.84-2.68z" />
        <path fill="#EA4335" d="M12 4.75c1.68 0 3.2.58 4.39 1.71l3.29-3.29C17.7 1.19 15.1 0 12 0 7.31 0 3.26 2.69 1.76 6.31L5.6 9.29C6.5 6.59 9.02 4.75 12 4.75z" />
      </svg>
    </span>
  );
}

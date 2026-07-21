import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toastError } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const MAX_NAME_LEN = 120;

/** `get_addendum_public` projection , a token-scoped, read-only view of an
 *  addendum plus a little parent-agreement context (business/tier/client
 *  name) so the page can greet the right person. Never exposes the signature
 *  image (not needed to sign, and the public read stays minimal). */
type AddendumPublic = {
  id: string;
  title: string;
  body: string;
  status: "pending" | "signed";
  signer_name: string | null;
  gender: "male" | "female";
  created_at: string;
  signed_at: string | null;
  business: string | null;
  tier: string | null;
  client_name: string | null;
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Matches AgreementConfirmation's shell (dark, RTL, printable-width column)
 *  so a client who saw the agreement confirmation recognizes this page. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark min-h-screen overflow-x-hidden bg-background text-foreground" dir="rtl">
      <div className="mx-auto max-w-2xl px-5 py-10 sm:py-16">{children}</div>
    </div>
  );
}

function useAddendumPublic(token: string | undefined) {
  return useQuery({
    queryKey: ["addendum-public", token],
    enabled: !!token,
    queryFn: async (): Promise<AddendumPublic | null> => {
      const { data, error } = await supabase.rpc("get_addendum_public", { p_token: token! });
      if (error) throw error;
      return (data as AddendumPublic | null) ?? null;
    },
  });
}

/**
 * Public sign page for an agreement addendum, reachable at /addendum/:token
 * (no auth, token-gated , mirrors /quote/:token and /l/agreement/:accessToken).
 * A signed service agreement is a frozen snapshot; when a term needs to change
 * the studio issues a small standalone addendum with its own sign link here.
 */
export default function AddendumSign() {
  const { token } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useAddendumPublic(token);

  if (isLoading || data === undefined) {
    return (
      <Shell>
        <p className="text-muted-foreground">טוען…</p>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <h1 className="font-heading text-3xl font-black">הנספח לא נמצא</h1>
        <p className="mt-3 text-muted-foreground">
          ייתכן שהקישור שגוי או פג. אפשר לפנות אלינו ונשלח לך אותו מחדש.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="text-center">
        <p className="font-heading text-sm font-bold text-foreground">Ori Guy Studio</p>
        <h1 className="mt-3 font-heading text-3xl font-black sm:text-4xl">{data.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          נספח להסכם השירות של {data.business || data.client_name || "הלקוח"}
        </p>
      </header>

      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.body}</p>
      </div>

      {data.status === "signed" ? (
        <SignedConfirmation data={data} />
      ) : (
        <SignForm
          token={token!}
          defaultGender={data.gender}
          onSigned={() => qc.invalidateQueries({ queryKey: ["addendum-public", token] })}
        />
      )}
    </Shell>
  );
}

function SignedConfirmation({ data }: { data: AddendumPublic }) {
  return (
    <div className="mt-5 rounded-2xl border border-primary/30 bg-card p-6 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-full border border-primary/40 bg-primary/12 text-primary">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
      <p className="mt-4 font-heading text-lg font-bold text-foreground">
        הנספח נחתם ב-{data.signed_at ? fmtDateTime(data.signed_at) : fmtDateTime(data.created_at)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        נחתם על ידי {data.signer_name || "הלקוח"}
      </p>
    </div>
  );
}

function SignForm({
  token,
  defaultGender,
  onSigned,
}: {
  token: string;
  defaultGender: "male" | "female";
  onSigned: () => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">(defaultGender);
  const [approved, setApproved] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  // Stays true from a successful sign until the refetch flips the page to the
  // signed view , closes the double-submit window.
  const [justSigned, setJustSigned] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const canvasReady = useRef(false);

  const signMutation = useMutation({
    mutationFn: async (args: { signerName: string; signatureImage: string; gender: "male" | "female" }) => {
      const { data, error } = await supabase.rpc("sign_addendum", {
        p_token: token,
        p_payload: {
          signer_name: args.signerName,
          signature: args.signerName,
          signature_image: args.signatureImage,
          consent_accepted: true,
          gender: args.gender,
        },
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) throw new Error(result?.error ?? "sign_failed");
      return result;
    },
  });

  function setupCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const stroke = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
    ctx.strokeStyle = stroke || "#f2f2f6";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    canvasReady.current = true;
  }

  function posOf(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    if (!canvasReady.current) setupCanvas();
    c.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = posOf(e);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const pt = posOf(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    last.current = pt;
    if (!hasDrawn) setHasDrawn(true);
  }

  function onPointerUp() {
    drawing.current = false;
    last.current = null;
  }

  function clearSignature() {
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      ctx?.clearRect(0, 0, c.width, c.height);
    }
    setHasDrawn(false);
  }

  const busy = signMutation.isPending || justSigned;
  const canSubmit = name.trim().length > 0 && hasDrawn && approved && !busy;
  const g = useMemo(() => (m: string, f: string) => (gender === "female" ? f : m), [gender]);

  function handleSubmit() {
    if (busy) return;
    if (!name.trim()) return toastError("נא למלא שם מלא.");
    if (!hasDrawn) return toastError("נא לחתום בתיבת החתימה.");
    if (!approved) return toastError("צריך לאשר את הנספח לפני חתימה.");
    const canvas = canvasRef.current;
    const signatureImage = canvas ? canvas.toDataURL("image/png") : "";
    if (!signatureImage) return toastError("החתימה לא נקלטה, נסו שוב.");

    signMutation.mutate(
      { signerName: name.trim(), signatureImage, gender },
      {
        onSuccess: () => {
          setJustSigned(true);
          onSigned();
        },
        onError: (err) => {
          const raw = err instanceof Error ? err.message : "";
          toastError(raw.includes("already_signed") ? "הנספח כבר נחתם." : "החתימה נכשלה, נסו שוב.");
        },
      },
    );
  }

  return (
    <div className="mt-5 space-y-5 rounded-2xl border border-border bg-card p-6">
      <h2 className="font-heading text-lg font-bold text-foreground">אישור וחתימה על הנספח</h2>

      <div>
        <label htmlFor="gender-toggle" className="mb-1.5 block text-sm font-semibold text-foreground">
          פנייה
        </label>
        <div id="gender-toggle" className="flex gap-2">
          {([
            ["male", "זכר"],
            ["female", "נקבה"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              onClick={() => setGender(value)}
              className={cn(
                "min-h-10 flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50",
                gender === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/40 text-muted-foreground hover:border-primary/30",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="addendum-sign-name" className="mb-1.5 block text-sm font-semibold text-foreground">
          שם מלא
        </label>
        <Input
          id="addendum-sign-name"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LEN))}
          maxLength={MAX_NAME_LEN}
          placeholder="ישראל ישראלי"
          disabled={busy}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="addendum-sign-canvas" className="text-sm font-semibold text-foreground">
            חתימה
          </label>
          <button
            type="button"
            onClick={clearSignature}
            disabled={busy}
            className="flex min-h-10 items-center rounded-md px-2 text-sm font-semibold text-primary hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            נקה
          </button>
        </div>
        <p id="addendum-sign-canvas-help" className="sr-only">
          ציירו את החתימה בעזרת העכבר או מסך המגע.
        </p>
        <canvas
          id="addendum-sign-canvas"
          ref={canvasRef}
          role="img"
          aria-label="אזור חתימה, ציירו את החתימה עם העכבר או האצבע"
          aria-describedby="addendum-sign-canvas-help"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="h-[150px] w-full touch-none rounded-xl border border-dashed border-border bg-field focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ cursor: busy ? "default" : "crosshair" }}
        />
      </div>

      <div
        role="checkbox"
        aria-checked={approved}
        aria-disabled={busy}
        tabIndex={busy ? -1 : 0}
        onClick={() => !busy && setApproved((v) => !v)}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setApproved((v) => !v);
          }
        }}
        className={cn(
          "flex min-h-10 w-full items-start gap-3 rounded-xl border p-3.5 text-start transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          approved ? "border-primary/50 bg-primary/10" : "border-border bg-background/40 hover:border-primary/30",
          busy ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
            approved
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground bg-field text-transparent",
          )}
        >
          <Check className="size-4" />
        </span>
        <span className="text-sm text-muted-foreground">
          {g("קראתי ואני מאשר", "קראתי ואני מאשרת")} את הנספח.
        </span>
      </div>

      <Button type="button" size="lg" className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
        {signMutation.isPending ? "רגע…" : justSigned ? "נחתם ✓" : "אישור וחתימה על הנספח"}
      </Button>
    </div>
  );
}

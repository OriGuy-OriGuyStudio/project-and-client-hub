import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastError } from "@/hooks/use-toast";
import { useSignQuote } from "@/hooks/useQuotePublic";
import { celebrate } from "@/lib/confetti";
import { DEFAULT_MULTIPLIERS, shekel } from "@/lib/quote-pricing";
import { quoteTotals, type QuoteContentV2, type QuoteSelected } from "@/lib/quote-v2";
import { cn } from "@/lib/utils";
import { QuoteSection } from "./Reveal";

const MAX_NAME_LEN = 120;

/** "אישור וחתימה" , the client's final step: name + a hand-drawn signature
 *  (canvas, pointer events so it works with touch) + an explicit approval
 *  checkbox, then `sign_quote`. Mirrors v1's canvas signature pad (pointer
 *  down/move/up, devicePixelRatio scaling) since that approach already works
 *  well on touch devices. IP is captured server-side by the RPC; this
 *  component always sends `p_ip: null` (see useSignQuote). Never rendered for
 *  expired/declined/signed quotes , the parent (QuoteView) only mounts this
 *  for a live (draft/sent), not-expired quote. */
export function SignSection({
  token,
  content,
  selected,
}: {
  token: string;
  content: QuoteContentV2;
  selected: QuoteSelected;
}) {
  const qc = useQueryClient();
  const signQuote = useSignQuote();

  const [name, setName] = useState("");
  const [approved, setApproved] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  // Stays true from a successful sign until the refetch flips the page to the
  // signed view , closes the double-submit window (a second click would get an
  // English "already signed" RPC error right after a successful sign).
  const [justSigned, setJustSigned] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const canvasReady = useRef(false);

  // Same `quoteTotals` composition as PricingSection , one call, only the
  // totals-family fields are read here (never the anchor/options/chosen the
  // client isn't supposed to see).
  const totals = useMemo(
    () => quoteTotals(content, selected, DEFAULT_MULTIPLIERS, 0, () => 0),
    [content, selected],
  );
  const selectedTier = selected.maintenance_tier
    ? (content.maintenance?.tiers ?? []).find((t) => t.key === selected.maintenance_tier)
    : undefined;

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
    // Reads the current theme's foreground token (a plain hex value in
    // brand-tokens.css) so the drawn stroke matches light/dark instead of
    // hardcoding a color.
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

  const busy = signQuote.isPending || justSigned;
  const canSubmit = name.trim().length > 0 && hasDrawn && approved && !busy;

  function handleSubmit() {
    if (busy) return;
    if (!name.trim()) return toastError("נא למלא שם מלא.");
    if (!hasDrawn) return toastError("נא לחתום בתיבת החתימה.");
    if (!approved) return toastError("צריך לאשר את ההצעה והתנאים לפני חתימה.");
    const canvas = canvasRef.current;
    const signatureImage = canvas ? canvas.toDataURL("image/png") : "";
    if (!signatureImage) return toastError("החתימה לא נקלטה, נסו שוב.");

    signQuote.mutate(
      { token, name: name.trim(), signatureImage, selected },
      {
        onSuccess: () => {
          setJustSigned(true);
          celebrate();
          qc.invalidateQueries({ queryKey: ["quote-public", token] });
        },
        onError: (err) => {
          const raw = err instanceof Error ? err.message : "";
          toastError(
            raw.includes("expired")
              ? "תוקף ההצעה פג, אפשר לכתוב לי ואשלח הצעה מעודכנת."
              : raw.includes("already signed") || raw.includes("not found")
              ? "ההצעה כבר נחתמה או שאינה זמינה יותר."
              : "החתימה נכשלה, נסו שוב."
          );
        },
      },
    );
  }

  return (
    <QuoteSection id="sign" title="אישור וחתימה" intro="קראתם הכל? נשאר רק לאשר ולחתום, ומשם אני לוקח את זה.">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-center sm:p-5">
          <p className="text-xs font-medium text-muted-foreground">סה״כ לאישור</p>
          <p className="mt-1 font-heading text-2xl font-black text-primary sm:text-3xl">{shekel(totals.total)}</p>
          {selectedTier && (
            <span className="mt-2 inline-block rounded-full border border-primary/30 bg-background/60 px-3 py-1 text-xs font-semibold text-primary">
              + {selectedTier.name}: {shekel(selectedTier.price)}/חודש
            </span>
          )}
        </div>

        <div>
          <label htmlFor="sign-name" className="mb-1.5 block text-sm font-medium text-foreground">
            שם מלא
          </label>
          <Input
            id="sign-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LEN))}
            maxLength={MAX_NAME_LEN}
            placeholder="ישראל ישראלי"
            disabled={busy}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">חתימה</label>
            <button
              type="button"
              onClick={clearSignature}
              disabled={busy}
              className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              נקה
            </button>
          </div>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            className="h-[150px] w-full touch-none rounded-xl border border-dashed border-border bg-field"
            style={{ cursor: busy ? "default" : "crosshair" }}
          />
        </div>

        <button
          type="button"
          aria-pressed={approved}
          onClick={() => setApproved((v) => !v)}
          disabled={busy}
          className={cn(
            "flex w-full items-start gap-3 rounded-xl border p-3.5 text-start transition-colors",
            approved ? "border-primary/50 bg-primary/10" : "border-border bg-card hover:border-primary/30",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
              approved ? "border-primary bg-primary text-[color:var(--ink,#0a0623)]" : "border-border text-transparent",
            )}
          >
            <Check className="size-3" />
          </span>
          <span className="text-sm text-muted-foreground">קראתי את ההצעה והתנאים ואני מאשר/ת אותם.</span>
        </button>

        <Button type="button" size="lg" className="w-full" onClick={handleSubmit} disabled={!canSubmit}>
          {signQuote.isPending ? "רגע…" : justSigned ? "נחתם ✓" : "אישור וחתימה על ההצעה"}
        </Button>
      </div>
    </QuoteSection>
  );
}

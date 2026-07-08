import { ctxTitle, getDisplaySeconds, getFrac, getState } from "@/lib/timer-store";

// Real Document Picture-in-Picture: a small always-on-top window that mirrors
// the timer, updated from the same store. Chrome/Edge only — feature-detected.

export function pipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

let pipWin: Window | null = null;
let raf = 0;

function fmt(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

export async function openTimerPip(): Promise<void> {
  if (!pipSupported()) return;
  if (pipWin) {
    pipWin.focus?.();
    return;
  }
  const dpip = (window as unknown as {
    documentPictureInPicture: { requestWindow: (o: { width: number; height: number }) => Promise<Window> };
  }).documentPictureInPicture;

  pipWin = await dpip.requestWindow({ width: 220, height: 240 });
  const doc = pipWin.document;
  doc.body.style.cssText =
    "margin:0;background:#0d0c12;color:#f6f4f4;font-family:system-ui,sans-serif;display:grid;place-items:center;height:100vh;direction:rtl";

  const wrap = doc.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px";

  const ring = doc.createElement("div");
  ring.style.cssText = "position:relative;width:130px;height:130px;border-radius:50%";
  const hole = doc.createElement("div");
  hole.style.cssText = "position:absolute;inset:11px;border-radius:50%;background:#0d0c12;display:grid;place-items:center";
  const time = doc.createElement("div");
  time.style.cssText = "font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;direction:ltr";
  hole.appendChild(time);
  ring.appendChild(hole);

  const lbl = doc.createElement("div");
  lbl.style.cssText = "font-size:12px;opacity:.6;max-width:190px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";

  wrap.appendChild(ring);
  wrap.appendChild(lbl);
  doc.body.appendChild(wrap);

  const update = () => {
    if (!pipWin) return;
    const accent = getState().mode === "down" ? "#77becf" : "#b4d670";
    ring.style.background = `conic-gradient(${accent} ${getFrac() * 360}deg, rgba(246,244,244,.12) 0deg)`;
    time.style.color = accent;
    time.textContent = fmt(getDisplaySeconds());
    lbl.textContent = ctxTitle();
    raf = pipWin.requestAnimationFrame(update);
  };
  update();

  pipWin.addEventListener("pagehide", () => {
    if (raf && pipWin) pipWin.cancelAnimationFrame(raf);
    pipWin = null;
  });
}

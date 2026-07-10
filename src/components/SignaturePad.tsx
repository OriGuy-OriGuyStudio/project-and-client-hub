import { useEffect, useRef, useState } from "react";

/**
 * A real draw-to-sign pad. White "paper" with dark ink so the exported PNG is
 * visible both on the dark confirmation page and on a printed/white page.
 * Emits the signature as a data URL via onChange ("" while empty). Pointer
 * events cover mouse + touch + stylus.
 */
export function SignaturePad({
  onChange,
  hint = "חתמו כאן, באצבע או בעכבר",
}: {
  onChange: (dataUrl: string) => void;
  hint?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [empty, setEmpty] = useState(true);

  function reset() {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#141320";
  }

  useEffect(() => { reset(); }, []);

  function pos(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: React.PointerEvent) {
    e.preventDefault();
    drawing.current = true;
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ref.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!dirty.current) { dirty.current = true; setEmpty(false); }
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(dirty.current ? ref.current!.toDataURL("image/png") : "");
  }
  function clear() {
    reset();
    dirty.current = false;
    setEmpty(true);
    onChange("");
  }

  return (
    <div>
      <div className="sig-head">
        <span>חתימה</span>
        <button type="button" onClick={clear} className="sig-clear">נקה</button>
      </div>
      <div className="sig-wrap">
        <canvas
          ref={ref}
          className="sig-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
        {empty && <span className="sig-hint">{hint}</span>}
      </div>
    </div>
  );
}

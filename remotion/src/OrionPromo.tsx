import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  random,
  Easing,
} from "remotion";
import { C, HEAD, BODY } from "./theme";
import { ensureFonts } from "./load-fonts";

/* ============================================================= *
 *  Orion promo — designed motion-graphics walkthrough           *
 *  Mirrors the OrionPeek tabs on the /ref landing page          *
 * ============================================================= */

const FADE = 12; // frames for scene in/out fades

/* ---------- shared atmosphere ---------- */

const Stars: React.FC<{ count?: number }> = ({ count = 90 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const stars = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => ({
        x: random(`x${i}`) * width,
        y: random(`y${i}`) * height,
        r: random(`r${i}`) * 1.7 + 0.4,
        ph: random(`p${i}`) * Math.PI * 2,
        sp: random(`s${i}`) * 0.06 + 0.01,
        tint: random(`t${i}`) > 0.82 ? C.green : "#ffffff",
      })),
    [count, width, height],
  );
  return (
    <AbsoluteFill>
      {stars.map((s, i) => {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame * s.sp + s.ph));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              width: s.r * 2,
              height: s.r * 2,
              borderRadius: "50%",
              background: s.tint,
              opacity: tw * (s.tint === C.green ? 0.5 : 0.32),
              filter: s.tint === C.green ? "blur(0.5px)" : "none",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame * 0.012) * 40;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 800px at ${60 + drift}% -10%, ${C.purpleBase}33, transparent 60%),
                       radial-gradient(1000px 700px at ${10 - drift}% 110%, ${C.green}22, transparent 55%),
                       radial-gradient(900px 600px at 100% 100%, ${C.cyan}18, transparent 55%)`,
        }}
      />
      <Stars />
      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/* ---------- scene wrapper with fade ---------- */

const Scene: React.FC<{ durationInFrames: number; children: React.ReactNode }> = ({
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, FADE, durationInFrames - FADE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/* ---------- browser frame (mirrors the landing mock) ---------- */

const BrowserFrame: React.FC<{
  children: React.ReactNode;
  width?: number;
  appear?: number; // frame to start spring
}> = ({ children, width = 1180, appear = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear, fps, config: { damping: 18, mass: 0.7 } });
  const scale = interpolate(s, [0, 1], [0.94, 1]);
  const y = interpolate(s, [0, 1], [40, 0]);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width,
          transform: `translateY(${y}px) scale(${scale})`,
          borderRadius: 28,
          background: C.card,
          border: `1px solid ${C.border}`,
          boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        {/* chrome bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "18px 22px",
            borderBottom: `1px solid ${C.borderSoft}`,
          }}
        >
          <span style={dot("#f2545b")} />
          <span style={dot("#f5c451")} />
          <span style={dot(C.green)} />
          <div
            style={{
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: BODY,
              fontSize: 18,
              color: C.muted,
              direction: "ltr",
            }}
          >
            <Pulse />
            orion.origuystudio.com
          </div>
        </div>
        <div style={{ padding: 40 }}>{children}</div>
      </div>
    </AbsoluteFill>
  );
};

const dot = (color: string): React.CSSProperties => ({
  width: 13,
  height: 13,
  borderRadius: "50%",
  background: color,
  opacity: 0.8,
});

const Pulse: React.FC = () => {
  const frame = useCurrentFrame();
  const o = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frame * 0.2));
  return (
    <span style={{ position: "relative", width: 9, height: 9 }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: C.green,
          opacity: o * 0.6,
          transform: `scale(${1 + o})`,
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: C.green,
        }}
      />
    </span>
  );
};

/* small shared header that labels each scene */
const TabHeader: React.FC<{ eyebrow: string; title: string; delay?: number }> = ({
  eyebrow,
  title,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [delay, delay + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [delay, delay + 14], [16, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ direction: "rtl", marginBottom: 26, opacity: o, transform: `translateY(${y}px)` }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 14px",
          borderRadius: 999,
          border: `1px solid ${C.green}66`,
          background: `${C.green}14`,
          color: C.green,
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        ◆ {eyebrow}
      </span>
      <h2
        style={{
          margin: "16px 0 0",
          fontFamily: HEAD,
          fontWeight: 900,
          fontSize: 46,
          color: C.text,
          lineHeight: 1.1,
        }}
      >
        {title}
      </h2>
    </div>
  );
};

/* ============================================================= *
 *  SCENE 1 — Intro / brand reveal                               *
 * ============================================================= */

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoS = spring({ frame, fps, config: { damping: 12, mass: 0.8 } });
  const logoScale = interpolate(logoS, [0, 1], [0.4, 1]);
  const logoRot = interpolate(logoS, [0, 1], [-18, 0]);

  const wordO = interpolate(frame, [18, 34], [0, 1], { extrapolateRight: "clamp" });
  const wordY = interpolate(frame, [18, 38], [40, 0], { extrapolateRight: "clamp" });
  const tagO = interpolate(frame, [34, 50], [0, 1], { extrapolateRight: "clamp" });

  const glow = 0.5 + 0.5 * Math.sin(frame * 0.08);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            transform: `scale(${logoScale}) rotate(${logoRot}deg)`,
            filter: `drop-shadow(0 0 ${30 + glow * 30}px ${C.green}55)`,
          }}
        >
          <Img src={staticFile("brand/logo-mark.svg")} style={{ width: 150, height: 150 }} />
        </div>
        <div
          style={{
            marginTop: 38,
            fontFamily: HEAD,
            fontWeight: 900,
            fontSize: 130,
            letterSpacing: 2,
            color: C.text,
            opacity: wordO,
            transform: `translateY(${wordY}px)`,
            textShadow: `0 0 60px ${C.green}40`,
          }}
        >
          Orion
        </div>
        <div
          style={{
            marginTop: 10,
            direction: "rtl",
            fontFamily: BODY,
            fontWeight: 500,
            fontSize: 34,
            color: C.muted,
            opacity: tagO,
          }}
        >
          המערכת שלך. <span style={{ color: C.green }}>מהיום הראשון.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ============================================================= *
 *  SCENE 2 — Roadmap                                            *
 * ============================================================= */

const ROADMAP = [
  { t: "אפיון ואסטרטגיה", at: 8, fill: 1 },
  { t: "עיצוב", at: 26, fill: 1 },
  { t: "פיתוח", at: 44, fill: 0.5 },
  { t: "השקה", at: 62, fill: 0 },
];

const Roadmap: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <BrowserFrame>
      <TabHeader eyebrow="מפת דרכים" title="תמיד ברור לך באיזה שלב אנחנו." />
      <div style={{ direction: "rtl", display: "flex", flexDirection: "column", gap: 22 }}>
        {ROADMAP.map((s, i) => {
          const p = interpolate(frame, [s.at, s.at + 26], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          });
          const fillW = p * s.fill * 100;
          const done = s.fill >= 1;
          const active = s.fill > 0 && s.fill < 1;
          const checkO = done ? interpolate(frame, [s.at + 18, s.at + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
          return (
            <div key={s.t} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  flexShrink: 0,
                  background: done ? C.green : "transparent",
                  color: done ? C.ink : active ? C.green : C.faint,
                  border: done ? "none" : `2px solid ${active ? C.green : C.border}`,
                  transform: `scale(${done ? 0.6 + 0.4 * checkO + 0.06 * Math.sin(checkO * Math.PI) : 1})`,
                }}
              >
                {done ? "✓" : ""}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 14,
                  borderRadius: 999,
                  background: C.bgDeep,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${fillW}%`,
                    borderRadius: 999,
                    background: done
                      ? `linear-gradient(90deg, ${C.greenDark}, ${C.green})`
                      : `linear-gradient(90deg, ${C.greenDark}cc, ${C.green}cc)`,
                  }}
                />
              </div>
              <span
                style={{
                  width: 230,
                  fontFamily: BODY,
                  fontWeight: 500,
                  fontSize: 24,
                  color: active ? C.green : done ? C.text : C.muted,
                }}
              >
                {s.t}
              </span>
            </div>
          );
        })}
      </div>
    </BrowserFrame>
  );
};

/* ============================================================= *
 *  SCENE 3 — Approve + confetti                                 *
 * ============================================================= */

const Confetti: React.FC<{ start: number }> = ({ start }) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  const pieces = useMemo(
    () =>
      new Array(70).fill(0).map((_, i) => ({
        angle: random(`a${i}`) * Math.PI * 2,
        speed: random(`v${i}`) * 16 + 8,
        size: random(`s${i}`) * 10 + 6,
        rot: random(`r${i}`) * 360,
        color: [C.green, C.cyan, C.purple, C.greenLight, "#f5c451"][Math.floor(random(`c${i}`) * 5)],
        spin: (random(`sp${i}`) - 0.5) * 30,
      })),
    [],
  );
  if (local < 0) return null;
  const t = local;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ position: "relative" }}>
        {pieces.map((p, i) => {
          const dist = p.speed * t;
          const x = Math.cos(p.angle) * dist;
          const y = Math.sin(p.angle) * dist + 0.45 * t * t; // gravity
          const o = interpolate(local, [0, 8, 40, 60], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: p.size,
                height: p.size * 0.5,
                background: p.color,
                opacity: o,
                borderRadius: 2,
                transform: `rotate(${p.rot + p.spin * t}deg)`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const CLICK_AT = 40;

const Approve: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // cursor travels to the approve button, then a press dip
  const travel = interpolate(frame, [10, CLICK_AT], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const cx = interpolate(travel, [0, 1], [360, 90]);
  const cy = interpolate(travel, [0, 1], [220, 150]);
  const press = frame >= CLICK_AT && frame < CLICK_AT + 8 ? 0.86 : 1;
  const approved = frame >= CLICK_AT + 6;
  const flipS = spring({ frame: frame - CLICK_AT - 6, fps, config: { damping: 14 } });

  return (
    <BrowserFrame>
      <TabHeader eyebrow="אישורים" title="אתה מאשר שלבים בלחיצה." />
      <div style={{ direction: "rtl", position: "relative", maxWidth: 720 }}>
        <div
          style={{
            borderRadius: 20,
            border: `1px solid ${approved ? `${C.green}66` : C.border}`,
            background: approved ? `${C.green}10` : C.bgDeep,
            padding: 30,
          }}
        >
          <p style={{ margin: 0, fontFamily: BODY, fontWeight: 800, fontSize: 28, color: C.text }}>
            עיצוב עמוד הבית
          </p>
          <p style={{ margin: "10px 0 0", fontFamily: BODY, fontSize: 22, color: approved ? C.green : C.muted }}>
            {approved ? "אושר על ידך ✓" : "מחכה לאישור שלך"}
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 24, alignItems: "center" }}>
            <span
              style={{
                padding: "12px 28px",
                borderRadius: 14,
                background: C.green,
                color: C.ink,
                fontFamily: BODY,
                fontWeight: 800,
                fontSize: 22,
                transform: `scale(${press})`,
                opacity: approved ? interpolate(flipS, [0, 1], [1, 0.5]) : 1,
              }}
            >
              אישור ✓
            </span>
            <span
              style={{
                padding: "12px 28px",
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                color: C.muted,
                fontFamily: BODY,
                fontSize: 22,
              }}
            >
              בקשת שינוי
            </span>
          </div>
        </div>

        {/* cursor */}
        <div
          style={{
            position: "absolute",
            left: cx,
            top: cy,
            transform: `scale(${press === 1 ? 1 : 0.9})`,
            transition: "none",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.5))",
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path d="M5 3l14 7-6 2-2 6-6-15z" fill="#fff" stroke={C.ink} strokeWidth="1.2" />
          </svg>
        </div>
      </div>
      <Confetti start={CLICK_AT + 4} />
    </BrowserFrame>
  );
};

/* ============================================================= *
 *  SCENE 4 — Chat (Pixel)                                       *
 * ============================================================= */

const Bubble: React.FC<{
  appear: number;
  side: "me" | "them";
  children: React.ReactNode;
  accent?: boolean;
}> = ({ appear, side, children, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - appear, fps, config: { damping: 16, mass: 0.6 } });
  const o = interpolate(s, [0, 1], [0, 1]);
  const y = interpolate(s, [0, 1], [18, 0]);
  const me = side === "me";
  return (
    <div
      style={{
        alignSelf: me ? "flex-start" : "flex-end", // RTL: me (client) on the right visually -> flex-start in rtl row
        maxWidth: "78%",
        opacity: o,
        transform: `translateY(${y}px)`,
        padding: "16px 22px",
        borderRadius: 22,
        borderTopRightRadius: me ? 6 : 22,
        borderTopLeftRadius: me ? 22 : 6,
        fontFamily: BODY,
        fontSize: 24,
        lineHeight: 1.4,
        background: me ? C.green : accent ? `${C.green}0d` : C.bgDeep,
        color: me ? C.ink : C.text,
        border: me ? "none" : `1px solid ${accent ? `${C.green}55` : C.border}`,
      }}
    >
      {children}
    </div>
  );
};

const Typing: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span style={{ color: C.green }}>✦</span> פיקסל מקליד
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: C.muted,
            opacity: 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(frame * 0.3 - d)),
          }}
        />
      ))}
    </span>
  );
};

const Chat: React.FC = () => {
  const frame = useCurrentFrame();
  const showReply = frame >= 92;
  return (
    <BrowserFrame>
      <TabHeader eyebrow="צ'אט" title="אתה מדבר איתי במקום אחד." />
      <div
        style={{
          direction: "rtl",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxWidth: 820,
        }}
      >
        <Bubble appear={6} side="me">
          מתי עולים לאוויר?
        </Bubble>
        <Bubble appear={30} side="them">
          השלב האחרון בפיתוח. סוף השבוע אתה מאשר, ואנחנו באוויר 🚀
        </Bubble>
        {!showReply ? (
          <div
            style={{
              alignSelf: "flex-end",
              padding: "14px 20px",
              borderRadius: 22,
              borderTopLeftRadius: 6,
              background: `${C.green}0d`,
              border: `1px solid ${C.green}44`,
              color: C.muted,
              fontFamily: BODY,
              fontSize: 22,
            }}
          >
            <Typing />
          </div>
        ) : (
          <Bubble appear={92} side="them" accent>
            <span style={{ color: C.green }}>✦ פיקסל:</span> בינתיים ריכזתי לך את כל הקבצים
            וההחלטות בלשונית אחת. הכול מסודר 👌
          </Bubble>
        )}
      </div>
    </BrowserFrame>
  );
};

/* ============================================================= *
 *  SCENE 5 — Files                                              *
 * ============================================================= */

const FILES = [
  { n: "לוגו-סופי.svg", c: C.green },
  { n: "מסמך-אפיון.pdf", c: C.cyan },
  { n: "תמונות-אתר.zip", c: C.purple },
  { n: "חוזה.pdf", c: C.greenDark },
];

const Files: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <BrowserFrame>
      <TabHeader eyebrow="קבצים" title="כל הקבצים במקום אחד." />
      <div
        style={{
          direction: "rtl",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          maxWidth: 820,
        }}
      >
        {FILES.map((f, i) => {
          const s = spring({ frame: frame - 8 - i * 8, fps, config: { damping: 15, mass: 0.6 } });
          const o = interpolate(s, [0, 1], [0, 1]);
          const sc = interpolate(s, [0, 1], [0.8, 1]);
          return (
            <div
              key={f.n}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 20,
                borderRadius: 18,
                background: C.bgDeep,
                border: `1px solid ${C.border}`,
                opacity: o,
                transform: `scale(${sc})`,
              }}
            >
              <span
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: `${f.c}33`,
                  border: `1px solid ${f.c}66`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontFamily: BODY, fontSize: 24, color: C.text }}>{f.n}</span>
            </div>
          );
        })}
      </div>
    </BrowserFrame>
  );
};

/* ============================================================= *
 *  SCENE 6 — Outro / CTA                                        *
 * ============================================================= */

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14 } });
  const scale = interpolate(s, [0, 1], [0.7, 1]);
  const lineO = interpolate(frame, [16, 30], [0, 1], { extrapolateRight: "clamp" });
  const urlO = interpolate(frame, [28, 44], [0, 1], { extrapolateRight: "clamp" });
  const glow = 0.5 + 0.5 * Math.sin(frame * 0.1);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `scale(${scale})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Img
            src={staticFile("brand/logo-mark.svg")}
            style={{ width: 88, height: 88, filter: `drop-shadow(0 0 ${20 + glow * 20}px ${C.green}55)` }}
          />
          <span style={{ fontFamily: HEAD, fontWeight: 900, fontSize: 96, color: C.text }}>Orion</span>
        </div>
        <div
          style={{
            direction: "rtl",
            marginTop: 18,
            fontFamily: BODY,
            fontWeight: 500,
            fontSize: 36,
            color: C.muted,
            opacity: lineO,
          }}
        >
          נבנה בשבילך. <span style={{ color: C.green }}>מאפס.</span>
        </div>
        <div
          style={{
            marginTop: 30,
            opacity: urlO,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 28px",
            borderRadius: 999,
            border: `1px solid ${C.green}66`,
            background: `${C.green}12`,
            fontFamily: BODY,
            fontSize: 26,
            color: C.green,
            direction: "ltr",
          }}
        >
          <Pulse /> orion.origuystudio.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ============================================================= *
 *  Composition                                                  *
 * ============================================================= */

export const OrionPromo: React.FC = () => {
  ensureFonts();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop />
      <Sequence durationInFrames={96} name="Intro">
        <Scene durationInFrames={96}>
          <Intro />
        </Scene>
      </Sequence>
      <Sequence from={96} durationInFrames={180} name="Roadmap">
        <Scene durationInFrames={180}>
          <Roadmap />
        </Scene>
      </Sequence>
      <Sequence from={276} durationInFrames={150} name="Approve">
        <Scene durationInFrames={150}>
          <Approve />
        </Scene>
      </Sequence>
      <Sequence from={426} durationInFrames={150} name="Chat">
        <Scene durationInFrames={150}>
          <Chat />
        </Scene>
      </Sequence>
      <Sequence from={576} durationInFrames={120} name="Files">
        <Scene durationInFrames={120}>
          <Files />
        </Scene>
      </Sequence>
      <Sequence from={696} durationInFrames={84} name="Outro">
        <Scene durationInFrames={84}>
          <Outro />
        </Scene>
      </Sequence>
    </AbsoluteFill>
  );
};

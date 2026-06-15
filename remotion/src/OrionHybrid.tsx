import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  OffthreadVideo,
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
import { Backdrop, Intro, Outro } from "./OrionPromo";

/* ============================================================= *
 *  Orion HYBRID (cinematic) — real screen recordings of the     *
 *  Orion client portal, composited inside the brand browser     *
 *  frame with camera motion, 3D entrances, a light sweep,       *
 *  accent glow, kinetic captions, grain + a music bed.          *
 * ============================================================= */

const FADE = 14;

/* ---------- cinematic scene wrapper (scale + blur dolly) ---------- */

const Scene: React.FC<{ durationInFrames: number; children: React.ReactNode }> = ({
  durationInFrames,
  children,
}) => {
  const frame = useCurrentFrame();
  const d = durationInFrames;
  const opacity = interpolate(frame, [0, FADE, d - FADE, d], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, FADE, d - FADE, d], [1.05, 1, 1, 0.985], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const blur = interpolate(frame, [0, FADE, d - FADE, d], [9, 0, 0, 6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})`, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

/* ---------- kinetic caption (eyebrow + masked title wipe) ---------- */

const Caption: React.FC<{ eyebrow: string; title: string; accent: string }> = ({
  eyebrow,
  title,
  accent,
}) => {
  const frame = useCurrentFrame();
  const eb = interpolate(frame, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ebY = interpolate(frame, [4, 16], [14, 0], { extrapolateRight: "clamp" });
  // RTL wipe: reveal from inline-start (right) to end (left)
  const wipe = interpolate(frame, [12, 34], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const titleY = interpolate(frame, [12, 34], [22, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ direction: "rtl", textAlign: "center" }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 16px",
          borderRadius: 999,
          border: `1px solid ${accent}66`,
          background: `${accent}16`,
          color: accent,
          fontFamily: BODY,
          fontWeight: 600,
          fontSize: 20,
          opacity: eb,
          transform: `translateY(${ebY}px)`,
        }}
      >
        ◆ {eyebrow}
      </span>
      <h2
        style={{
          margin: "12px 0 0",
          fontFamily: HEAD,
          fontWeight: 900,
          fontSize: 46,
          color: C.text,
          lineHeight: 1.1,
          transform: `translateY(${titleY}px)`,
          clipPath: `inset(0 0 0 ${100 - wipe}%)`,
        }}
      >
        {title}
      </h2>
    </div>
  );
};

/* ---------- the brand browser window wrapping a recording ---------- */

const VideoBrowser: React.FC<{
  src: string;
  trimBefore: number;
  dur: number;
  accent: string;
  playbackRate?: number;
  punch?: [number, number]; // optional extra zoom window [startFrame, endFrame]
}> = ({ src, trimBefore, dur, accent, playbackRate = 1, punch }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // entrance: rise + slight 3D tilt settling to flat
  const s = spring({ frame, fps, config: { damping: 18, mass: 0.8 } });
  const y = interpolate(s, [0, 1], [40, 0]);
  const rotX = interpolate(s, [0, 1], [7, 0]);
  const rotY = interpolate(s, [0, 1], [-9, 0]);
  const entScale = interpolate(s, [0, 1], [0.93, 1]);

  // gentle continuous float for life
  const floatY = Math.sin(frame * 0.03) * 5;

  // Ken Burns on the footage
  const t = dur > 0 ? frame / dur : 0;
  let kb = interpolate(t, [0, 1], [1.0, 1.07]);
  const panX = interpolate(t, [0, 1], [0, -14]);
  if (punch) {
    const pz = interpolate(frame, [punch[0], (punch[0] + punch[1]) / 2, punch[1]], [0, 1, 0.6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    kb += pz * 0.06;
  }

  // light sweep across the glass on entrance
  const sweep = interpolate(frame, [8, 46], [-130, 230], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const sweepO = interpolate(frame, [8, 27, 46], [0, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frame * 0.05));

  return (
    <div style={{ perspective: 1700, perspectiveOrigin: "50% 30%" }}>
      <div
        style={{
          position: "relative",
          width: 1300,
          transform: `translateY(${y + floatY}px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${entScale})`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* accent glow behind the window */}
        <div
          style={{
            position: "absolute",
            inset: -90,
            borderRadius: 60,
            background: `radial-gradient(60% 60% at 50% 45%, ${accent}55, transparent 70%)`,
            filter: "blur(60px)",
            opacity: glow,
            transform: "translateZ(-60px)",
          }}
        />
        <div
          style={{
            position: "relative",
            borderRadius: 24,
            background: C.card,
            border: `1px solid ${C.border}`,
            boxShadow: `0 50px 130px rgba(0,0,0,0.6), 0 0 0 1px ${accent}22`,
            overflow: "hidden",
          }}
        >
          {/* chrome bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "0 20px",
              height: 56,
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
                fontSize: 17,
                color: C.muted,
                direction: "ltr",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
              orion.origuystudio.com
            </div>
          </div>

          {/* footage with Ken Burns */}
          <div style={{ width: 1300, height: 812, overflow: "hidden", background: "#0d0c12" }}>
            <OffthreadVideo
              src={staticFile(src)}
              trimBefore={trimBefore}
              playbackRate={playbackRate}
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${kb}) translateX(${panX}px)`,
              }}
            />
          </div>

          {/* light sweep */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.16) 50%, transparent 62%)`,
              transform: `translateX(${sweep}%)`,
              opacity: sweepO,
            }}
          />
        </div>
      </div>
    </div>
  );
};

const dot = (color: string): React.CSSProperties => ({
  width: 13,
  height: 13,
  borderRadius: "50%",
  background: color,
  opacity: 0.85,
});

/* ---------- a full feature scene = caption + window ---------- */

const FeatureScene: React.FC<{
  eyebrow: string;
  title: string;
  src: string;
  trimBefore: number;
  dur: number;
  accent: string;
  playbackRate?: number;
  punch?: [number, number];
}> = (p) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      gap: 30,
      padding: "32px 0",
    }}
  >
    <Caption eyebrow={p.eyebrow} title={p.title} accent={p.accent} />
    <VideoBrowser
      src={p.src}
      trimBefore={p.trimBefore}
      dur={p.dur}
      accent={p.accent}
      playbackRate={p.playbackRate}
      punch={p.punch}
    />
  </AbsoluteFill>
);

/* ---------- foreground atmosphere: drifting brand dust ---------- */

const Dust: React.FC = () => {
  const frame = useCurrentFrame();
  const bits = useMemo(
    () =>
      new Array(18).fill(0).map((_, i) => ({
        x: random(`dx${i}`) * 1920,
        y0: random(`dy${i}`) * 1080,
        r: random(`dr${i}`) * 4 + 1.5,
        sp: random(`ds${i}`) * 0.5 + 0.25,
        sway: random(`dw${i}`) * 60 + 20,
        color: random(`dc${i}`) > 0.5 ? C.green : C.cyan,
        ph: random(`dp${i}`) * Math.PI * 2,
      })),
    [],
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {bits.map((b, i) => {
        const y = (b.y0 - frame * b.sp) % 1140;
        const yy = y < -20 ? y + 1140 : y;
        const x = b.x + Math.sin(frame * 0.02 + b.ph) * b.sway;
        const o = 0.12 + 0.12 * (0.5 + 0.5 * Math.sin(frame * 0.04 + b.ph));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: yy,
              width: b.r * 2,
              height: b.r * 2,
              borderRadius: "50%",
              background: b.color,
              opacity: o,
              filter: "blur(1.5px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
  );

const Overlay: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* film grain */}
      <AbsoluteFill
        style={{
          backgroundImage: `url("${GRAIN}")`,
          backgroundSize: "300px 300px",
          backgroundPosition: `${(frame * 7) % 300}px ${(frame * 11) % 300}px`,
          opacity: 0.05,
          mixBlendMode: "overlay",
        }}
      />
      {/* cinematic vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 100% at 50% 45%, transparent 52%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/* ============================================================= *
 *  Timeline                                                     *
 * ============================================================= */

type Block =
  | { kind: "intro"; dur: number }
  | { kind: "outro"; dur: number }
  | {
      kind: "feature";
      dur: number;
      eyebrow: string;
      title: string;
      src: string;
      trimBefore: number;
      accent: string;
      playbackRate?: number;
      punch?: [number, number];
    };

const BLOCKS: Block[] = [
  { kind: "intro", dur: 66 },
  {
    kind: "feature",
    dur: 144,
    eyebrow: "כניסה",
    title: "הפורטל שלך נפתח.",
    src: "raw/00-login.mp4",
    trimBefore: 25,
    accent: C.cyan,
  },
  {
    kind: "feature",
    dur: 156,
    eyebrow: "הפרויקט שלך",
    title: "הכול במקום אחד, בזמן אמת.",
    src: "raw/05-overview.mp4",
    trimBefore: 0,
    accent: C.green,
    playbackRate: 1.2,
  },
  {
    kind: "feature",
    dur: 144,
    eyebrow: "מפת דרכים",
    title: "תמיד ברור לך באיזה שלב.",
    src: "raw/01-roadmap.mp4",
    trimBefore: 45,
    accent: C.purple,
  },
  {
    kind: "feature",
    dur: 180,
    eyebrow: "אישורים",
    title: "אישור בלחיצה אחת.",
    src: "raw/02-approve.mp4",
    trimBefore: 70,
    accent: C.green,
    punch: [90, 165],
  },
  {
    kind: "feature",
    dur: 144,
    eyebrow: "קבצים",
    title: "כל הקבצים מסודרים.",
    src: "raw/04-files.mp4",
    trimBefore: 170,
    accent: C.cyan,
    playbackRate: 1.15,
  },
  { kind: "outro", dur: 96 },
];

export const HYBRID_DURATION = BLOCKS.reduce((a, b) => a + b.dur, 0);

export const OrionHybrid: React.FC<{ track?: string }> = ({
  track = "audio/orion-cinematic.mp3",
}) => {
  ensureFonts();
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Audio
        src={staticFile(track)}
        volume={(f) =>
          interpolate(f, [0, 24, HYBRID_DURATION - 60, HYBRID_DURATION], [0, 0.85, 0.85, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Backdrop />
      {BLOCKS.map((b, i) => {
        const start = from;
        from += b.dur;
        return (
          <Sequence
            key={i}
            from={start}
            durationInFrames={b.dur}
            name={b.kind === "feature" ? b.eyebrow : b.kind}
          >
            <Scene durationInFrames={b.dur}>
              {b.kind === "intro" ? (
                <Intro />
              ) : b.kind === "outro" ? (
                <Outro />
              ) : (
                <FeatureScene
                  eyebrow={b.eyebrow}
                  title={b.title}
                  src={b.src}
                  trimBefore={b.trimBefore}
                  dur={b.dur}
                  accent={b.accent}
                  playbackRate={b.playbackRate}
                  punch={b.punch}
                />
              )}
            </Scene>
          </Sequence>
        );
      })}
      <Dust />
      <Overlay />
    </AbsoluteFill>
  );
};

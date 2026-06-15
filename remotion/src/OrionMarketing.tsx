import React from "react";
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
  Easing,
} from "remotion";
import { C, HEAD, BODY } from "./theme";
import { ensureFonts } from "./load-fonts";
import { Backdrop } from "./OrionPromo";

/* ============================================================= *
 *  Orion MARKETING — punchy, After-Effects-style cut:           *
 *  kinetic title hook → skewed feature clips with whip          *
 *  transitions (beat energy) → Ori's real logo sting outro.     *
 * ============================================================= */

/* ---------- whip transition wrapper (directional slide+blur) ---------- */

const Whip: React.FC<{
  durationInFrames: number;
  dir?: number; // +1 enters from start side, -1 from end side
  children: React.ReactNode;
}> = ({ durationInFrames, dir = 1, children }) => {
  const frame = useCurrentFrame();
  const d = durationInFrames;
  const IN = 11;
  const OUT = 10;
  const opacity = interpolate(frame, [0, IN, d - OUT, d], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(
    frame,
    [0, IN, d - OUT, d],
    [dir * 220, 0, 0, -dir * 220],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );
  const blur = interpolate(frame, [0, IN, d - OUT, d], [16, 0, 0, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rot = interpolate(frame, [0, IN, d - OUT, d], [dir * 3, 0, 0, -dir * 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ opacity, transform: `translateX(${x}px) rotate(${rot}deg)`, filter: `blur(${blur}px)` }}
    >
      {children}
    </AbsoluteFill>
  );
};

const dot = (color: string): React.CSSProperties => ({
  width: 12,
  height: 12,
  borderRadius: "50%",
  background: color,
  opacity: 0.85,
});

/* ---------- skewed browser window with a recording ---------- */

const SkewScene: React.FC<{
  eyebrow: string;
  title: string;
  src: string;
  trimBefore: number;
  dur: number;
  accent: string;
  skew: number; // target rotateY degrees (signed)
  playbackRate?: number;
  punch?: [number, number];
}> = ({ eyebrow, title, src, trimBefore, dur, accent, skew, playbackRate = 1, punch }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const s = spring({ frame, fps, config: { damping: 16, mass: 0.7 } });
  // start strongly skewed/tilted, settle toward a gentle readable angle
  const rotY = interpolate(s, [0, 1], [skew * 1.8, skew * 0.45]);
  const rotZ = interpolate(s, [0, 1], [-Math.sign(skew) * 4, -Math.sign(skew) * 1.2]);
  const entScale = interpolate(s, [0, 1], [0.86, 1]);
  const floatY = Math.sin(frame * 0.04) * 6;

  // Ken Burns + punch
  const t = dur > 0 ? frame / dur : 0;
  let kb = interpolate(t, [0, 1], [1.02, 1.09]);
  if (punch) {
    kb += interpolate(frame, [punch[0], (punch[0] + punch[1]) / 2, punch[1]], [0, 1, 0.6], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * 0.06;
  }

  const sweep = interpolate(frame, [6, 40], [-130, 230], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const sweepO = interpolate(frame, [6, 23, 40], [0, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame * 0.06));

  // caption
  const capO = interpolate(frame, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wipe = interpolate(frame, [8, 28], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 26 }}>
      {/* caption */}
      <div style={{ direction: "rtl", textAlign: "center", zIndex: 2 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 15px",
            borderRadius: 999,
            border: `1px solid ${accent}66`,
            background: `${accent}16`,
            color: accent,
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: 19,
            opacity: capO,
          }}
        >
          ◆ {eyebrow}
        </span>
        <h2
          style={{
            margin: "10px 0 0",
            fontFamily: HEAD,
            fontWeight: 900,
            fontSize: 42,
            color: C.text,
            clipPath: `inset(0 0 0 ${100 - wipe}%)`,
          }}
        >
          {title}
        </h2>
      </div>

      {/* skewed window */}
      <div style={{ perspective: 1500, perspectiveOrigin: "50% 40%" }}>
        <div
          style={{
            position: "relative",
            width: 1180,
            transform: `translateY(${floatY}px) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${entScale})`,
            transformStyle: "preserve-3d",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -80,
              borderRadius: 60,
              background: `radial-gradient(60% 60% at 50% 45%, ${accent}55, transparent 70%)`,
              filter: "blur(55px)",
              opacity: glow,
              transform: "translateZ(-60px)",
            }}
          />
          <div
            style={{
              position: "relative",
              borderRadius: 22,
              background: C.card,
              border: `1px solid ${C.border}`,
              boxShadow: `0 50px 130px rgba(0,0,0,0.6), 0 0 0 1px ${accent}22`,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 18px",
                height: 50,
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
                  gap: 9,
                  fontFamily: BODY,
                  fontSize: 16,
                  color: C.muted,
                  direction: "ltr",
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
                orion.origuystudio.com
              </div>
            </div>
            <div style={{ width: 1180, height: 737, overflow: "hidden", background: "#0d0c12" }}>
              <OffthreadVideo
                src={staticFile(src)}
                trimBefore={trimBefore}
                playbackRate={playbackRate}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: `linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.18) 50%, transparent 62%)`,
                transform: `translateX(${sweep}%)`,
                opacity: sweepO,
              }}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- kinetic marketing title ---------- */

const MarketingTitle: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ebO = interpolate(frame, [2, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hs = spring({ frame: frame - 6, fps, config: { damping: 13, mass: 0.7 } });
  const hScale = interpolate(hs, [0, 1], [1.25, 1]);
  const hSkew = interpolate(hs, [0, 1], [-12, 0]);
  const hO = interpolate(frame, [6, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tagWipe = interpolate(frame, [26, 48], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const glow = 0.5 + 0.5 * Math.sin(frame * 0.1);

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ direction: "rtl", textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            padding: "7px 18px",
            borderRadius: 999,
            border: `1px solid ${C.green}66`,
            background: `${C.green}14`,
            color: C.green,
            fontFamily: BODY,
            fontWeight: 600,
            fontSize: 24,
            opacity: ebO,
            letterSpacing: 1,
          }}
        >
          סטודיו אורי גיא
        </span>
        <div
          style={{
            marginTop: 22,
            fontFamily: HEAD,
            fontWeight: 900,
            fontSize: 150,
            lineHeight: 1,
            color: C.text,
            opacity: hO,
            transform: `scale(${hScale}) skewX(${hSkew}deg)`,
            textShadow: `0 0 70px ${C.green}${Math.round(glow * 40)
              .toString(16)
              .padStart(2, "0")}`,
          }}
        >
          Orion
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: BODY,
            fontWeight: 500,
            fontSize: 38,
            color: C.muted,
            clipPath: `inset(0 0 0 ${100 - tagWipe}%)`,
          }}
        >
          המערכת שמלווה אותך <span style={{ color: C.green }}>מהיום הראשון.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Ori's real logo sting (9:16) as full-bleed outro ---------- */

const LogoOutro: React.FC<{ trimBefore: number }> = ({ trimBefore }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const src = staticFile("raw/end-logo.mp4");
  return (
    <AbsoluteFill style={{ background: "#0d0c12", opacity: o }}>
      {/* blurred fill so the portrait clip covers the 16:9 frame seamlessly */}
      <OffthreadVideo
        src={src}
        trimBefore={trimBefore}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", filter: "blur(45px) brightness(0.45)" }}
      />
      {/* sharp, contained logo sting */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <OffthreadVideo
          src={src}
          trimBefore={trimBefore}
          muted
          style={{ height: "100%", width: "auto", objectFit: "contain" }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ============================================================= *
 *  Timeline                                                     *
 * ============================================================= */

type Block =
  | { kind: "title"; dur: number }
  | { kind: "logo"; dur: number; trimBefore: number }
  | {
      kind: "feature";
      dur: number;
      dir: number;
      eyebrow: string;
      title: string;
      src: string;
      trimBefore: number;
      accent: string;
      skew: number;
      playbackRate?: number;
      punch?: [number, number];
    };

const BLOCKS: Block[] = [
  { kind: "title", dur: 75 },
  {
    kind: "feature",
    dur: 108,
    dir: 1,
    eyebrow: "כניסה",
    title: "הפורטל שלך נפתח.",
    src: "raw/00-login.mp4",
    trimBefore: 30,
    accent: C.cyan,
    skew: -16,
  },
  {
    kind: "feature",
    dur: 120,
    dir: -1,
    eyebrow: "הפרויקט שלך",
    title: "הכול במקום אחד.",
    src: "raw/05-overview.mp4",
    trimBefore: 30,
    accent: C.green,
    skew: 16,
    playbackRate: 1.3,
  },
  {
    kind: "feature",
    dur: 108,
    dir: 1,
    eyebrow: "מפת דרכים",
    title: "תמיד ברור לך איפה הכול עומד.",
    src: "raw/01-roadmap.mp4",
    trimBefore: 60,
    accent: C.purple,
    skew: -16,
  },
  {
    kind: "feature",
    dur: 150,
    dir: -1,
    eyebrow: "אישורים",
    title: "אישור בלחיצה אחת.",
    src: "raw/02-approve.mp4",
    trimBefore: 80,
    accent: C.green,
    skew: 13,
    punch: [70, 140],
  },
  {
    kind: "feature",
    dur: 108,
    dir: 1,
    eyebrow: "קבצים",
    title: "כל הקבצים מסודרים.",
    src: "raw/04-files.mp4",
    trimBefore: 180,
    accent: C.cyan,
    skew: -16,
    playbackRate: 1.2,
  },
  { kind: "logo", dur: 165, trimBefore: 100 },
];

export const MARKETING_DURATION = BLOCKS.reduce((a, b) => a + b.dur, 0);

export const OrionMarketing: React.FC<{ track?: string }> = ({
  track = "audio/orion-upbeat-claps.mp3",
}) => {
  ensureFonts();
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Audio
        src={staticFile(track)}
        volume={(f) =>
          interpolate(f, [0, 20, MARKETING_DURATION - 50, MARKETING_DURATION], [0, 0.9, 0.9, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <Backdrop />
      {BLOCKS.map((b, i) => {
        const start = from;
        from += b.dur;
        const dir = b.kind === "feature" ? b.dir : 1;
        return (
          <Sequence key={i} from={start} durationInFrames={b.dur} name={b.kind}>
            <Whip durationInFrames={b.dur} dir={dir}>
              {b.kind === "title" ? (
                <MarketingTitle />
              ) : b.kind === "logo" ? (
                <LogoOutro trimBefore={b.trimBefore} />
              ) : (
                <SkewScene
                  eyebrow={b.eyebrow}
                  title={b.title}
                  src={b.src}
                  trimBefore={b.trimBefore}
                  dur={b.dur}
                  accent={b.accent}
                  skew={b.skew}
                  playbackRate={b.playbackRate}
                  punch={b.punch}
                />
              )}
            </Whip>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

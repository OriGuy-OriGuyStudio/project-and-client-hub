# Orion promo video (Remotion)

A designed motion-graphics walkthrough of the **Orion** client portal, built for the
`data-orion-video-slot` (16:9) on the partner referral landing page
([src/pages/public/RefLanding.tsx](../src/pages/public/RefLanding.tsx) → `OrionPeek`).

This is **not** a screen recording — every scene is rebuilt in React with the real brand
tokens (green `#b4d670`, dark `#0d0c12`) and the actual brand fonts (Kaha / Diplomat,
copied into `public/fonts`). It mirrors the interactive `ORION_TABS` on the landing page:
intro → roadmap → approve+confetti → Pixel chat → files → CTA.

## Run

```bash
cd remotion
npm install
npm run dev        # Remotion Studio (live preview at localhost:3000)
npm run render     # → out/orion-promo.mp4  (1920×1080, h264, ~26s)
```

`npm run render:webm` also exists for a VP8 webm.

## Wiring into the landing page

After rendering, the clip is hosted on the public Supabase `portfolio` bucket
(same place as the portfolio videos) and wired into `OrionPeek`'s video slot as a
muted autoplay-in-view `<video>`. Re-render and re-upload to update it.

## Structure

- `src/Root.tsx` — composition registration (`OrionPromo`, 1920×1080, 30fps).
- `src/OrionPromo.tsx` — all scenes (Backdrop, BrowserFrame, Intro, Roadmap, Approve, Chat, Files, Outro).
- `src/theme.ts` — brand colors + font family names.
- `src/load-fonts.ts` — loads the local woff2 brand fonts via `delayRender`.
- `public/fonts`, `public/brand` — assets mirrored from the app's `public/`.

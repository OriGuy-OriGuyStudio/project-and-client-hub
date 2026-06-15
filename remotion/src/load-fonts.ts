import { staticFile, delayRender, continueRender } from "remotion";

const FONTS: { family: string; file: string; weight: string }[] = [
  { family: "Kaha", file: "fonts/kaha-black.woff2", weight: "900" },
  { family: "Kaha", file: "fonts/kaha-regular.woff2", weight: "400" },
  { family: "Kaha", file: "fonts/kaha-light.woff2", weight: "300" },
  { family: "Diplomat", file: "fonts/diplomat-extrabold.woff2", weight: "800" },
  { family: "Diplomat", file: "fonts/diplomat-medium.woff2", weight: "500" },
  { family: "Diplomat", file: "fonts/diplomat-regular.woff2", weight: "400" },
  { family: "Diplomat", file: "fonts/diplomat-light.woff2", weight: "300" },
];

let started = false;

export function ensureFonts() {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("load-brand-fonts");
  Promise.all(
    FONTS.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(f.file)})`, {
        weight: f.weight,
        style: "normal",
      });
      await face.load();
      document.fonts.add(face);
    }),
  )
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
}

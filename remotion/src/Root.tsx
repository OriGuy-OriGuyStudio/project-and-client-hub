import { Composition } from "remotion";
import { OrionPromo } from "./OrionPromo";
import { OrionHybrid, HYBRID_DURATION } from "./OrionHybrid";
import { OrionMarketing, MARKETING_DURATION } from "./OrionMarketing";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OrionMarketing"
        component={OrionMarketing}
        durationInFrames={MARKETING_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ track: "audio/orion-upbeat-claps.mp3" }}
      />
      <Composition
        id="OrionHybrid"
        component={OrionHybrid}
        durationInFrames={HYBRID_DURATION}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ track: "audio/orion-cinematic.mp3" }}
      />
      <Composition
        id="OrionPromo"
        component={OrionPromo}
        durationInFrames={26 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      {/* Square cut for social, same scenes re-laid-out by the component via props later. */}
    </>
  );
};

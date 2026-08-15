import React from "react";
import { Composition } from "remotion";
import { DURATION_FRAMES, FPS, HEIGHT, WIDTH } from "../lib/types";
import { Reel } from "./Reel";
import { TestComp } from "./TestComp";
import { mockReelProps } from "./mockProps";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* The product. 28.0s, always. Duration is enforced here, never by script length. */}
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={DURATION_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={mockReelProps}
      />

      {/* Phase 0 smoke test: proves the renderer + ffmpeg pipeline works end to end. */}
      <Composition
        id="TestComp"
        component={TestComp}
        durationInFrames={30}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{}}
      />
    </>
  );
};

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/** 1-second smoke test comp — proves renderMedia + ffmpeg work. Phase 0 only. */
export const TestComp: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10, 20, 30], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0b09",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ opacity, color: "#e9dcc5", fontSize: 54, letterSpacing: 2 }}>PastForward</div>
      <div style={{ opacity, color: "#8a7f6d", fontSize: 22, letterSpacing: 8, marginTop: 12 }}>
        RENDER OK
      </div>
    </AbsoluteFill>
  );
};

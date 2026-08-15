import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * 3–7 word kinetic caption (skills.md §10), entering ~4 frames after the cut.
 * Captions COMPLEMENT the narration — they never transcribe it.
 * Words stagger in so the line reads as typography, not a subtitle.
 */
export const CaptionBlock: React.FC<{
  text: string;
  delay?: number;
  size?: number;
}> = ({ text, delay = 4, size = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0 10px",
        fontFamily: "Inter, Helvetica, Arial, sans-serif",
        fontSize: size,
        fontWeight: 500,
        color: "#f2ece0",
        letterSpacing: -0.2,
        lineHeight: 1.28,
        textShadow: "0 2px 18px rgba(0,0,0,0.7)",
      }}
    >
      {words.map((w, i) => {
        const f = frame - delay - i * 2.5;
        const s = spring({ frame: f, fps, config: { damping: 200, mass: 0.42 }, durationInFrames: 12 });
        return (
          <span
            key={`${w}-${i}`}
            style={{
              display: "inline-block",
              opacity: interpolate(f, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(s, [0, 1], [16, 0])}px)`,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

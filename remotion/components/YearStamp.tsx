import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Huge Playfair year (skills.md §6). Quick scale-in, then holds.
 * ALL text is code-rendered — AI never renders text (skills.md §14.3).
 */
export const YearStamp: React.FC<{
  year: string;
  delay?: number;
  align?: "left" | "center";
}> = ({ year, delay = 4, align = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - delay;

  const s = spring({ frame: f, fps, config: { damping: 200, mass: 0.5 }, durationInFrames: 14 });
  const scale = interpolate(s, [0, 1], [1.14, 1]);
  const opacity = interpolate(f, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(s, [0, 1], [14, 0]);

  return (
    <div
      style={{
        fontFamily: "Playfair Display, Georgia, serif",
        fontSize: 92,
        fontWeight: 700,
        lineHeight: 0.95,
        color: "#f4ecdd",
        letterSpacing: -2,
        opacity,
        transform: `scale(${scale}) translateY(${rise}px)`,
        transformOrigin: align === "center" ? "50% 50%" : "0% 50%",
        textShadow: "0 3px 26px rgba(0,0,0,0.65)",
        textAlign: align,
      }}
    >
      {year}
    </div>
  );
};

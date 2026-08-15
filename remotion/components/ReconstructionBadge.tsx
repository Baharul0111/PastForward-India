import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

/**
 * skills.md §12 — reconstructions are ALWAYS labelled in-frame.
 * Admitting the reconstruction is what makes the product more trustworthy, not
 * less, so this badge is never conditional and never subtle enough to miss.
 */
export const ReconstructionBadge: React.FC<{ year: string; delay?: number }> = ({ year, delay = 8 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 44,
        left: 34,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 13px",
        borderRadius: 999,
        border: "1px solid rgba(233,184,120,0.45)",
        background: "rgba(12,9,6,0.55)",
        backdropFilter: "blur(6px)",
        opacity,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#e9b878",
          display: "block",
          flex: "none",
        }}
      />
      <span
        style={{
          fontFamily: "Inter, Helvetica, Arial, sans-serif",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 1.7,
          color: "rgba(244,236,221,0.92)",
          whiteSpace: "nowrap",
        }}
      >
        HISTORICAL RECONSTRUCTION · {year}
      </span>
    </div>
  );
};

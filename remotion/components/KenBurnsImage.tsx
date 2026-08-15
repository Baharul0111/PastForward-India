import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { KenBurnsDirection } from "../../lib/types";

/**
 * Pan/zoom on a still (skills.md §6). Direction varies per shot — never two
 * identical moves in a row; the sequence is fixed in SHOT_TEMPLATE.
 *
 * `origin` biases the zoom toward a meaningful detail so the move means
 * something instead of just being motion.
 */
export const KenBurnsImage: React.FC<{
  src: string;
  direction: KenBurnsDirection;
  strength?: number;
  origin?: string;
  /** progress easing is linear on purpose — constant drift reads as a dolly, eased reads as a slideshow */
  className?: string;
}> = ({ src, direction, strength = 0.14, origin = "50% 45%" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Always overscan so a pan never exposes an edge.
  const overscan = 1 + strength * 2;

  let scale = overscan;
  let x = 0;
  let y = 0;
  const travel = strength * 100; // in % of the overscan margin

  switch (direction) {
    case "in":
      scale = overscan + strength * t;
      break;
    case "out":
      scale = overscan + strength * (1 - t);
      break;
    case "left":
      x = interpolate(t, [0, 1], [travel * 0.5, -travel * 0.5]);
      break;
    case "right":
      x = interpolate(t, [0, 1], [-travel * 0.5, travel * 0.5]);
      break;
  }

  // A touch of vertical drift on horizontal moves — pure lateral pans feel mechanical.
  if (direction === "left" || direction === "right") {
    y = interpolate(t, [0, 1], [travel * 0.1, -travel * 0.1]);
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transformOrigin: origin,
          transform: `scale(${scale}) translate(${x}px, ${y}px)`,
          willChange: "transform",
        }}
      />
    </AbsoluteFill>
  );
};

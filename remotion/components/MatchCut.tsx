import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Shot 7, the signature moment (skills.md §3, architecture.md §9).
 * The old view scales/settles toward the user photo's composition and
 * cross-dissolves into it over 12 frames, on a whoosh.
 *
 * The two images are deliberately kept on the SAME transform ramp through the
 * dissolve — that shared motion is what sells it as one continuous view of one
 * place across 800 years, rather than two pictures fading.
 */
export const MatchCut: React.FC<{
  oldSrc: string;
  todaySrc: string;
  /** frame within this 4s shot where the dissolve starts */
  dissolveAt?: number;
  dissolveFrames?: number;
}> = ({ oldSrc, todaySrc, dissolveAt, dissolveFrames = 14 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Dissolve at ~63% of the shot, whatever its length — the old view holds long
  // enough to read before it becomes today.
  const dissolveStart = dissolveAt ?? Math.round(durationInFrames * 0.63);

  const t = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // One continuous slow push shared by both layers.
  const scale = interpolate(t, [0, 1], [1.16, 1.03]);
  const drift = interpolate(t, [0, 1], [10, -6]);

  const mix = interpolate(frame, [dissolveStart, dissolveStart + dissolveFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // A brief light-lift through the dissolve reads as time passing, not a fade.
  const bloom = interpolate(
    frame,
    [dissolveStart, dissolveStart + dissolveFrames / 2, dissolveStart + dissolveFrames],
    [0, 0.22, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const layer: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${scale}) translateY(${drift}px)`,
    transformOrigin: "50% 45%",
    willChange: "transform, opacity",
  };

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: 1 - mix, filter: "sepia(0.5) contrast(1.05) brightness(0.95)" }}>
        <Img src={oldSrc} style={layer} />
      </AbsoluteFill>

      <AbsoluteFill style={{ opacity: mix }}>
        <Img src={todaySrc} style={layer} />
      </AbsoluteFill>

      <AbsoluteFill style={{ background: "#fff", opacity: bloom, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

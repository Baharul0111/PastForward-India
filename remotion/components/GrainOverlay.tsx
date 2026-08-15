import React from "react";
import { AbsoluteFill, random, staticFile, useCurrentFrame } from "remotion";

/**
 * 35mm grain on EVERY frame (skills.md §6, §14.5).
 *
 * A 256px tileable noise plate is offset by a new random amount a few times a
 * second. Real grain reseeds; it does not crawl — so the offset jumps rather
 * than animating. This replaced a per-frame feTurbulence filter that looked
 * identical and cost ~90s of extra render time per reel.
 */
export const GrainOverlay: React.FC<{ opacity?: number }> = ({ opacity = 0.08 }) => {
  const frame = useCurrentFrame();

  // Reseed every 2 frames: faster reads as video noise, slower reads as a static texture.
  const step = Math.floor(frame / 2);
  const x = Math.floor(random(`gx-${step}`) * 256);
  const y = Math.floor(random(`gy-${step}`) * 256);

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        opacity,
        mixBlendMode: "overlay",
        backgroundImage: `url(${staticFile("mock/grain.png")})`,
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
        backgroundPosition: `${x}px ${y}px`,
      }}
    />
  );
};

/** Static vignette — pairs with the grain to kill the flat "AI render" look. */
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.5 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse 78% 62% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

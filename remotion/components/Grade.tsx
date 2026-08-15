import React from "react";
import { AbsoluteFill } from "remotion";
import type { Grade as GradeName } from "../../lib/types";
import { Vignette } from "./GrainOverlay";

/**
 * Per-era colour grade (architecture.md §9, skills.md §6).
 * One consistent visual language is what separates "a documentary" from
 * "a pile of AI images".
 */
const FILTERS: Record<GradeName, string> = {
  modern: "saturate(1.02) contrast(1.02)",
  archival: "sepia(0.55) contrast(1.05) brightness(0.96)",
  parchment: "sepia(0.3) contrast(1.02) brightness(1.02)",
  reconstruction: "saturate(0.85) contrast(1.08)",
};

/** Parchment sits on a paper ground; the others sit on black. */
const BACKDROPS: Record<GradeName, string> = {
  modern: "#000",
  archival: "#0b0906",
  parchment: "#d9cdb0",
  reconstruction: "#0a0705",
};

export const Grade: React.FC<{
  grade: GradeName;
  children: React.ReactNode;
}> = ({ grade, children }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: BACKDROPS[grade] }}>
      <AbsoluteFill style={{ filter: FILTERS[grade] }}>{children}</AbsoluteFill>

      {/* Warm archival wash — a flat sepia filter alone still reads as a filter. */}
      {grade === "archival" && (
        <AbsoluteFill
          style={{
            background: "linear-gradient(180deg, rgba(120,84,42,0.16), rgba(40,26,12,0.26))",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      )}

      {grade === "parchment" && (
        <AbsoluteFill
          style={{
            background: "radial-gradient(ellipse at 50% 40%, rgba(255,247,224,0.25), rgba(120,96,58,0.30))",
            mixBlendMode: "multiply",
            pointerEvents: "none",
          }}
        />
      )}

      {grade === "reconstruction" && <Vignette strength={0.58} />}
      {grade !== "reconstruction" && <Vignette strength={0.42} />}
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * skills.md §3 shot 8 — the takeaway (Playfair) then the brand line.
 * 2.0 seconds total, so the takeaway gets the first beat and the brand the last.
 */
export const EndCard: React.FC<{ takeaway: string }> = ({ takeaway }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const lines = takeaway.split(/(?<=\.)\s+/).filter(Boolean);

  const brandF = frame - 26;
  const brandS = spring({ frame: brandF, fps, config: { damping: 200, mass: 0.5 }, durationInFrames: 14 });
  const brandOpacity = interpolate(brandF, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0b0906",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 56px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        {lines.map((line, i) => {
          const f = frame - 3 - i * 7;
          const s = spring({ frame: f, fps, config: { damping: 200, mass: 0.5 }, durationInFrames: 15 });
          return (
            <div
              key={`${line}-${i}`}
              style={{
                fontFamily: "Playfair Display, Georgia, serif",
                fontSize: 50,
                fontWeight: 700,
                lineHeight: 1.16,
                color: "#f4ecdd",
                letterSpacing: -0.8,
                opacity: interpolate(f, [0, 7], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                transform: `translateY(${interpolate(s, [0, 1], [20, 0])}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* Sits clear of the completed timeline bar (which occupies bottom ~74–140). */}
      <div
        style={{
          position: "absolute",
          bottom: 208,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: brandOpacity,
          transform: `translateY(${interpolate(brandS, [0, 1], [12, 0])}px)`,
        }}
      >
        <div
          style={{
            width: 48,
            height: 1,
            background: "rgba(233,184,120,0.7)",
            margin: "0 auto 20px",
          }}
        />
        <div
          style={{
            fontFamily: "Inter, Helvetica, Arial, sans-serif",
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: 5.2,
            color: "#e9b878",
          }}
        >
          PASTFORWARD INDIA
        </div>
        <div
          style={{
            fontFamily: "Inter, Helvetica, Arial, sans-serif",
            fontSize: 14,
            letterSpacing: 0.4,
            color: "rgba(242,236,224,0.82)",
            marginTop: 11,
          }}
        >
          You are standing inside history.
        </div>
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  DURATION_FRAMES,
  FPS,
  SHOT_TEMPLATE,
  type ReelProps,
  type Shot,
  type ShotAsset,
  VO_LEAD_IN,
  SORA_CLIP_SECONDS,
  DURATION_SECONDS,
} from "../lib/types";
import { CaptionBlock } from "./components/CaptionBlock";
import { EndCard } from "./components/EndCard";
import { Grade } from "./components/Grade";
import { GrainOverlay } from "./components/GrainOverlay";
import { KenBurnsImage } from "./components/KenBurnsImage";
import { MatchCut } from "./components/MatchCut";
import { ReconstructionBadge } from "./components/ReconstructionBadge";
import { TimelineBar } from "./components/TimelineBar";
import { YearStamp } from "./components/YearStamp";

const SERIF = "Playfair Display, Georgia, serif";
const SANS = "Inter, Helvetica, Arial, sans-serif";

/** Remotion needs staticFile() for /public paths, but tolerates absolute/remote URLs. */
const src = (p: string | undefined | null): string | null => {
  if (!p) return null;
  if (p.startsWith("http") || p.startsWith("data:")) return p;
  return staticFile(p.replace(/^\//, ""));
};

/* ------------------------------------------------------------------ */
/* Shot 1 — the hook over the viewer's own photo                       */
/* ------------------------------------------------------------------ */

const HookShot: React.FC<{ shot: Shot; asset?: ShotAsset; name: string; city: string; hook: string }> = ({
  shot,
  asset,
  name,
  city,
  hook,
}) => {
  const frame = useCurrentFrame();
  const image = src(asset?.src);

  return (
    <AbsoluteFill>
      {image && (
        <KenBurnsImage src={image} direction={shot.visual.kenBurns.direction} strength={shot.visual.kenBurns.strength} />
      )}
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.10) 38%, rgba(0,0,0,0.30) 100%)",
        }}
      />

      <div style={{ position: "absolute", top: 118, left: 34, right: 34 }}>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 0.98,
            color: "#f4ecdd",
            letterSpacing: -1.6,
            textShadow: "0 3px 30px rgba(0,0,0,0.7)",
            opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `translateY(${interpolate(frame, [0, 14], [16, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}px)`,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: SANS,
            fontSize: 13,
            letterSpacing: 4.4,
            color: "rgba(233,184,120,0.95)",
            marginTop: 13,
            textTransform: "uppercase",
            opacity: interpolate(frame, [6, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          {city}
        </div>
      </div>

      {/* the hook — the line that creates the question */}
      <div style={{ position: "absolute", left: 34, right: 34, bottom: 210 }}>
        <CaptionBlock text={hook} delay={16} size={31} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Shots 2, 4, 6 — archival plates                                     */
/* Shots 3, 5     — reconstructions (badged)                           */
/* ------------------------------------------------------------------ */

const PlateShot: React.FC<{ shot: Shot; asset?: ShotAsset }> = ({ shot, asset }) => {
  const isReconstruction = shot.type === "RECONSTRUCTION";
  // The window is longer than the clip, so play it slower to fill it exactly.
  // Slow-motion on a reconstruction reads as intentional documentary style.
  const windowSeconds = shot.end - shot.start;
  const playbackRate = Math.min(1, SORA_CLIP_SECONDS / windowSeconds);
  const year = shot.caption.year;

  // A successful Sora clip is video; everything else (archival plate, or the
  // approved still when Sora failed) is a stone image under Ken Burns.
  const isVideo = asset?.src?.toLowerCase().endsWith(".mp4") ?? false;
  const media = src(isVideo ? asset?.src : (asset?.src ?? asset?.stillSrc));

  return (
    <AbsoluteFill>
      {media && isVideo && (
        // Sora audio is ALWAYS muted — the soundtrack is built (skills.md §9).
        <OffthreadVideo
          src={media}
          muted
          playbackRate={playbackRate}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {media && !isVideo && (
        <KenBurnsImage
          src={media}
          direction={shot.visual.kenBurns.direction}
          strength={shot.visual.kenBurns.strength}
          origin={isReconstruction ? "50% 40%" : "50% 45%"}
        />
      )}

      {isReconstruction && year && <ReconstructionBadge year={year} />}

      <div style={{ position: "absolute", left: 34, right: 34, bottom: 200 }}>
        {year && !isReconstruction && (
          <div style={{ marginBottom: 12 }}>
            <YearStamp year={year} delay={4} />
          </div>
        )}
        <CaptionBlock text={shot.caption.text} delay={isReconstruction ? 6 : 12} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Shot 7 — match cut to today                                         */
/* ------------------------------------------------------------------ */

const MatchCutShot: React.FC<{ shot: Shot; oldAsset?: ShotAsset; todayAsset?: ShotAsset }> = ({
  shot,
  oldAsset,
  todayAsset,
}) => {
  const oldSrc = src(oldAsset?.src);
  const todaySrc = src(todayAsset?.src);

  return (
    <AbsoluteFill>
      {oldSrc && todaySrc && <MatchCut oldSrc={oldSrc} todaySrc={todaySrc} />}
      <div style={{ position: "absolute", left: 34, right: 34, bottom: 200 }}>
        <CaptionBlock text={shot.caption.text} delay={Math.round((shot.end - shot.start) * FPS * 0.72)} />
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* The reel                                                            */
/* ------------------------------------------------------------------ */

export const Reel: React.FC<ReelProps> = ({ plan, assets, audio }) => {
  const globalFrame = useCurrentFrame();
  const assetFor = (id: number) => assets.shots.find((s) => s.shotId === id);

  const music = src(audio.music);
  const whoosh = src(audio.whoosh);
  const stone = src(audio.stone);
  const ambience = src(audio.ambience);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* ---------- picture ---------- */}
      {plan.shots.map((shot) => {
        const tpl = SHOT_TEMPLATE.find((t) => t.id === shot.id)!;
        const from = Math.round(tpl.start * FPS);
        const durationInFrames = Math.round((tpl.end - tpl.start) * FPS);

        return (
          <Sequence key={shot.id} from={from} durationInFrames={durationInFrames} name={`Shot ${shot.id} · ${shot.type}`}>
            <Grade grade={tpl.grade}>
              {shot.type === "USER_PHOTO" && (
                <HookShot
                  shot={shot}
                  asset={assetFor(1)}
                  name={plan.monument.name}
                  city={plan.monument.city}
                  hook={plan.hook}
                />
              )}

              {(shot.type === "ARCHIVAL" ||
                shot.type === "RECONSTRUCTION" ||
                shot.type === "MOTION_GRAPHIC") && <PlateShot shot={shot} asset={assetFor(shot.id)} />}

              {shot.type === "MATCH_CUT" && (
                <MatchCutShot shot={shot} oldAsset={assetFor(6)} todayAsset={assetFor(7) ?? assetFor(1)} />
              )}

              {shot.type === "END_CARD" && <EndCard takeaway={plan.takeaway} />}
            </Grade>
          </Sequence>
        );
      })}

      {/* ---------- the identity: timeline bar on every shot but the end card ---------- */}
      {globalFrame < SHOT_TEMPLATE[7].start * FPS ? (
        <TimelineBar plan={plan} globalFrame={globalFrame} />
      ) : (
        <TimelineBar plan={plan} globalFrame={globalFrame} completed />
      )}

      {/* ---------- grain on EVERY frame ---------- */}
      <GrainOverlay opacity={0.08} />

      {/* ---------- sound (skills.md §9) ---------- */}
      {/* Per-shot VO. These sit at the ROOT with NO durationInFrames, so a
          sentence can never be truncated by its shot's window — a line that runs
          a little past the cut is a J-cut, which documentaries do deliberately.
          Overlap is prevented upstream instead: lib/assets.ts time-compresses
          any clip longer than its window. VO enters VO_LEAD_IN after the cut. */}
      {plan.shots.map((shot, i) => {
        const clip = src(assets.vo[i]);
        if (!clip) return null;
        const tpl = SHOT_TEMPLATE.find((t) => t.id === shot.id)!;
        return (
          <Sequence
            key={`vo-${shot.id}`}
            from={Math.round((tpl.start + VO_LEAD_IN) * FPS)}
            name={`VO ${shot.id}`}
          >
            <Audio src={clip} />
          </Sequence>
        );
      })}

      {/* music bed, ducked under VO */}
      {music && (
        <Audio
          src={music}
          loop
          volume={(f) =>
            // 0.12 normally, ducked to 0.05 while narration is running (2.5s–26s),
            // lifted again for the end card.
            f < 2.2 * FPS
              ? interpolate(f, [0, 2.2 * FPS], [0, 0.12], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
              : f < SHOT_TEMPLATE[7].start * FPS
                ? 0.05
                : interpolate(
                    f,
                    [SHOT_TEMPLATE[7].start * FPS, (SHOT_TEMPLATE[7].start + 1) * FPS, DURATION_FRAMES],
                    [0.05, 0.13, 0.0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  )
          }
        />
      )}

      {/* SFX stingers, one per shot, per shot.sfx */}
      {plan.shots.map((shot) => {
        const tpl = SHOT_TEMPLATE.find((t) => t.id === shot.id)!;
        const kind = tpl.sfx;
        if (kind === "none") return null;
        const file = kind === "whoosh" ? whoosh : kind === "stone" ? stone : ambience;
        if (!file) return null;
        // Ceilings: SFX ≤ 0.18, stone taps ≤ 0.12. Loud stingers are what made
        // the old mix feel jarring.
        const peak = kind === "stone" ? 0.12 : kind === "whoosh" ? 0.18 : 0.14;
        const len = Math.round((tpl.end - tpl.start) * FPS);
        return (
          <Sequence
            key={`sfx-${shot.id}`}
            from={Math.round(tpl.start * FPS)}
            durationInFrames={len}
            name={`SFX ${shot.id} · ${kind}`}
          >
            {/* 5-frame fade in/out envelope so nothing ever clicks in or cuts off */}
            <Audio
              src={file}
              volume={(f) =>
                interpolate(f, [0, 5, Math.max(6, len - 5), len], [0, peak, peak, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              }
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

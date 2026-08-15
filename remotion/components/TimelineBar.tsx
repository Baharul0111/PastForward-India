import React from "react";
import { AbsoluteFill, interpolate, spring, useVideoConfig } from "remotion";
import { FPS, SHOT_TEMPLATE, type ReelPlan } from "../../lib/types";

/**
 * THE IDENTITY (skills.md §6). Bottom 10–15%, present on every shot; completes
 * on the end card. `1199 ●━━━━━━━━━━━○ 2026`
 *
 * The dot is driven by the SHOT being watched, not raw time — so it lands
 * exactly on the year being narrated, snaps on shot 4, sweeps to 2026 on shot 7.
 */

const SERIF = "Playfair Display, Georgia, serif";
const SANS = "Inter, Helvetica, Arial, sans-serif";
const GOLD = "#e9b878";

/** First 4-digit year in a string: "c. 1230" → 1230, "1220s" → 1220. */
/**
 * A monument's caption years are bare numbers ("1199"), but a lake's and an
 * animal's are prose — "Post-glacial", "Prehistoric", "17th century",
 * "c. 16,500 BP", "Today". A bare /\d{3,4}/ mis-reads most of them: it skips the
 * "16" in "16,500" and returns 500, and it finds nothing at all in "17th
 * century", which then pins the shot to the start of the timeline. Dal Lake's
 * bar ran backwards and sat frozen through three shots because of exactly this.
 */
function yearOf(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.toLowerCase();

  // "Today"/"present" is the end of the story; deep past is the beginning.
  if (/\btoday\b|\bpresent\b|\bnow\b|\bmodern\b/.test(t)) return 2026;
  if (/\bprehistor|post-?glacial|pleistocene|holocene|ancient|\bbp\b|years ago/.test(t)) return -100_000;

  // "17th century" → 1650. Do this BEFORE the digit scan, or it reads "17".
  const century = t.match(/(\d{1,2})(?:st|nd|rd|th)\s+century/);
  if (century) {
    const c = Number(century[1]);
    const bce = /\bbce?\b|\bb\.c\./.test(t);
    return bce ? -((c - 1) * 100 + 50) : (c - 1) * 100 + 50;
  }

  // "1,200 BCE" / "10,000 BCE" — strip the separators first so the digits group.
  const bce = /\bbce?\b|\bb\.c\./.test(t);
  const m = t.replace(/(\d),(\d)/g, "$1$2").match(/\d{3,5}/);
  if (!m) return null;
  const y = Number(m[0]);
  return bce ? -y : y;
}

/**
 * Which timeline event a shot stands on — derived from the shot's own caption
 * year, not a hardcoded table, so it stays correct for every monument.
 * The dot sits on the latest event that has already happened by that year.
 */
function eventIndexForShot(shot: { id: number; year?: string }, years: (number | null)[]): number {
  const n = years.length;
  if (shot.id >= 7) return n - 1; // to today
  // Shot 1 is the hook over the viewer's own photo — the story has not started,
  // so the dot belongs at the beginning whatever the caption says. Without this,
  // a caption year of "2026" (which a present-tense hook naturally produces)
  // sweeps the bar to the end before the reel has begun, then snaps backwards.
  if (shot.id === 1) return 0;
  const y = yearOf(shot.year);

  // Undateable caption: advance with the story rather than snapping to the
  // start. Shots 2–6 are the narrative middle, so spread them across the events.
  // Pinning them all to 0 is what left Dal Lake's dot frozen at "LAKE FORMATION"
  // while the narration was already describing 19th-century houseboats.
  if (y === null) {
    return Math.min(n - 1, Math.max(0, Math.round(((shot.id - 2) / 4) * (n - 1))));
  }

  let idx = 0;
  for (let i = 0; i < n; i++) {
    const ey = years[i];
    if (ey !== null && ey <= y) idx = i;
  }
  return Math.min(Math.max(idx, 0), n - 1);
}

/**
 * How much of the label to shift left, as a fraction of its own width.
 * 0 at the far left (left-aligned), 0.5 through the middle (centred on the dot),
 * 1 at the far right (right-aligned) — so it never overflows the track.
 */
function labelAnchor(pos: number): number {
  const edge = 0.18;
  if (pos <= edge) return interpolate(pos, [0, edge], [0, 0.5], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (pos >= 1 - edge)
    return interpolate(pos, [1 - edge, 1], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return 0.5;
}

export const TimelineBar: React.FC<{
  plan: ReelPlan;
  /** absolute frame within the 840-frame reel */
  globalFrame: number;
  completed?: boolean;
}> = ({ plan, globalFrame, completed = false }) => {
  useVideoConfig();
  const events = plan.timeline.events;
  const n = events.length;
  const lastIdx = Math.max(1, n - 1);

  const seconds = globalFrame / FPS;
  const shot = SHOT_TEMPLATE.find((s) => seconds >= s.start && seconds < s.end) ?? SHOT_TEMPLATE[0];

  const eventYears = events.map((e) => yearOf(e.year));
  const capYear = (id: number) => plan.shots.find((s) => s.id === id)?.caption.year;

  const targetIdx = completed ? n - 1 : eventIndexForShot({ id: shot.id, year: capYear(shot.id) }, eventYears);
  const prevShotId = Math.max(1, shot.id - 1);
  const prevIdx = completed
    ? n - 1
    : eventIndexForShot({ id: prevShotId, year: capYear(prevShotId) }, eventYears);
  const framesIntoShot = globalFrame - shot.start * FPS;

  // The snap at the top of each shot IS the timeline-jump beat (shot 4) and the
  // sweep to today (shot 7) — a longer, heavier spring on 7.
  const isSweep = shot.id === 7;
  const settle = spring({
    frame: framesIntoShot,
    fps: FPS,
    config: { damping: 200, mass: isSweep ? 1.7 : 0.6 },
    durationInFrames: isSweep ? 22 : 12,
  });

  const pos = completed
    ? 1
    : interpolate(settle, [0, 1], [prevIdx / lastIdx, targetIdx / lastIdx], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });

  const dot = (i: number) => i / lastIdx <= pos + 0.001;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* scrim keeps the bar legible over bright archival plates */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 240,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.82) 100%)",
        }}
      />

      <div style={{ position: "absolute", left: 34, right: 34, bottom: 74 }}>
        {/* bookend years */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
          <span style={{ fontFamily: SERIF, fontSize: 22, color: "rgba(242,236,224,0.9)" }}>
            {plan.timeline.startYear}
          </span>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 22,
              color: completed ? GOLD : "rgba(242,236,224,0.5)",
            }}
          >
            {events[n - 1]?.year ?? "2026"}
          </span>
        </div>

        {/* track */}
        <div style={{ position: "relative", height: 2 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(242,236,224,0.26)", borderRadius: 2 }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: 2,
              width: `${pos * 100}%`,
              background: GOLD,
              borderRadius: 2,
            }}
          />

          {events.map((e, i) => (
            <div
              key={`${e.year}-${i}`}
              style={{
                position: "absolute",
                left: `${(i / lastIdx) * 100}%`,
                top: -3,
                width: 8,
                height: 8,
                marginLeft: -4,
                borderRadius: "50%",
                background: dot(i) ? GOLD : "rgba(242,236,224,0.34)",
              }}
            />
          ))}

          <div
            style={{
              position: "absolute",
              left: `${pos * 100}%`,
              top: -7,
              width: 16,
              height: 16,
              marginLeft: -8,
              borderRadius: "50%",
              background: GOLD,
              boxShadow: "0 0 0 5px rgba(233,184,120,0.22), 0 0 18px rgba(233,184,120,0.6)",
            }}
          />
        </div>

        {/* the label the dot is standing on — hidden on the end card, where the
            completed bar speaks for itself and the brand block owns the space */}
        {!completed && (
          <div style={{ height: 20, marginTop: 11, position: "relative" }}>
            <span
              style={{
                position: "absolute",
                // Anchor the label so it can never run off either edge: it stays
                // centred on the dot through the middle and parks at the ends.
                left: `${pos * 100}%`,
                transform: `translateX(${-labelAnchor(pos) * 100}%)`,
                whiteSpace: "nowrap",
                fontFamily: SANS,
                fontSize: 11.5,
                letterSpacing: 2.2,
                color: "rgba(233,184,120,0.95)",
                textTransform: "uppercase",
              }}
            >
              {events[targetIdx]?.label ?? ""}
            </span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

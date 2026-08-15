/**
 * Builds the asset manifest for a plan: real archival plates from Wikimedia,
 * generated stills + Sora clips for the two reconstructions, per-shot VO.
 *
 * Used by BOTH the orchestrator and `npm run assets`, so there is one
 * implementation of "what image does each shot get".
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getManifest, paths, putManifest } from "./cache";
import { generateReconstruction, generateStill, narrate } from "./openai";
import { downloadBest, nameTokens, queryLadder } from "./wikimedia";
import { resolveAliases } from "./wikipedia";
import { SHOT_TEMPLATE, VO_LEAD_IN, VO_TAIL, type AssetManifest, type Lang, type ReelPlan, type ShotAsset } from "./types";

export interface BuildOpts {
  /** absolute path to the user's uploaded photo, if any */
  userPhotoPath?: string;
  onProgress?: (msg: string) => void;
  /** skip the reconstruction/TTS steps (Phase 4 behaviour) */
  skipMedia?: boolean;
}

const mockShot = (id: number) => `/mock/shot${id}.jpg`;

/**
 * 1.15x is the ceiling where a speed-up is genuinely inaudible. The old 1.35x
 * ceiling was audible — it is what made the 28s reels sound rushed, and why
 * compression was switched off entirely when the template doubled to 56s.
 *
 * At 1.15x this is a collision guard, not a fitting strategy: a line that
 * already fits its window is left at exactly natural pace (that is most lines
 * most of the time), and only a line that would talk over the NEXT line gets
 * nudged. Without it, nothing bounds VO length at all — the Bengal tiger reel
 * shipped with 1.46s of two narrators speaking simultaneously.
 */
const MAX_ATEMPO = 1.15;

function audioDuration(file: string): number {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
      { encoding: "utf8" }
    );
    return Number(out.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * PERMANENT PIPELINE STEP — runs for every language and every site.
 *
 * A VO clip longer than its shot window collides with the next shot's line.
 * Rather than re-running TTS (costs money, non-deterministic), time-compress the
 * clip with ffmpeg `atempo`, which preserves pitch. Capped at 1.35x; beyond that
 * we accept a slight overrun, which reads as a J-cut rather than a clipped word.
 */
function fitVoToWindow(file: string, shotSeconds: number, log: (m: string) => void): void {
  if (!fs.existsSync(file)) return;
  const window = shotSeconds - VO_LEAD_IN - VO_TAIL;
  const dur = audioDuration(file);
  if (dur <= 0 || dur <= window) return;

  const tempo = Math.min(dur / window, MAX_ATEMPO);
  const tmp = `${file}.fit.mp3`;
  try {
    execFileSync(
      "ffmpeg",
      ["-y", "-v", "error", "-i", file, "-filter:a", `atempo=${tempo.toFixed(4)}`, "-c:a", "libmp3lame", "-b:a", "128k", tmp],
      { stdio: "pipe" }
    );
    fs.renameSync(tmp, file);
    log(`Fitted ${path.basename(file)}: ${dur.toFixed(2)}s → ${(dur / tempo).toFixed(2)}s (${tempo.toFixed(2)}x, window ${window.toFixed(2)}s)`);
  } catch {
    try { fs.unlinkSync(tmp); } catch { /* nothing to clean */ }
  }
}

/** "c. 1200" → era string for the style prefix. */
function eraOf(plan: ReelPlan, shotId: number): string {
  const y = plan.shots.find((s) => s.id === shotId)?.caption.year;
  return y ? `c. ${y.replace(/^c\.\s*/i, "")}` : "medieval India";
}

function regionOf(plan: ReelPlan): string {
  return [plan.monument.city, plan.monument.state].filter(Boolean).join(", ") || "India";
}

export async function buildAssets(plan: ReelPlan, opts: BuildOpts = {}): Promise<AssetManifest> {
  const log = opts.onProgress ?? (() => undefined);
  const slug = plan.monument.slug;
  const dir = paths.assetDir(slug);
  const category = plan.category ?? "monument";
  fs.mkdirSync(dir, { recursive: true });

  // Commons is spelling-sensitive — search the canonical Wikipedia title and
  // Wikipedia's own spelling suggestion ("Qutub Minar" → "qutb minar") too.
  const { title, suggestion } = await resolveAliases(plan.monument.name);
  // Suggestions are fuzzy and sometimes nonsense ("Taj Mahal" → "that mahal"),
  // so they widen the SEARCH but must never widen the relevance gate.
  const aliases = [title, suggestion].filter(Boolean) as string[];
  const used = new Set<string>();
  const shots: ShotAsset[] = [];

  // Relevance gate — a Delhi plate must never land in a Hampi reel.
  // Trusted names only. The SLUG matters: it preserves the spelling the user
  // typed ("qutub-minar") while plan.monument.name holds the canonical one
  // ("Qutb Minar"). Commons files use both, and "qutub".includes("qutb") is
  // false — without the slug the gate rejects the very plates we want.
  const tokens = nameTokens(plan.monument.name, title ?? "", slug.replace(/-/g, " "));

  /* ---- the "today" photo: the user's own if they gave one ---- */
  let todaySrc: string | null = null;
  let todayAttr: ShotAsset["attribution"];

  if (opts.userPhotoPath && fs.existsSync(opts.userPhotoPath)) {
    const ext = path.extname(opts.userPhotoPath) || ".jpg";
    const dest = path.join(dir, `today${ext}`);
    if (path.resolve(opts.userPhotoPath) !== path.resolve(dest)) {
      fs.copyFileSync(opts.userPhotoPath, dest);
    }
    todaySrc = `/assets/${slug}/today${ext}`;
    log("Using your photo as today's view");
  } else {
    const got = await downloadBest(
      [`${plan.monument.name} ${plan.monument.city}`, plan.monument.name],
      slug,
      "today",
      used,
      // The "today" shot must look like today — opposite preference to the plates.
      { prefer: "modern", mustMatch: tokens }
    );
    if (got) {
      todaySrc = got.src;
      todayAttr = got.attribution;
    } else {
      // A transient Commons failure must never downgrade a shot we already have.
      // Reuse the previously downloaded photo and its recorded attribution.
      const prev = ["today.jpg", "today.jpeg", "today.png", "today.webp"].find((f) =>
        fs.existsSync(path.join(dir, f))
      );
      if (prev) {
        todaySrc = `/assets/${slug}/${prev}`;
        todayAttr = getManifest(slug)?.shots.find((s) => s.src.endsWith(prev))?.attribution;
        log("Reusing the existing present-day photo");
      }
    }
  }

  /* ---- per shot ---- */
  for (const shot of plan.shots) {
    if (shot.type === "USER_PHOTO" || shot.type === "MATCH_CUT") {
      shots.push({
        shotId: shot.id,
        kind: todaySrc ? "userPhoto" : "placeholder",
        src: todaySrc ?? "/mock/userphoto.jpg",
        attribution: todayAttr,
      });
      continue;
    }

    if (shot.type === "END_CARD") {
      shots.push({ shotId: shot.id, kind: "placeholder", src: todaySrc ?? "/mock/userphoto.jpg" });
      continue;
    }

    if (shot.type === "ARCHIVAL" || shot.type === "MOTION_GRAPHIC") {
      log(`Searching the archives for shot ${shot.id}`);

      // If the model's query doesn't name the site, prepend it — otherwise a
      // generic query like "old map Delhi" pulls in unrelated material.
      let q = shot.visual.archivalQuery;
      if (q && !tokens.some((t) => q!.toLowerCase().includes(t))) {
        q = `${plan.monument.name} ${q}`;
      }

      // A shot dated 2022 is not an archival shot. The turning point for a
      // monument is usually a 19th-century event, but for wildlife it is a
      // modern population count and for a lake a modern pollution survey —
      // and searching those with an age bonus returns the wrong century.
      const capYear = Number((shot.caption.year?.match(/\b(1[5-9]\d{2}|20\d{2})\b/) ?? [])[1] ?? 0);
      const prefer = capYear >= 1990 ? "modern" : "archival";

      const got = await downloadBest(
        queryLadder(q, plan.monument.name, aliases, plan.monument.city),
        slug,
        `shot${shot.id}`,
        used,
        { prefer, mustMatch: tokens }
      );
      shots.push(
        got
          ? { shotId: shot.id, kind: "archival", src: got.src, attribution: got.attribution }
          : // Failure ladder step 3 — no Commons result.
            //
            // NOT the mock plate. public/mock/shotN.jpg carries burned-in text
            // ("ARCHIVAL · 1368 · LIGHTNING · PLACEHOLDER · NOT FINAL ART") over a
            // Qutub Minar silhouette — it is a Phase-0 development fixture, and it
            // is pixels in the JPEG, so nothing downstream can suppress it. Shown
            // for 8 seconds in a finished reel it reads as a broken product, and
            // on a tiger it is also the wrong monument.
            //
            // The present-day photograph is real, on-subject and already
            // attributed. Repeating it is a visible compromise; a "NOT FINAL ART"
            // card is a bug.
            {
              shotId: shot.id,
              kind: todaySrc ? "userPhoto" : "placeholder",
              src: todaySrc ?? mockShot(shot.id),
              attribution: todayAttr,
            }
      );
      continue;
    }

    /* ---- RECONSTRUCTION (shots 3 and 5) ---- */
    if (shot.type === "RECONSTRUCTION") {
      if (opts.skipMedia) {
        shots.push({
          shotId: shot.id,
          kind: "placeholder",
          src: mockShot(shot.id),
          stillSrc: mockShot(shot.id),
          usedFallback: true,
        });
        continue;
      }

      const era = eraOf(plan, shot.id);
      const region = regionOf(plan);
      const stillOut = path.join(dir, `still${shot.id}.png`);

      log(`Reconstructing shot ${shot.id} — ${era}`);

      // Reference the best real photo so the architecture stays correct (skills.md §7).
      //
      // NOT for animals: the reference goes through images.edit, which carries the
      // source's photographic character over into the result. Handed a modern
      // wildlife photo, the model returns a photoreal animal — exactly the fake
      // wildlife footage a natural-history plate exists to avoid. An animal
      // reconstruction is generated from the prompt alone.
      const reference =
        category !== "animal" && todaySrc?.startsWith("/assets/")
          ? path.join(process.cwd(), "public", todaySrc.replace(/^\//, ""))
          : undefined;

      // Idempotency: a still we already paid for is reused. Re-running the asset
      // step to fix an archival lookup must never re-buy images (skills.md §13).
      const still = fs.existsSync(stillOut)
        ? (log(`Reusing approved still for shot ${shot.id} ($0)`), stillOut)
        : await generateStill({
            stillPrompt: shot.visual.stillPrompt ?? "",
            era,
            region,
            outPath: stillOut,
            referenceImage: reference,
            category,
          });

      const stillSrc = still ? `/assets/${slug}/still${shot.id}.png` : mockShot(shot.id);

      // Only spend Sora money on a still we actually produced.
      let clipSrc: string | null = null;
      if (still) {
        const clipOut = path.join(dir, `clip${shot.id}.mp4`);
        // Idempotency — a $0.40 clip is the most expensive thing in the app and
        // must NEVER be re-bought just because the asset step re-ran.
        if (fs.existsSync(clipOut) && fs.statSync(clipOut).size > 50_000) {
          log(`Reusing Sora clip for shot ${shot.id} ($0)`);
          clipSrc = `/assets/${slug}/clip${shot.id}.mp4`;
        } else {
          const clip = await generateReconstruction({
            stillPath: still,
            stillPrompt: shot.visual.stillPrompt ?? "",
            motionPrompt: shot.visual.motionPrompt ?? "a very slow push in",
            era,
            region,
            outPath: clipOut,
            category,
          });
          if (clip) clipSrc = `/assets/${slug}/clip${shot.id}.mp4`;
        }
      }

      shots.push({
        shotId: shot.id,
        kind: clipSrc ? "sora" : "still",
        src: clipSrc ?? stillSrc,
        stillSrc,
        usedFallback: !clipSrc, // → Ken Burns the still under the badge
      });
      continue;
    }

    shots.push({ shotId: shot.id, kind: "placeholder", src: mockShot(shot.id) });
  }

  /* ---- narration ---- */
  const vo: (string | null)[] = [];
  for (const shot of plan.shots) {
    if (opts.skipMedia) {
      vo.push(`/mock/vo-shot${shot.id}.mp3`);
      continue;
    }
    const out = path.join(dir, `vo${shot.id}-${plan.language}.mp3`);
    // Same idempotency rule as the stills — never re-buy narration.
    const got = fs.existsSync(out) ? out : await narrate({ text: shot.narration, outPath: out });

    // Collision guard, not a fitting strategy (see MAX_ATEMPO). A line inside its
    // window is untouched and plays at exactly natural pace; a line that would
    // otherwise still be speaking when the NEXT line starts is nudged, at most
    // 1.15x. Overrunning slightly is a J-cut and is fine; two narrators at once
    // is not, and neither is losing the final words at the composition boundary.
    if (got) {
      const tpl = SHOT_TEMPLATE.find((t) => t.id === shot.id);
      if (tpl) fitVoToWindow(got, tpl.end - tpl.start, log);
    }
    // TTS failure → silent clip; the reel is still watchable (failure ladder step 5).
    vo.push(got ? `/assets/${slug}/vo${shot.id}-${plan.language}.mp3` : `/mock/vo-shot${shot.id}.mp3`);
  }
  if (!opts.skipMedia) log("Narration recorded");

  const manifest: AssetManifest = { slug, shots, vo, userPhoto: todaySrc ?? undefined };
  putManifest(manifest);
  return manifest;
}

/** Writes the exact props object `scripts/render.ts --props=` consumes. */
export function writeRenderProps(plan: ReelPlan, assets: AssetManifest, lang: Lang): string {
  const props = {
    plan,
    assets,
    audio: {
      music: "/audio/music.mp3",
      whoosh: "/audio/whoosh.mp3",
      stone: "/audio/stone.mp3",
      ambience: "/audio/ambience.mp3",
    },
  };
  const p = paths.renderProps(plan.monument.slug, lang);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(props, null, 2));
  return p;
}

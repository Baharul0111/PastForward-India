/**
 * ReelPlan schema — the single source of truth (architecture.md §5).
 * The 28.0s / 840-frame template is defined here and is NEVER taken from the model.
 */

export type Lang = "en" | "hi" | "kn" | "ta" | "te" | "bn";

/**
 * Languages the UI actually offers. The `Lang` union and `LANGS` table stay wide
 * on purpose — shipping another language is a one-line change here, and the
 * translate + TTS paths already handle every code in the union.
 */
export const VISIBLE_LANGS: Lang[] = ["en", "hi"];

export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
];

/**
 * What the subject IS. Drives the category-conditioned block in the plan prompt,
 * the archival query vocabulary, and the reconstruction art direction.
 * The 8-shot skeleton is identical for every category.
 */
export type SubjectCategory = "monument" | "building" | "natural_place" | "animal" | "other";

export const SUBJECT_CATEGORIES: SubjectCategory[] = [
  "monument",
  "building",
  "natural_place",
  "animal",
  "other",
];

export type ShotType =
  | "USER_PHOTO"
  | "ARCHIVAL"
  | "RECONSTRUCTION"
  | "MOTION_GRAPHIC"
  | "MATCH_CUT"
  | "END_CARD";

export type Grade = "modern" | "archival" | "parchment" | "reconstruction";

export type KenBurnsDirection = "in" | "out" | "left" | "right";

export type Sfx = "stone" | "market" | "whoosh" | "ambient" | "none";

export interface Shot {
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** seconds — ALWAYS overwritten server-side from SHOT_TEMPLATE */
  start: number;
  end: number;
  type: ShotType;
  /** this shot's spoken line */
  narration: string;
  /** text: 3–7 words (skills.md §10) */
  caption: { year?: string; text: string };
  visual: {
    /** ARCHIVAL: Wikimedia Commons search string */
    archivalQuery?: string;
    /** RECONSTRUCTION: image prompt (server prepends STYLE_PREFIX) */
    stillPrompt?: string;
    /** RECONSTRUCTION: ONE slow camera move for Sora */
    motionPrompt?: string;
    kenBurns: { direction: KenBurnsDirection; strength: number };
    grade: Grade;
  };
  sfx: Sfx;
}

export interface ReelPlan {
  /**
   * The subject. Named `monument` for historical reasons — the app now covers
   * lakes, forests and animals too. Kept as-is so every cached plan, Remotion
   * component and trust card keeps working; `category` carries the real kind.
   */
  monument: { name: string; city: string; state: string; slug: string };
  /** absent on plans cached before generalization — treat as "monument" */
  category?: SubjectCategory;
  language: Lang;
  /** ≤ 10 words, creates a question (skills.md §4) */
  hook: string;
  /** ≤ 10 words, closing line */
  takeaway: string;
  /** 3–5 dots, last one is "2026" */
  timeline: { startYear: string; events: { year: string; label: string }[] };
  /** EXACTLY 8 */
  shots: Shot[];
  /** model reports it; server validates 65–75 */
  narrationWordCount: number;
  sources: { title: string; url: string }[];
}

/* ------------------------------------------------------------------ */
/* The locked template (skills.md §3). Duration is enforced from here. */
/* ------------------------------------------------------------------ */

export const FPS = 30;
/**
 * 58.0s. The end card was 4.0s while a natural-pace takeaway measures ~4.5s, so
 * the reel's closing words were cut off at the composition boundary. atempo is
 * disabled by design (speech is never time-compressed), which means the WINDOW
 * has to follow the audio, not the other way round. Shots 1–7 are unchanged, so
 * the reconstruction ranges on the trust card are unaffected.
 */
export const DURATION_SECONDS = 58.0;
export const DURATION_FRAMES = 1740;
export const WIDTH = 720;
export const HEIGHT = 1280;

export interface ShotTemplateEntry {
  id: Shot["id"];
  start: number;
  end: number;
  type: ShotType;
  grade: Grade;
  sfx: Sfx;
  kenBurns: { direction: KenBurnsDirection; strength: number };
}

/**
 * Ken Burns directions never repeat consecutively (skills.md §6 / §14.4).
 * in → out → left → in → right → out → in → (end card)
 */
export const SHOT_TEMPLATE: ShotTemplateEntry[] = [
  { id: 1, start: 0.0, end: 5.0, type: "USER_PHOTO", grade: "modern", sfx: "ambient", kenBurns: { direction: "in", strength: 0.14 } },
  { id: 2, start: 5.0, end: 12.0, type: "ARCHIVAL", grade: "archival", sfx: "market", kenBurns: { direction: "out", strength: 0.16 } },
  { id: 3, start: 12.0, end: 20.0, type: "RECONSTRUCTION", grade: "reconstruction", sfx: "stone", kenBurns: { direction: "left", strength: 0.12 } },
  { id: 4, start: 20.0, end: 28.0, type: "ARCHIVAL", grade: "parchment", sfx: "none", kenBurns: { direction: "in", strength: 0.18 } },
  { id: 5, start: 28.0, end: 36.0, type: "RECONSTRUCTION", grade: "reconstruction", sfx: "stone", kenBurns: { direction: "right", strength: 0.12 } },
  { id: 6, start: 36.0, end: 44.0, type: "ARCHIVAL", grade: "archival", sfx: "none", kenBurns: { direction: "out", strength: 0.16 } },
  { id: 7, start: 44.0, end: 52.0, type: "MATCH_CUT", grade: "modern", sfx: "whoosh", kenBurns: { direction: "in", strength: 0.1 } },
  { id: 8, start: 52.0, end: 58.0, type: "END_CARD", grade: "modern", sfx: "none", kenBurns: { direction: "in", strength: 0.05 } },
];

/** Sora returns 4s clips; a RECONSTRUCTION window is now 8s. */
export const SORA_CLIP_SECONDS = 4;

/** VO enters this many seconds after each cut (and must land before the next). */
export const VO_LEAD_IN = 0.2;
export const VO_TAIL = 0.1;

export const RECONSTRUCTION_SHOT_IDS = [3, 5] as const;

/** "00:06–00:10, 00:14–00:18" for the trust card (skills.md §12). */
export function reconstructionRanges(): string {
  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return SHOT_TEMPLATE.filter((s) => s.type === "RECONSTRUCTION")
    .map((s) => `${fmt(s.start)}–${fmt(s.end)}`)
    .join(", ");
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export type AssetKind = "archival" | "still" | "sora" | "userPhoto" | "placeholder";

export interface AssetAttribution {
  /** Wikimedia Commons file page, or "" for generated media */
  sourcePage: string;
  artist: string;
  license: string;
  title?: string;
}

export interface ShotAsset {
  shotId: Shot["id"];
  kind: AssetKind;
  /** public URL, e.g. /assets/qutub-minar/shot2.jpg */
  src: string;
  /** RECONSTRUCTION only: the approved still behind a Sora clip (also the fallback) */
  stillSrc?: string;
  /** true when Sora failed and the shot Ken Burns the still instead */
  usedFallback?: boolean;
  attribution?: AssetAttribution;
}

export interface AssetManifest {
  slug: string;
  shots: ShotAsset[];
  /** per-shot narration audio, index 0 = shot 1 */
  vo: (string | null)[];
  userPhoto?: string;
}

/**
 * Everything the Remotion composition needs.
 * Declared as a `type` (not an interface) so it keeps an implicit index signature
 * and satisfies Remotion's `Record<string, unknown>` props constraint.
 */
export type ReelProps = {
  plan: ReelPlan;
  assets: AssetManifest;
  audio: {
    music: string | null;
    whoosh: string | null;
    stone: string | null;
    ambience: string | null;
  };
};

/* ------------------------------------------------------------------ */
/* Orchestrator status                                                 */
/* ------------------------------------------------------------------ */

export type StepId =
  | "identify"
  | "research"
  | "plan"
  | "assets"
  | "reconstruct"
  | "narrate"
  | "render"
  | "done"
  | "error";

/* ------------------------------------------------------------------ */
/* Wait-screen questions (generated per subject, not a fixed queue)     */
/* ------------------------------------------------------------------ */

export interface WaitChip {
  /** 1–2 words — the whole answer surface is taps, never typing */
  label: string;
  /** optional one-line reply shown after the tap */
  ack?: string;
}

export interface WaitQuestion {
  id: string;
  /** ≤ 10 words, about THIS subject */
  question: string;
  /** 3–4 chips */
  chips: WaitChip[];
  /** exactly one question in a set is a "guess" */
  kind: "poll" | "guess";
  /** guess only: the real fact, revealed after the tap */
  reveal?: string;
}

/**
 * A cold generation runs three to five minutes. Four questions were exhausted in
 * about a minute, leaving the viewer staring at a progress bar for the rest.
 */
export const WAIT_QUESTION_COUNT = 8;

export interface JobStatus {
  job: string;
  slug: string;
  lang: Lang;
  step: StepId;
  label: string;
  done: StepId[];
  pct: number;
  reelUrl?: string;
  error?: string;
  cached?: boolean;
  /** read-only: timeline start year, once the plan is cached (powers the wait-screen age question) */
  startYear?: string;
  /**
   * Subject-specific wait-screen questions.
   *   undefined → still being generated, show the shimmer
   *   null      → generation failed, the UI silently uses its fixed queue
   *   array     → use these
   */
  questions?: WaitQuestion[] | null;
  /** what the subject turned out to be — drives category-conditioned copy */
  category?: SubjectCategory;
  updatedAt: number;
}

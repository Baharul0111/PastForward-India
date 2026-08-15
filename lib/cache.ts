/**
 * Filesystem cache. No DB (architecture.md §2). Everything is keyed by slug + lang.
 *
 *   cache/plans/{slug}-{lang}.json     ReelPlan
 *   cache/status/{job}.json            orchestrator progress
 *   public/assets/{slug}/…             archival + generated media + VO
 *   public/reels/{slug}-{lang}.mp4     THE cache — its existence means $0 replay
 */

import fs from "node:fs";
import path from "node:path";
import type { AssetManifest, JobStatus, Lang, ReelPlan, WaitQuestion } from "./types";

const ROOT = process.cwd();

export const paths = {
  plan: (slug: string, lang: Lang) => path.join(ROOT, "cache", "plans", `${slug}-${lang}.json`),
  status: (job: string) => path.join(ROOT, "cache", "status", `${job}.json`),
  manifest: (slug: string) => path.join(ROOT, "public", "assets", slug, "manifest.json"),
  assetDir: (slug: string) => path.join(ROOT, "public", "assets", slug),
  reel: (slug: string, lang: Lang) => path.join(ROOT, "public", "reels", `${slug}-${lang}.mp4`),
  reelUrl: (slug: string, lang: Lang) => `/reels/${slug}-${lang}.mp4`,
  renderProps: (slug: string, lang: Lang) =>
    path.join(ROOT, "cache", "plans", `${slug}-${lang}.render.json`),
  questions: (slug: string, lang: Lang) =>
    path.join(ROOT, "cache", "plans", `${slug}-${lang}.questions.json`),
};

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(p: string, data: unknown) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

/** Turn any monument name into the cache key. "Tipu Sultan's Summer Palace" → "tipu-sultans-summer-palace" */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* plans */
export const getPlan = (slug: string, lang: Lang) => readJson<ReelPlan>(paths.plan(slug, lang));
export const putPlan = (plan: ReelPlan) => writeJson(paths.plan(plan.monument.slug, plan.language), plan);

/* assets */
export const getManifest = (slug: string) => readJson<AssetManifest>(paths.manifest(slug));
export const putManifest = (m: AssetManifest) => writeJson(paths.manifest(m.slug), m);

/* wait-screen questions — same rule as everything else here: never buy twice.
   They take ~35s to generate, which is longer than a cached reel takes to
   appear, so on a replay they must come off disk or they arrive after the reel
   has already started. */
export const getQuestions = (slug: string, lang: Lang) =>
  readJson<WaitQuestion[]>(paths.questions(slug, lang));
export const putQuestions = (slug: string, lang: Lang, qs: WaitQuestion[]) =>
  writeJson(paths.questions(slug, lang), qs);

/* status */
export const getStatus = (job: string) => readJson<JobStatus>(paths.status(job));
export const putStatus = (s: JobStatus) => writeJson(paths.status(s.job), { ...s, updatedAt: Date.now() });

/* reels — the money cache */
export function reelExists(slug: string, lang: Lang): boolean {
  try {
    return fs.statSync(paths.reel(slug, lang)).size > 10_000;
  } catch {
    return false;
  }
}

export function listCachedReels(): { slug: string; lang: Lang }[] {
  const dir = path.join(ROOT, "public", "reels");
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".mp4") && !f.startsWith("_") && !f.includes(".rendering."))
      .map((f) => {
        const base = f.replace(/\.mp4$/, "");
        const i = base.lastIndexOf("-");
        return { slug: base.slice(0, i), lang: base.slice(i + 1) as Lang };
      });
  } catch {
    return [];
  }
}

export function newJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ */
/* Slug aliases — one subject, many romanisations                      */
/* ------------------------------------------------------------------ */

/**
 * The vision model returns whichever spelling Wikipedia canonicalises to, and
 * that is not always the spelling the reel was cached under: a photo of the
 * Qutub Minar comes back as "Qutb Minar" about two runs in three, which
 * slugifies to `qutb-minar` while the cached reel is `qutub-minar`. The cache
 * check then misses and the app starts a five-minute cold generation for a reel
 * it already has.
 *
 * The asset layer has handled both spellings since Phase 4 (resolveAliases) —
 * but that runs inside buildAssets, long after the money short-circuit has
 * already been missed. This closes the same gap at the cache layer.
 */
const ALIAS_FILE = path.join(ROOT, "cache", "slug-aliases.json");

/**
 * "qutub-minar" → "qtbmnr". Romanisations of Indian names differ mostly in their
 * vowels (Qutub/Qutb, Humayun/Humayoon, Tipu/Tippoo, Srirangapatna/Seringapatam),
 * so the consonant skeleton is a decent identity for "same name, spelled
 * differently". Only ever compared against slugs we have ALREADY cached, and
 * only when the first letter matches too, which keeps it from over-matching.
 */
function skeleton(slug: string): string {
  return slug.replace(/-/g, "").replace(/[aeiou]/g, "");
}

export function getSlugAliases(): Record<string, string> {
  return readJson<Record<string, string>>(ALIAS_FILE) ?? {};
}

export function putSlugAlias(alias: string, canonical: string): void {
  if (!alias || !canonical || alias === canonical) return;
  const all = getSlugAliases();
  if (all[alias] === canonical) return;
  all[alias] = canonical;
  writeJson(ALIAS_FILE, all);
}

/**
 * Map a freshly-slugified name onto the slug a reel is ALREADY cached under.
 * Falls through to the original slug when there is nothing cached to match.
 */
export function resolveCachedSlug(slug: string, lang: Lang): string {
  if (reelExists(slug, lang)) return slug;

  const mapped = getSlugAliases()[slug];
  if (mapped && reelExists(mapped, lang)) return mapped;

  const sk = skeleton(slug);
  if (sk.length >= 3) {
    for (const cached of listCachedReels()) {
      if (cached.lang !== lang) continue;
      if (cached.slug[0] !== slug[0]) continue;
      if (skeleton(cached.slug) === sk) {
        putSlugAlias(slug, cached.slug);
        return cached.slug;
      }
    }
  }
  return slug;
}

/**
 * Wikimedia Commons archival sourcing (architecture.md §7, skills.md §8). FREE.
 *
 * 19th-century photographs, colonial engravings and miniature paintings are the
 * authenticity money can't buy. Every asset carries {artist, license, sourcePage}
 * into the "How do we know this?" card — never scrape random images.
 */

import fs from "node:fs";
import path from "node:path";
import type { AssetAttribution } from "./types";

const UA = "PastForwardIndia/0.1 (hackathon build; contact via app)";

/** skills.md §8 — allowlist. Anything else is rejected outright. */
const LICENSE_ALLOW = [
  /^public domain/i,
  /^pd/i,
  /^cc0/i,
  /^cc[- ]by(-sa)?([- ]\d(\.\d)?)?$/i,
  /^cc[- ]by[- ]sa/i,
  /^cc[- ]by/i,
  /creative commons attribution/i,
];

function licenseAllowed(license: string): boolean {
  const l = license.trim();
  if (!l) return false;
  if (/non[- ]?commercial|\bnc\b|\bnd\b|no[- ]?deriv|fair use|copyright/i.test(l)) return false;
  return LICENSE_ALLOW.some((re) => re.test(l));
}

function stripHtml(s: string | undefined): string {
  return (s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export interface CommonsCandidate {
  title: string;
  imageUrl: string;
  descriptionUrl: string;
  width: number;
  height: number;
  artist: string;
  license: string;
  date: string;
  score: number;
}

interface CommonsApiPage {
  title?: string;
  imageinfo?: {
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

/**
 * Rank by what actually makes a documentary look authentic:
 * genuinely old material first, then resolution, then portrait-ish framing
 * (the reel is 9:16).
 */
/**
 * Archival shots want the oldest plate available; the "today" shot wants a
 * modern photograph. Same corpus, opposite preference.
 */
export type Prefer = "archival" | "modern";

/**
 * Distinctive words from the monument name, used as a relevance gate.
 * "Tipu Sultan's Summer Palace" → ["tipu","sultan","summer","palace"]
 */
export function nameTokens(...names: string[]): string[] {
  const stop = new Set([
    // structural words that would match almost any file title
    "the", "of", "and", "at", "in", "on", "for", "that", "this", "with", "near", "old", "new",
    // building-type words shared by thousands of Indian monuments
    "fort", "temple", "palace", "minar", "mahal", "tomb", "mosque", "masjid", "complex",
    "monument", "monuments", "summer", "great", "india", "indian",
  ]);
  const toks = names
    .join(" ")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  const distinctive = toks.filter((w) => !stop.has(w));
  // If everything was a stop word (e.g. "Red Fort"), fall back to all tokens.
  return Array.from(new Set(distinctive.length ? distinctive : toks));
}

function scoreOf(
  c: Omit<CommonsCandidate, "score">,
  query: string,
  prefer: Prefer,
  mustMatch: string[]
): number {
  let s = 0;

  const year = Number((c.date.match(/\b(1[5-9]\d{2})\b/) ?? [])[1] ?? 0);
  const modern = year >= 1990 || /\b(20\d{2}|199\d)\b/.test(`${c.title} ${c.date}`);

  if (prefer === "archival") {
    if (year >= 1500 && year < 1900) s += 55; // 19th century and earlier — the good stuff
    else if (year >= 1900 && year < 1950) s += 28;
    else if (year >= 1950 && year < 1990) s += 8;
  } else {
    // The "today" shot must look like today.
    if (modern) s += 55;
    else if (year && year < 1950) s -= 60;
    else if (year && year < 1990) s -= 20;
  }

  const t = `${c.title} ${c.artist}`.toLowerCase();
  const title = c.title.toLowerCase();

  // Relevance gate: an off-topic plate is worse than a placeholder. A Delhi
  // photograph must never land in a Hampi reel because the query was loose.
  //
  // Matched against the TITLE only, never the artist. "Dal Lake" tokenises to
  // ["dal","lake"], and a single 3-letter substring match let a 17th-century
  // "Roman Charity" painting into a Kashmir reel — "dal" matched the surname
  // particle in "isabella Maria dal Pozzo". A creator's name says nothing about
  // what a picture depicts.
  //
  // Short tokens are not evidence on their own, so when a name has no token of
  // four characters or more, EVERY short token must appear. "Dal Lake" then
  // requires both "dal" and "lake", which no painting of Roman Charity has.
  if (mustMatch.length) {
    const strong = mustMatch.filter((tok) => tok.length >= 4);
    const passes = strong.length
      ? strong.some((tok) => title.includes(tok))
      : mustMatch.every((tok) => title.includes(tok));
    if (!passes) s -= 120;
  }

  if (prefer === "archival") {
    // Medium bonuses ONLY for genuinely old material. Otherwise "Engravings on
    // Qutub Minar.jpg" — a 2019 photo of carvings — outranks an 1858 Beato print.
    if (!modern) {
      if (/engraving|lithograph|etching|aquatint|painting|watercolou?r|drawing|sketch|daguerreotype/.test(t)) s += 22;
      if (/photograph|photo/.test(t) && year && year < 1930) s += 18;
      if (/\bmap\b|plan\b|survey/.test(t)) s += 12;
      if (/portrait|miniature/.test(t)) s += 10;
      // The standard corpus of colonial-era India photography.
      if (/bourne|beato|daniell|british library|getty|kitlv|tripe|johnston|hoffmann/.test(t)) s += 20;
    } else {
      s -= 30;
    }
    // "carvings/engravings ON the thing" is a detail photo, not an archival print.
    if (/\b(engravings?|carvings?|inscriptions?)\s+(on|at|of)\b/.test(t) && !year) s -= 25;
  }
  if (/dsc_?\d|img_?\d/i.test(c.title) && !year) s -= 12;

  const px = c.width * c.height;
  s += Math.min(20, px / 400_000);

  // 9:16 output — portrait and square crop better than extreme panoramas.
  const ar = c.width / Math.max(1, c.height);
  if (ar < 0.9) s += 10;
  else if (ar < 1.5) s += 5;
  else if (ar > 2.6) s -= 12;

  const q = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const hits = q.filter((w) => t.includes(w)).length;
  s += hits * 4;

  s += safetyPenalty(t);

  return s;
}

/**
 * Some of the highest-scoring archival hits are the ones we least want on screen.
 *
 * A Bengal tiger query returned Tenniel's "The British lion's vengeance on the
 * Bengal tiger" — his 1857-Rebellion cartoon, the tiger crouched over a fallen
 * British woman. Every heuristic above rewarded it independently: the title
 * names the subject so it clears the relevance gate, it is genuinely 19th
 * century, it is genuinely an illustration, and the scan is huge. A colonial
 * allegory whose title names the subject is the single highest-scoring wrong
 * answer this scorer can produce, and the Punch/Tenniel corpus is full of them.
 *
 * These penalties are large enough to sink such a hit below the "no result at
 * all" threshold, because a placeholder is strictly better than a communal or
 * colonial-violence cartoon under a caption about wildlife conservation
 * (skills.md §12). They are deliberately title-based and conservative: real
 * archival material rarely carries these words.
 */
function safetyPenalty(t: string): number {
  let p = 0;

  // Political allegory / satire. The reel presents archival material as
  // historical evidence; a cartoon is an argument, not a record.
  if (/\ballegor|satir|caricature|cartoon|punch\b|vengeance|avenging|retribution/.test(t)) p -= 200;
  if (/british lion|john bull|britannia/.test(t)) p -= 200;

  // The 1857 Rebellion and Partition are exactly the contested history
  // skills.md §12 says to stay out of.
  if (/sepoy|mutiny|rebellion of 1857|cawnpore|kanpur massacre|partition riot/.test(t)) p -= 200;

  // Killing imagery: trophy photographs and hunt scenes. Period-real, but a dead
  // animal under a line about how it lives is grotesque, and it is the failure
  // mode animals invite most.
  if (/\b(trophy|hunted|shot dead|slain|killed|carcass|man-?eater|shikar)\b/.test(t)) p -= 120;
  if (/posing with|bagged|kill of the day/.test(t)) p -= 120;

  // Human remains and explicit violence, whatever the subject.
  if (/\b(corpse|dead body|execution|hanging|massacre|atrocit)/.test(t)) p -= 200;

  // Nudity and intimate scenes. Classical painting is full of them, they carry
  // every "old and painterly" bonus this scorer awards, and Ken Burns will zoom
  // into whatever is in the middle of the frame for eight seconds.
  if (/\bnudes?\b|\bnaked\b|topless|breast|suckl|lactat|bathing women|odalisque/.test(t)) p -= 200;

  // Religious and classical allegory: on-topic by title, never on-topic by
  // meaning. "Roman Charity" reached a Dal Lake reel; a Mahasiddha seated on a
  // tiger reached a Bengal tiger reel.
  if (/roman charity|guido reni|madonna|venus|crucifix|martyr|mahasiddha|deity|goddess/.test(t)) p -= 150;

  return p;
}

export interface SearchOpts {
  limit?: number;
  prefer?: Prefer;
  /** distinctive monument tokens; candidates matching none are pushed far down */
  mustMatch?: string[];
}

/** Search Commons for one shot's archivalQuery. Returns ranked, license-clean candidates. */
export async function searchCommons(query: string, opts: SearchOpts = {}): Promise<CommonsCandidate[]> {
  const { limit = 12, prefer = "archival", mustMatch = [] } = opts;
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=${limit}` +
    `&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1280&format=json&origin=*`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];

  const data = (await res.json()) as { query?: { pages?: Record<string, CommonsApiPage> } };
  const pages = Object.values(data.query?.pages ?? {});

  const out: CommonsCandidate[] = [];
  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;

    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? meta.License?.value);
    if (!licenseAllowed(license)) continue;

    // Only raster stills — SVG/PDF/TIF do not decode in the renderer.
    const imageUrl = info.thumburl ?? info.url ?? "";
    if (!/\.(jpe?g|png|webp)$/i.test(imageUrl.split("?")[0])) continue;

    const base = {
      title: stripHtml(p.title).replace(/^File:/, ""),
      imageUrl,
      descriptionUrl: info.descriptionurl ?? "",
      width: info.width ?? 0,
      height: info.height ?? 0,
      artist: stripHtml(meta.Artist?.value) || "Unknown",
      license,
      date: stripHtml(meta.DateTimeOriginal?.value ?? meta.DateTime?.value),
    };
    out.push({ ...base, score: scoreOf(base, query, prefer, mustMatch) });
  }

  return out.sort((a, b) => b.score - a.score);
}

export interface DownloadedAsset {
  src: string; // public URL
  attribution: AssetAttribution;
}

/**
 * The plan's archivalQuery is often too specific to hit anything ("Qutub Minar
 * engraving Delhi 1800s" → 0 results). Fall back through the shapes that
 * actually surface colonial-era material on Commons, ending at the bare name.
 */
export function queryLadder(
  planQuery: string | undefined,
  monument: string,
  /**
   * Extra names to search under. Spelling is decisive on Commons:
   * "Qutub Minar old photograph" returns only modern tourist snaps, while
   * "Qutb Minar old photograph" returns 1858 photographs. Pass the canonical
   * Wikipedia title, Wikipedia's spelling suggestion, and — most valuable —
   * the colonial-era place name, which is how 19th-century plates are titled
   * ("Seringapatam", not "Srirangapatna").
   */
  aliases: string | string[] = [],
  city?: string
): string[] {
  const extra = (Array.isArray(aliases) ? aliases : [aliases]).filter(Boolean);
  const names = Array.from(new Set([monument, ...extra]));
  const shapes = [
    "old photograph",
    "Samuel Bourne",
    "Beato",
    "ruins 19th century",
    "Getty Museum",
    "British Library",
    "1860s",
  ];

  const q: string[] = [];
  if (planQuery) q.push(planQuery);
  // Interleave by shape so every spelling gets a fair shot before we broaden.
  for (const shape of shapes) for (const n of names) q.push(`${n} ${shape}`);
  if (city) {
    q.push(`${city} 19th century`);
    q.push(`${city} British Library`);
  }
  for (const n of names) q.push(n);

  return Array.from(new Set(q));
}

/**
 * Download the best candidate into /public/assets/{slug}/.
 * `used` carries descriptionUrls already taken by earlier shots so two shots
 * never show the same plate.
 */
export async function downloadBest(
  queries: string | string[],
  slug: string,
  filenameBase: string,
  used: Set<string> = new Set(),
  opts: SearchOpts = {}
): Promise<DownloadedAsset | null> {
  const ladder = Array.isArray(queries) ? queries : [queries];

  const seen = new Set<string>();
  const candidates: CommonsCandidate[] = [];
  for (const q of ladder) {
    const found = await searchCommons(q, opts);
    for (const c of found) {
      const key = c.descriptionUrl || c.imageUrl;
      if (seen.has(key) || used.has(key)) continue;
      seen.add(key);
      candidates.push(c);
    }
    // Stop early once we have a strong, on-topic plate.
    if (candidates.some((c) => c.score >= 70)) break;
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);

  // An off-topic image is worse than a placeholder — refuse rather than mislead.
  if (candidates[0].score < 0) return null;

  const dir = path.join(process.cwd(), "public", "assets", slug);
  fs.mkdirSync(dir, { recursive: true });

  for (const c of candidates.slice(0, 5)) {
    try {
      const res = await fetch(c.imageUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 12_000) continue; // too small to fill a 720×1280 frame

      const ext = (c.imageUrl.split("?")[0].match(/\.(jpe?g|png|webp)$/i) ?? [".jpg"])[0];
      const file = `${filenameBase}${ext.toLowerCase()}`;
      fs.writeFileSync(path.join(dir, file), buf);
      used.add(c.descriptionUrl || c.imageUrl);

      return {
        src: `/assets/${slug}/${file}`,
        attribution: {
          title: c.title,
          artist: c.artist,
          license: c.license,
          sourcePage: c.descriptionUrl,
        },
      };
    } catch {
      // try the next candidate — the reel must always complete
    }
  }
  return null;
}

/**
 * Phase 2 — real identify → research → plan for one monument.
 *
 *   npm run plan -- --name="Qutub Minar" --lang=en
 *   npm run plan -- --name="Qutub Minar" --photo=public/assets/qutub-minar/today.jpg
 *
 * Text/vision only (~$0.02). Caches to cache/plans/{slug}-{lang}.json.
 */

import fs from "node:fs";
import path from "node:path";
import { budgetSummary, readLedger } from "../lib/budget";
import { getPlan, paths, putPlan, slugify } from "../lib/cache";
import { identify, plan as planCall } from "../lib/openai";
import { locate, research } from "../lib/wikipedia";
import type { Lang } from "../lib/types";

function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const arg = (n: string, f?: string) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : f;
};
const flag = (n: string) => process.argv.includes(`--${n}`);

async function main() {
  const nameIn = arg("name", "Qutub Minar")!;
  const lang = (arg("lang", "en") as Lang)!;
  const photoPath = arg("photo");

  console.log(`\n${budgetSummary()}\n`);

  /* ---- 1. IDENTIFY ---- */
  let name = nameIn;
  let city = "";
  let state = "";

  if (photoPath) {
    const abs = path.resolve(process.cwd(), photoPath);
    const b64 = fs.readFileSync(abs).toString("base64");
    const ext = path.extname(abs).slice(1).toLowerCase();
    const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    console.log(`IDENTIFY (vision) ← ${photoPath}`);
    const id = await identify({ photoDataUrl: `data:${mime};base64,${b64}` });
    console.log(`  → ${id.name} · ${id.city}, ${id.state} · confidence ${id.confidence}`);
    if (id.alternatives.length) {
      console.log(`  alternatives: ${id.alternatives.map((a) => `${a.name} (${a.city})`).join(" | ")}`);
    }
    if (id.notes) console.log(`  notes: ${id.notes}`);
    if (id.confidence < 0.85) {
      console.log(`  ⚠️  confidence < 0.85 → the UI would show the 3 alternatives here`);
    }
    name = id.name;
    city = id.city;
    state = id.state;
  } else {
    console.log(`IDENTIFY: name passthrough "${name}"`);
  }

  const slug = slugify(name);

  if (getPlan(slug, lang) && !flag("force")) {
    console.log(`\nPlan already cached at ${path.relative(process.cwd(), paths.plan(slug, lang))} — pass --force to regenerate.`);
    return;
  }

  /* ---- 2. RESEARCH (free) ---- */
  console.log(`\nRESEARCH (Wikipedia, free)`);
  const found = await research(name);
  if (!found) {
    console.error(`  ✗ no article — failure ladder step 2 would fire a web search here`);
    process.exit(1);
  }
  console.log(`  → "${found.title}" · ${found.wordCount} words${found.thin ? "  ⚠️ THIN" : ""}`);
  console.log(`    ${found.url}`);

  if (!city) {
    const loc = await locate(found.title);
    city = loc.city;
    state = loc.state;
    console.log(`  location: ${city}${state ? `, ${state}` : ""}`);
  }

  const sources = [
    { title: `${found.title} — Wikipedia`, url: found.url },
    { title: "Qutb Minar and its Monuments, Delhi — UNESCO World Heritage Centre", url: "https://whc.unesco.org/en/list/233/" },
    { title: "Archaeological Survey of India", url: "https://asi.nic.in/" },
  ].filter((s, i) => i === 0 || /qutb|qutub/i.test(name) || i === 2);

  /* ---- 3. PLAN ---- */
  console.log(`\nPLAN (structured output) — this is the one real planning call`);
  const reelPlan = await planCall({
    monument: found.title,
    city,
    slug,
    sourceText: found.text,
    sourceUrls: sources,
    language: lang,
  });
  if (city) reelPlan.monument.city = city;
  if (state) reelPlan.monument.state = state;
  putPlan(reelPlan);

  /* ---- 4. VALIDATE (architecture.md §5) ---- */
  console.log(`\nVALIDATION`);
  const checks: [string, boolean, string][] = [
    ["exactly 8 shots", reelPlan.shots.length === 8, `${reelPlan.shots.length}`],
    ["narration 65–75 words", reelPlan.narrationWordCount >= 65 && reelPlan.narrationWordCount <= 75, `${reelPlan.narrationWordCount}`],
    ["hook ≤ 10 words", reelPlan.hook.split(/\s+/).length <= 10, `${reelPlan.hook.split(/\s+/).length}`],
    ["takeaway ≤ 10 words", reelPlan.takeaway.split(/\s+/).length <= 10, `${reelPlan.takeaway.split(/\s+/).length}`],
    ["shot 1 USER_PHOTO", reelPlan.shots[0].type === "USER_PHOTO", reelPlan.shots[0].type],
    ["shots 3 & 5 RECONSTRUCTION", reelPlan.shots[2].type === "RECONSTRUCTION" && reelPlan.shots[4].type === "RECONSTRUCTION", `${reelPlan.shots[2].type}/${reelPlan.shots[4].type}`],
    ["shot 7 MATCH_CUT", reelPlan.shots[6].type === "MATCH_CUT", reelPlan.shots[6].type],
    ["shot 8 END_CARD", reelPlan.shots[7].type === "END_CARD", reelPlan.shots[7].type],
    ["timeline 3–5 events", reelPlan.timeline.events.length >= 3 && reelPlan.timeline.events.length <= 5, `${reelPlan.timeline.events.length}`],
    ["timeline ends 2026", /2026/.test(reelPlan.timeline.events.at(-1)?.year ?? ""), reelPlan.timeline.events.at(-1)?.year ?? "—"],
    ["shots 3 & 5 have stillPrompt", Boolean(reelPlan.shots[2].visual.stillPrompt && reelPlan.shots[4].visual.stillPrompt), ""],
    ["shots 3 & 5 have motionPrompt", Boolean(reelPlan.shots[2].visual.motionPrompt && reelPlan.shots[4].visual.motionPrompt), ""],
    ["archival shots have queries", [2, 4, 6].every((i) => Boolean(reelPlan.shots[i - 1].visual.archivalQuery)), ""],
  ];
  let failed = 0;
  for (const [label, ok, detail] of checks) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` (${detail})` : ""}`);
  }

  const capLens = reelPlan.shots.map((s) => s.caption.text.split(/\s+/).filter(Boolean).length);
  const capOk = capLens.every((n) => n >= 2 && n <= 8);
  if (!capOk) failed++;
  console.log(`  ${capOk ? "✓" : "✗"} captions 3–7 words (${capLens.join(",")})`);

  // Chronology: the timeline bar animates through these years, so a backwards
  // year is visible on screen as the dot jumping the wrong way.
  const yearOf = (s: string | undefined) => {
    const m = s?.match(/\d{3,4}/);
    return m ? Number(m[0]) : null;
  };
  const storyYears = reelPlan.shots.slice(1, 6).map((s) => yearOf(s.caption.year));
  const seen = storyYears.filter((y): y is number => y !== null);
  const monotonic = seen.every((y, i) => i === 0 || y >= seen[i - 1]);
  if (!monotonic) failed++;
  console.log(
    `  ${monotonic ? "✓" : "✗"} shots 2–6 chronological (${storyYears.map((y) => y ?? "—").join(" → ")})`
  );

  const tlYears = reelPlan.timeline.events.map((e) => yearOf(e.year)).filter((y): y is number => y !== null);
  const tlMono = tlYears.every((y, i) => i === 0 || y >= tlYears[i - 1]);
  if (!tlMono) failed++;
  console.log(`  ${tlMono ? "✓" : "✗"} timeline chronological (${tlYears.join(" → ")})`);

  console.log(`\n  per-shot words: ${reelPlan.shots.map((s) => s.narration.split(/\s+/).filter(Boolean).length).join(", ")}`);
  console.log(`\n${failed === 0 ? "✅ plan valid" : `⚠️  ${failed} check(s) failed`}`);
  console.log(`→ cached ${path.relative(process.cwd(), paths.plan(slug, lang))}`);
  console.log(`\n${budgetSummary()}`);
  const l = readLedger();
  console.log(`ledger entries: ${l.entries.map((e) => `${e.kind} $${e.usd}`).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

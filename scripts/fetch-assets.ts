/**
 * CLI over lib/assets.ts — pull archival material for a cached plan and write
 * the manifest + render props. $0 when ALLOW_MEDIA/ALLOW_SORA are false.
 *
 *   npm run assets -- --slug=qutub-minar --lang=en
 *   npm run assets -- --slug=qutub-minar --media      # allow stills/Sora/TTS (Phase 5)
 *   npm run assets -- --probe="Qutb Minar Beato"      # inspect Commons ranking
 */

import "../lib/env";
import path from "node:path";
import { buildAssets, writeRenderProps } from "../lib/assets";
import { getPlan, paths } from "../lib/cache";
import { budgetSummary } from "../lib/budget";
import { searchCommons } from "../lib/wikimedia";
import type { Lang } from "../lib/types";

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const slug = arg("slug", "qutub-minar")!;
  const lang = (arg("lang", "en") as Lang)!;

  const plan = getPlan(slug, lang);
  if (!plan) {
    console.error(`No plan at ${path.relative(process.cwd(), paths.plan(slug, lang))}`);
    console.error(`Run the pipeline first, or seed a plan there.`);
    process.exit(1);
  }

  console.log(`\n${plan.monument.name} — building assets`);
  console.log(`${budgetSummary()}\n`);

  const assets = await buildAssets(plan, {
    skipMedia: !flag("media"),
    onProgress: (m) => console.log(`  · ${m}`),
  });

  for (const s of assets.shots) {
    const attr = s.attribution ? ` — ${s.attribution.artist} · ${s.attribution.license}` : "";
    console.log(`  shot ${s.shotId}: ${s.kind.padEnd(11)} ${s.attribution?.title ?? path.basename(s.src)}${attr}`);
  }

  const propsPath = writeRenderProps(plan, assets, lang);
  const real = assets.shots.filter((s) => s.kind === "archival").length;
  const gen = assets.shots.filter((s) => s.kind === "sora" || s.kind === "still").length;

  console.log(`\n→ manifest  ${path.relative(process.cwd(), paths.manifest(slug))}`);
  console.log(`→ props     ${path.relative(process.cwd(), propsPath)}`);
  console.log(`   ${real} archival · ${gen} generated · ${assets.shots.filter((s) => s.kind === "placeholder").length} placeholder`);
  console.log(`\n${budgetSummary()}`);
}

async function probe(q: string) {
  const c = await searchCommons(q);
  console.log(`\n"${q}" → ${c.length} licensable candidates\n`);
  for (const x of c.slice(0, 8)) {
    console.log(`  ${String(Math.round(x.score)).padStart(4)}  ${x.title}`);
    console.log(`        ${x.width}×${x.height} · ${x.license} · ${x.artist} · ${x.date || "no date"}`);
  }
}

const probeQ = arg("probe");
(probeQ ? probe(probeQ) : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});

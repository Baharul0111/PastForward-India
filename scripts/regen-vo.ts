/**
 * Regenerate ONLY the per-shot narration for a cached plan.
 *
 * Why this exists: a disk cleanup removed public/assets/qutub-minar/vo*-en.mp3
 * while the (expensive) Sora clips and stills survived. `npm run assets` would
 * recover the VO, but it also re-searches Commons and can swap out verified
 * archival plates. This touches audio only — images are never re-fetched.
 *
 *   npm run vo -- --slug=qutub-minar --lang=en
 *   npm run vo -- --slug=qutub-minar --lang=en --force   # re-buy existing clips
 *
 * Cost: $0.0015 per shot (8 shots ≈ $0.012). Existing clips are reused for $0
 * unless --force. Narration is NEVER time-compressed — the reel's windows are
 * sized for natural pace (see lib/assets.ts).
 */

import "../lib/env";
import fs from "node:fs";
import path from "node:path";
import { budgetSummary } from "../lib/budget";
import { getManifest, getPlan, paths, putManifest } from "../lib/cache";
import { narrate } from "../lib/openai";
import type { AssetManifest, Lang } from "../lib/types";

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const slug = arg("slug", "qutub-minar")!;
  const lang = (arg("lang", "en") as Lang)!;
  const force = flag("force");

  const plan = getPlan(slug, lang);
  if (!plan) {
    console.error(`No plan at ${path.relative(process.cwd(), paths.plan(slug, lang))}`);
    process.exit(1);
  }

  const dir = paths.assetDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n${plan.monument.name} (${lang}) — narration only`);
  console.log(`${budgetSummary()}\n`);

  const vo: (string | null)[] = [];
  let bought = 0;

  for (const shot of plan.shots) {
    const out = path.join(dir, `vo${shot.id}-${lang}.mp3`);
    const have = fs.existsSync(out) && fs.statSync(out).size > 1000;

    if (have && !force) {
      console.log(`  · shot ${shot.id}: reusing ($0)`);
    } else {
      const got = await narrate({ text: shot.narration, outPath: out });
      if (got) {
        bought++;
        console.log(`  · shot ${shot.id}: recorded — "${shot.narration.slice(0, 52)}…"`);
      } else {
        console.warn(`  · shot ${shot.id}: TTS returned nothing (ALLOW_MEDIA off, or empty line)`);
      }
    }

    vo.push(
      fs.existsSync(out) ? `/assets/${slug}/vo${shot.id}-${lang}.mp3` : `/mock/vo-shot${shot.id}.mp3`
    );
  }

  // Keep the manifest's vo array honest for this language.
  const manifest = getManifest(slug);
  if (manifest) {
    const updated: AssetManifest = { ...manifest, vo };
    putManifest(updated);
    console.log(`\n→ manifest ${path.relative(process.cwd(), paths.manifest(slug))} vo[] updated`);
  } else {
    console.warn("\n! no manifest on disk — VO written, but nothing to update");
  }

  console.log(`   ${bought} recorded · ${plan.shots.length - bought} reused`);
  console.log(`\n${budgetSummary()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

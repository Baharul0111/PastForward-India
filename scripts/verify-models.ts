/**
 * Phase 0 — verify the four model IDs in config/models.ts against GET /v1/models.
 * Costs $0. Run: npm run verify:models
 *
 * Prints a table for memory.md and writes cache/models-verified.json so
 * lib/openai.ts can fall back automatically without another round trip.
 */

import fs from "node:fs";
import path from "node:path";
import { MODELS, FALLBACK_MODELS, type ModelRole } from "../config/models";

// minimal .env.local loader (no dotenv dep)
function loadEnv() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const KEY = process.env.OPENAI_API_KEY;

async function main() {
  if (!KEY || KEY.includes("REPLACE_ME")) {
    console.error("\n❌ OPENAI_API_KEY missing. Paste your key into .env.local, then re-run:\n   npm run verify:models\n");
    process.exit(2);
  }

  const res = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${KEY}` },
  });

  if (!res.ok) {
    console.error(`❌ GET /v1/models → ${res.status} ${res.statusText}`);
    console.error(await res.text());
    process.exit(1);
  }

  const body = (await res.json()) as { data: { id: string }[] };
  const ids = new Set(body.data.map((m) => m.id));
  const all = Array.from(ids).sort();

  const roles: ModelRole[] = ["vision", "image", "video", "tts"];
  const resolved: Record<string, string> = {};

  console.log(`\n${all.length} models visible to this key.\n`);
  console.log("| Role | Configured | Present? | Fallback | Present? | → USING |");
  console.log("|---|---|---|---|---|---|");

  for (const role of roles) {
    const primary = MODELS[role];
    const fb = FALLBACK_MODELS[role];
    const pOk = ids.has(primary);
    const fOk = ids.has(fb);
    const using = pOk ? primary : fOk ? fb : "❌ NONE";
    resolved[role] = pOk ? primary : fOk ? fb : "";
    console.log(`| ${role} | ${primary} | ${pOk ? "✅" : "—"} | ${fb} | ${fOk ? "✅" : "—"} | **${using}** |`);
  }

  // Show every candidate per family so we can pick a real ID if both miss.
  const families: [string, RegExp][] = [
    ["gpt-5 / gpt-4.1 (vision+plan)", /^(gpt-5|gpt-4\.1|gpt-4o)/],
    ["image", /image/],
    ["video / sora", /sora|video/],
    ["tts / audio", /tts|audio-speech|speech/],
  ];
  for (const [label, re] of families) {
    const hits = all.filter((id) => re.test(id));
    console.log(`\n${label}:\n  ${hits.length ? hits.join("\n  ") : "(none visible)"}`);
  }

  fs.mkdirSync(path.join(process.cwd(), "cache"), { recursive: true });
  fs.writeFileSync(
    path.join(process.cwd(), "cache", "models-verified.json"),
    JSON.stringify({ verifiedAt: new Date().toISOString(), resolved, allModels: all }, null, 2)
  );
  console.log("\n→ wrote cache/models-verified.json");

  const missing = roles.filter((r) => !resolved[r]);
  if (missing.length) {
    console.log(`\n⚠️  No usable ID for: ${missing.join(", ")} — pick from the family lists above and edit config/models.ts.`);
  } else {
    console.log("\n✅ All four roles have a usable model ID.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

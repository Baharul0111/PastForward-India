/**
 * Phase 0 — build /public/mock fixtures. Costs $0. Run: npm run mocks
 *
 *  - 6 placeholder 1024×1536 stills (era-labelled, gradient, so Phase 3 framing
 *    decisions are made against something with real tonal range)
 *  - 8 silent per-shot VO mp3s at the exact template durations
 *  - silent stand-ins for the 4 CC0 audio beds until the user drops the real ones
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { SHOT_TEMPLATE } from "../lib/types";

const ROOT = process.cwd();
const MOCK = path.join(ROOT, "public", "mock");
const AUDIO = path.join(ROOT, "public", "audio");

interface Placeholder {
  file: string;
  label: string;
  era: string;
  top: string;
  bottom: string;
  ink: string;
}

const PLACEHOLDERS: Placeholder[] = [
  { file: "userphoto.jpg", label: "USER PHOTO", era: "2026 · today", top: "#7c8b93", bottom: "#2b3339", ink: "#f2efe9" },
  { file: "shot2.jpg", label: "ARCHIVAL", era: "c. 1199 · foundation", top: "#c9a476", bottom: "#4a3623", ink: "#fdf6e7" },
  { file: "shot3.jpg", label: "RECONSTRUCTION", era: "c. 1200 · first storey", top: "#b8703f", bottom: "#3d2216", ink: "#fdeedd" },
  { file: "shot4.jpg", label: "ARCHIVAL", era: "1220s · it grows", top: "#d8c9a3", bottom: "#5c4f36", ink: "#fffaef" },
  { file: "shot5.jpg", label: "RECONSTRUCTION", era: "c. 1230 · five storeys", top: "#a9856a", bottom: "#33211a", ink: "#fdf1e6" },
  { file: "shot6.jpg", label: "ARCHIVAL", era: "1368 · lightning", top: "#8d7f8f", bottom: "#26202b", ink: "#f4eef6" },
];

const W = 1024;
const H = 1536;

function svgFor(p: Placeholder): string {
  // Vertical band pattern gives Ken Burns something to actually move across.
  const bands = Array.from({ length: 9 }, (_, i) => {
    const y = 120 + i * 150;
    return `<rect x="0" y="${y}" width="${W}" height="2" fill="${p.ink}" opacity="0.06"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${p.top}"/>
      <stop offset="100%" stop-color="${p.bottom}"/>
    </linearGradient>
    <radialGradient id="v" cx="50%" cy="42%" r="72%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  ${bands}
  <!-- a crude tapering tower silhouette: gives KenBurns/MatchCut a subject to align on -->
  <polygon points="${W / 2 - 150},${H - 140} ${W / 2 - 95},420 ${W / 2 + 95},420 ${W / 2 + 150},${H - 140}"
           fill="#000" opacity="0.22"/>
  <rect x="${W / 2 - 105}" y="360" width="210" height="26" fill="#000" opacity="0.22"/>
  <rect width="${W}" height="${H}" fill="url(#v)"/>
  <text x="${W / 2}" y="${H / 2 - 20}" font-family="Georgia,serif" font-size="72" font-weight="700"
        fill="${p.ink}" text-anchor="middle" opacity="0.92">${p.label}</text>
  <text x="${W / 2}" y="${H / 2 + 46}" font-family="Helvetica,Arial,sans-serif" font-size="34"
        letter-spacing="4" fill="${p.ink}" text-anchor="middle" opacity="0.75">${p.era.toUpperCase()}</text>
  <text x="${W / 2}" y="${H - 70}" font-family="Helvetica,Arial,sans-serif" font-size="24"
        letter-spacing="6" fill="${p.ink}" text-anchor="middle" opacity="0.45">PLACEHOLDER · NOT FINAL ART</text>
</svg>`;
}

/**
 * Tileable 35mm grain (skills.md §6). Generated once and tiled with a per-frame
 * offset in GrainOverlay — an feTurbulence filter recomputed every frame cost
 * ~100s of render time for the same look.
 */
async function makeGrain() {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  // Deterministic, mid-grey biased so `overlay` blending stays tonally neutral.
  let seed = 20260815;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < S * S; i++) {
    // Sum of two uniforms clusters values around mid-grey the way real grain does.
    const v = 128 + (rnd() + rnd() - 1) * 118;
    const c = Math.max(0, Math.min(255, Math.round(v)));
    buf[i * 4] = c;
    buf[i * 4 + 1] = c;
    buf[i * 4 + 2] = c;
    buf[i * 4 + 3] = 255;
  }
  const out = path.join(MOCK, "grain.png");
  await sharp(buf, { raw: { width: S, height: S, channels: 4 } }).png().toFile(out);
  console.log(`  ✓ grain.png (${S}×${S} tileable)`);
}

async function makeImages() {
  fs.mkdirSync(MOCK, { recursive: true });
  for (const p of PLACEHOLDERS) {
    const out = path.join(MOCK, p.file);
    await sharp(Buffer.from(svgFor(p))).jpeg({ quality: 88 }).toFile(out);
    console.log(`  ✓ ${p.file}  (${p.label} · ${p.era})`);
  }
}

function silentAudio(outPath: string, seconds: number) {
  execFileSync(
    "ffmpeg",
    [
      "-y", "-hide_banner", "-loglevel", "error",
      "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
      "-t", String(seconds),
      "-c:a", "libmp3lame", "-b:a", "64k",
      outPath,
    ],
    { stdio: "inherit" }
  );
}

function makeAudio() {
  // 8 per-shot VO clips at exact template durations
  for (const shot of SHOT_TEMPLATE) {
    const dur = shot.end - shot.start;
    const out = path.join(MOCK, `vo-shot${shot.id}.mp3`);
    silentAudio(out, dur);
    console.log(`  ✓ vo-shot${shot.id}.mp3  (${dur.toFixed(1)}s silent)`);
  }

  // Silent stand-ins for the CC0 beds. The user overwrites these in /public/audio.
  fs.mkdirSync(AUDIO, { recursive: true });
  const beds: [string, number][] = [
    ["music.mp3", 28],
    ["whoosh.mp3", 1],
    ["stone.mp3", 3],
    ["ambience.mp3", 6],
  ];
  for (const [file, dur] of beds) {
    const out = path.join(AUDIO, file);
    if (fs.existsSync(out) && fs.statSync(out).size > 20000) {
      console.log(`  · public/audio/${file} already real (${fs.statSync(out).size} bytes) — kept`);
      continue;
    }
    silentAudio(out, dur);
    console.log(`  ✓ public/audio/${file}  (${dur}s SILENT placeholder — replace with CC0)`);
  }
}

async function main() {
  console.log("Placeholder stills →");
  await makeImages();
  await makeGrain();
  console.log("\nSilent audio →");
  makeAudio();
  console.log("\nMock fixtures ready in public/mock/ and public/audio/.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

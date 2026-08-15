/**
 * Remotion render entry point. Called by the orchestrator and manually:
 *
 *   npm run render                       # mock Reel  → public/reels/qutub-minar-en.mp4
 *   npm run render -- --comp=TestComp    # Phase 0 smoke test
 *   npm run render -- --props=cache/plans/qutub-minar-en.render.json --out=public/reels/x.mp4
 *
 * Costs $0 forever.
 */

import fs from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mockReelProps } from "../remotion/mockProps";
import { DURATION_FRAMES } from "../lib/types";

const ROOT = process.cwd();

function arg(name: string, fallback?: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

export async function render(opts: {
  compositionId?: string;
  inputProps?: Record<string, unknown>;
  outPath: string;
  onProgress?: (pct: number) => void;
}) {
  const compositionId = opts.compositionId ?? "Reel";
  const t0 = Date.now();

  console.log(`[render] bundling…`);
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, "remotion", "index.ts"),
    publicDir: path.join(ROOT, "public"),
    onProgress: () => undefined,
  });

  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps: opts.inputProps ?? {},
  });

  // Guardrail: the reel is ALWAYS 840 frames.
  if (compositionId === "Reel" && composition.durationInFrames !== DURATION_FRAMES) {
    throw new Error(`Reel must be ${DURATION_FRAMES} frames, composition reports ${composition.durationInFrames}`);
  }

  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });

  // Render to a temp file and rename on success. reelExists() only checks size,
  // so a half-written mp4 at the final path would be served as a valid cache hit.
  const tmpPath = `${opts.outPath}.rendering.mp4`;
  console.log(`[render] ${compositionId} → ${path.relative(ROOT, opts.outPath)}`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: tmpPath,
    inputProps: opts.inputProps ?? {},
    onProgress: ({ progress }) => opts.onProgress?.(progress),
  });
  fs.renameSync(tmpPath, opts.outPath);

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[render] done in ${secs}s → ${opts.outPath}`);
  return opts.outPath;
}

async function main() {
  const compositionId = arg("comp", "Reel")!;
  const propsPath = arg("props");
  const inputProps = propsPath
    ? (JSON.parse(fs.readFileSync(path.resolve(ROOT, propsPath), "utf8")) as Record<string, unknown>)
    : compositionId === "Reel"
      ? (mockReelProps as unknown as Record<string, unknown>)
      : {};

  const outPath = path.resolve(
    ROOT,
    arg("out", compositionId === "Reel" ? "public/reels/qutub-minar-en.mp4" : "public/reels/_test.mp4")!
  );

  let last = -1;
  await render({
    compositionId,
    inputProps,
    outPath,
    onProgress: (p) => {
      const pct = Math.floor(p * 100);
      if (pct >= last + 10) {
        last = pct;
        process.stdout.write(`  ${pct}%\n`);
      }
    },
  });
}

// Only run the CLI when invoked directly, so the orchestrator can import render().
const invokedDirectly = process.argv[1]?.includes("render.ts");
if (invokedDirectly) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

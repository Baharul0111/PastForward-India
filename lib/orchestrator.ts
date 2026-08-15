/**
 * The pipeline state machine (architecture.md §4) with the full failure ladder
 * (§11). Every step has a fallback — the reel ALWAYS completes.
 *
 * Runs in-process on the Next node runtime and reports through
 * cache/status/{job}.json, which the UI polls every 1.5s.
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildAssets, writeRenderProps } from "./assets";
import {
  getPlan,
  getQuestions,
  getStatus,
  newJobId,
  paths,
  putPlan,
  putQuestions,
  putSlugAlias,
  putStatus,
  reelExists,
  resolveCachedSlug,
  slugify,
} from "./cache";
import { generateQuestions, identify, plan as planCall, translatePlan } from "./openai";
import { STEP_LABELS } from "./prompts";
import { research } from "./wikipedia";
import { DURATION_SECONDS } from "./types";
import type { JobStatus, Lang, ReelPlan, StepId, SubjectCategory, WaitQuestion } from "./types";

const STEPS: StepId[] = ["identify", "research", "plan", "assets", "reconstruct", "narrate", "render"];

function hasKey(): boolean {
  const k = process.env.OPENAI_API_KEY;
  return Boolean(k && !k.includes("REPLACE_ME"));
}

function emit(
  job: string,
  slug: string,
  lang: Lang,
  step: StepId,
  done: StepId[],
  extra: Partial<JobStatus> = {}
) {
  const idx = STEPS.indexOf(step);
  const pct = step === "done" ? 100 : Math.max(3, Math.round(((idx + 0.5) / STEPS.length) * 100));
  putStatus({
    job,
    slug,
    lang,
    step,
    label: STEP_LABELS[step] ?? step,
    done,
    pct,
    updatedAt: Date.now(),
    ...extra,
  });
}

export interface StartArgs {
  name: string;
  lang: Lang;
  /** data URL of the user's photo */
  photo?: string;
}

/**
 * In-flight jobs keyed by slug+lang. React StrictMode double-invokes effects in
 * dev, so one page load POSTs /api/generate twice ~1ms apart. Without this the
 * pipeline runs twice: double OpenAI spend AND two renders racing on the same
 * output path. Returning the existing job makes the second call a no-op.
 */
const inFlight = new Map<string, string>();

/**
 * The in-process map above only dedupes callers inside THIS node process. A CLI
 * run, a restarted dev server, or a second browser tab after a reload all slip
 * past it — and because the cache short-circuit only recognises a FINISHED reel,
 * a subject that is 93% rendered looks exactly like one never started. The
 * result is a second full billable pipeline and two concurrent renders, which
 * has already exhausted the disk once on this machine.
 *
 * The lock is advisory and self-healing: a stale one (dead job, or older than
 * the longest plausible run) is ignored rather than blocking the subject forever.
 */
const LOCK_TTL_MS = 10 * 60_000;

function lockPath(key: string): string {
  return path.join(process.cwd(), "cache", "locks", `${key}.json`);
}

function readLock(key: string): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(lockPath(key), "utf8")) as { job: string; at: number };
    if (Date.now() - raw.at > LOCK_TTL_MS) return null;
    // A lock whose job already finished or died is not a lock.
    const st = getStatus(raw.job);
    if (!st || st.step === "done" || st.step === "error") return null;
    return raw.job;
  } catch {
    return null;
  }
}

function writeLock(key: string, job: string): void {
  try {
    const p = lockPath(key);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ job, at: Date.now() }));
  } catch {
    /* a lock we cannot write is a lock we do without */
  }
}

function clearLock(key: string): void {
  try {
    fs.unlinkSync(lockPath(key));
  } catch {
    /* already gone */
  }
}

/* ------------------------------------------------------------------ */
/* Demo pacing                                                         */
/* ------------------------------------------------------------------ */

/**
 * How long a CACHED subject should be made to take, in ms. 0 = off (normal).
 *
 * The cache short-circuit is the product's best trick — a photographed monument
 * comes back instantly for $0 — but it also skips the whole wait screen, so a
 * recording of the cached path never shows the questions that are half the
 * experience. This paces a cache hit out over a set time so the questions can
 * be answered on camera, without regenerating anything or spending on media.
 *
 * Read from disk per request rather than from the environment, so it can be
 * switched on and off mid-session without restarting the dev server.
 *   cache/demo.json  →  { "waitMs": 60000 }
 */
function demoWaitMs(): number {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "cache", "demo.json"), "utf8"));
    const ms = Number(raw?.waitMs ?? 0);
    return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 5 * 60_000) : 0;
  } catch {
    return 0;
  }
}

/**
 * Walk a cached reel through the real step sequence over `waitMs`, generating
 * REAL questions for the subject on the way. Nothing is re-rendered and no media
 * is bought — the reel already exists; only the reveal is paced.
 */
async function runCachedShowcase(job: string, slug: string, args: StartArgs, waitMs: number) {
  const lang = args.lang;
  const done: StepId[] = [];
  let questions: WaitQuestion[] | null | undefined;
  let category: SubjectCategory | undefined;

  const plan = getPlan(slug, lang);
  const startYear = plan?.timeline.startYear;
  category = plan?.category;

  const show = (s: StepId, label: string, pct: number) =>
    emit(job, slug, lang, s, [...done], {
      label,
      pct,
      ...(startYear ? { startYear } : {}),
      ...(questions !== undefined ? { questions } : {}),
      ...(category ? { category } : {}),
    });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Start the questions call IMMEDIATELY, before the pacing begins, so it is
  // already in flight while the identify phase plays out. It is the only thing
  // here with real latency and the only thing the viewer waits on.
  const subjectName = plan?.monument.name ?? args.name;
  const questionsPromise: Promise<WaitQuestion[] | null> = (async () => {
    // Cached questions are instant, which is what makes them usable at all on a
    // replay — generating takes ~35s, longer than the whole reveal.
    const onDisk = getQuestions(slug, lang);
    if (onDisk?.length) return onDisk;
    if (!hasKey()) return null;
    const found = await research(subjectName);
    if (!found?.text) return null;
    const fresh = await generateQuestions({
      name: subjectName,
      category: category ?? "monument",
      description: found.text.slice(0, 1200),
    });
    if (fresh?.length) putQuestions(slug, lang, fresh);
    return fresh;
  })().catch(() => null);
  // Fractions of the total wait given to each phase. Questions land early, in
  // the research slot, so there is time to actually answer them.
  const phases: [StepId, string, number, number][] = [
    ["identify", "Working out what you're looking at…", 0.06, 8],
    ["research", "Reading the historical record…", 0.08, 21],
    ["plan", "Deciding which five things actually matter…", 0.18, 36],
    ["assets", "Digging through the archives…", 0.28, 62],
    ["narrate", "Recording the narration…", 0.16, 80],
    ["render", `Cutting your ${Math.round(DURATION_SECONDS)} seconds…`, 0.24, 93],
  ];

  // Absolute schedule: each phase has a deadline measured from the start, so a
  // phase that runs long (the questions call) compresses the ones after it
  // rather than pushing the whole reveal past waitMs.
  const t0 = Date.now();
  let cumulative = 0;

  for (const [step, label, frac, pct] of phases) {
    cumulative += frac;
    const deadline = t0 + waitMs * cumulative;
    show(step, label, pct);

    if (step === "research") {
      // AWAITED, not fired-and-forgotten. Fire-and-forget resolved after the
      // final emit, so the questions never reached the screen at all. Awaiting
      // here also puts them up at the earliest useful moment, which is the whole
      // point — the viewer needs time to actually answer them.
      questions =
        (await Promise.race([
          questionsPromise,
          // Never let a slow model stall the reveal: fall back to the UI's own
          // deck rather than showing a shimmer for the entire minute.
          sleep(40_000).then(() => null),
        ])) ?? null;
      // Push them out the moment they exist, without waiting for the next phase.
      show(step, label, pct);
    }

    await sleep(Math.max(0, deadline - Date.now()));
    done.push(step);
  }

  emit(job, slug, lang, "done", STEPS, {
    reelUrl: paths.reelUrl(slug, lang),
    cached: true,
    ...(startYear ? { startYear } : {}),
    ...(questions !== undefined ? { questions } : {}),
    ...(category ? { category } : {}),
  });
}

export function startJob(args: StartArgs): { job: string; slug: string; cached: boolean } {
  // Resolve onto the spelling a reel is already cached under BEFORE deciding
  // whether this is a cache hit — "Qutb Minar" and "Qutub Minar" are one reel.
  const slug = resolveCachedSlug(slugify(args.name), args.lang);
  const key = `${slug}-${args.lang}`;

  const running = inFlight.get(key) ?? readLock(key);
  if (running) {
    console.log(`[orchestrator] ${key} already running as ${running} — reusing`);
    return { job: running, slug, cached: false };
  }

  const job = newJobId();

  // Cache short-circuit (architecture.md §4): a finished reel is instant and $0.
  if (reelExists(slug, args.lang)) {
    const waitMs = demoWaitMs();
    if (waitMs > 0) {
      // Demo pacing is on: walk the cached reel through the real steps so the
      // wait screen (and its questions) is actually visible on camera. Reported
      // as NOT cached so the client polls instead of jumping straight to the reel.
      console.log(`[orchestrator] demo pacing ${key} over ${waitMs}ms (reel already cached, $0 media)`);
      inFlight.set(key, job);
      writeLock(key, job);
      emit(job, slug, args.lang, "identify", []);
      void runCachedShowcase(job, slug, args, waitMs)
        .catch((e: unknown) => {
          // Never strand the viewer: fall back to serving the cached reel.
          console.error(`[orchestrator] showcase failed:`, e);
          emit(job, slug, args.lang, "done", STEPS, {
            reelUrl: paths.reelUrl(slug, args.lang),
            cached: true,
          });
        })
        .finally(() => {
          inFlight.delete(key);
          clearLock(key);
        });
      return { job, slug, cached: false };
    }

    emit(job, slug, args.lang, "done", STEPS, {
      reelUrl: paths.reelUrl(slug, args.lang),
      cached: true,
      startYear: getPlan(slug, args.lang)?.timeline.startYear,
    });
    return { job, slug, cached: true };
  }

  inFlight.set(key, job);
  writeLock(key, job);
  emit(job, slug, args.lang, "identify", []);
  void run(job, slug, args)
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[orchestrator] ${job} failed:`, message);
      emit(job, slug, args.lang, "error", [], { error: message });
    })
    .finally(() => {
      inFlight.delete(key);
      clearLock(key);
    });

  return { job, slug, cached: false };
}

/** Persist the uploaded data URL so it can become shot 1 and the match cut. */
function saveUserPhoto(slug: string, dataUrl: string): string | undefined {
  try {
    const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/);
    if (!m) return undefined;
    const ext = m[1] === "jpeg" ? "jpg" : m[1];
    const dir = paths.assetDir(slug);
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, `today.${ext}`);
    fs.writeFileSync(out, Buffer.from(m[2], "base64"));
    return out;
  } catch {
    return undefined;
  }
}

async function run(job: string, slug: string, args: StartArgs) {
  const lang = args.lang;
  const done: StepId[] = [];
  // Read-only extras for the wait screen; each is set once and then rides along
  // on every subsequent emit, because emit() rewrites the whole status file.
  let startYear: string | undefined;
  let questions: WaitQuestion[] | null | undefined;
  let category: SubjectCategory | undefined;
  // The step the pipeline is on RIGHT NOW. The questions call resolves whenever
  // it resolves, and re-emitting the last *finished* step would walk the
  // progress bar backwards.
  let currentStep: StepId = "identify";
  const step = (s: StepId, extra: Partial<JobStatus> = {}) => {
    currentStep = s;
    emit(job, slug, lang, s, [...done], {
      ...(startYear ? { startYear } : {}),
      ...(questions !== undefined ? { questions } : {}),
      ...(category ? { category } : {}),
      ...extra,
    });
  };
  const finish = (s: StepId) => done.push(s);

  /* ---------------- 1. IDENTIFY ---------------- */
  step("identify");
  let name = args.name;
  let city = "";
  let state = "";

  const userPhotoPath = args.photo ? saveUserPhoto(slug, args.photo) : undefined;

  // Runs for TYPED names too, not just photos. It is what classifies the subject
  // (a tiger is not a monument), and the category decides the story beats, the
  // archival vocabulary and the reconstruction art direction downstream.
  if ((args.photo || args.name) && hasKey()) {
    try {
      const id = await identify({ name: args.name || undefined, photoDataUrl: args.photo });
      if (id.confidence >= 0.5 && id.name) {
        name = id.name;
        city = id.city;
        state = id.state || id.region;
        category = id.category;
        // Remember that this spelling means this reel, so the next photo of it
        // short-circuits to the cache instead of paying for a cold generation.
        putSlugAlias(slugify(id.name), slug);
      } else if (id.category) {
        // Low confidence on WHAT it is can still carry a usable category.
        category = id.category;
      }
    } catch (e) {
      // Failure ladder step 1 — fall back to whatever the user typed.
      console.warn(`[orchestrator] identify failed, using typed name:`, e instanceof Error ? e.message : e);
    }
  }
  finish("identify");

  /* ---------------- 2. RESEARCH (free) ---------------- */
  step("research");
  const sources: { title: string; url: string }[] = [];
  let sourceText = "";

  const found = await research(name);
  if (found) {
    name = found.title;
    // Wikipedia's canonical title is a third spelling in its own right.
    putSlugAlias(slugify(found.title), slug);
    sourceText = found.text;
    sources.push({ title: `${found.title} — Wikipedia`, url: found.url });
    if (found.thin) console.warn(`[orchestrator] thin article for ${name} (${found.wordCount} words)`);
  }
  finish("research");

  /* ------------- 2b. WAIT-SCREEN QUESTIONS (fire and forget) ------------- */
  // Fired here rather than straight after identify: the "guess" question has to
  // reveal a REAL fact, and the research text is where real facts come from.
  // Research is a free Wikipedia fetch that takes about a second, so the viewer
  // still sees questions almost immediately.
  //
  // Never awaited — the reel must not wait on engagement, and a failure is
  // silent by design (null tells the UI to use its own fixed queue).
  if (hasKey() && sourceText) {
    void generateQuestions({
      name,
      category: category ?? "monument",
      description: sourceText.slice(0, 1200),
    })
      .then((qs) => {
        questions = qs;
        // Keep them: a replay of this subject can then show them instantly
        // instead of waiting ~35s to buy the same thing again.
        if (qs?.length) putQuestions(slug, lang, qs);
        // Re-emit at whatever step the pipeline has reached, so the questions
        // reach the poller without rewinding its progress.
        if (currentStep !== "done" && currentStep !== "error") step(currentStep);
      })
      .catch(() => {
        questions = null;
      });
  } else {
    questions = null;
  }

  /* ---------------- 3. PLAN ---------------- */
  step("plan");
  let reelPlan = getPlan(slug, lang);

  if (!reelPlan) {
    // A plan in ANY language is reusable: translate instead of re-planning (skills.md §11).
    const en = getPlan(slug, "en");
    if (en && lang !== "en" && hasKey()) {
      reelPlan = await translatePlan(en, lang);
      putPlan(reelPlan);
    } else if (hasKey() && sourceText) {
      reelPlan = await planCall({
        monument: name,
        city,
        slug,
        sourceText,
        sourceUrls: sources,
        language: lang,
        category,
      });
      if (city) reelPlan.monument.city = city;
      if (state) reelPlan.monument.state = state;
      // Persist it: buildAssets and every later re-render read the category off
      // the plan, and a cached plan must rebuild identically without re-identifying.
      reelPlan.category = category ?? "monument";
      putPlan(reelPlan);
    } else if (!hasKey()) {
      // No key: fall back to the bundled fixture so the app stays demoable.
      const fixture = path.join(process.cwd(), "public", "mock", "qutub-minar-en.json");
      reelPlan = JSON.parse(fs.readFileSync(fixture, "utf8")) as ReelPlan;
      reelPlan.monument.slug = slug;
      reelPlan.monument.name = name;
      reelPlan.language = lang;
      console.warn("[orchestrator] no OPENAI_API_KEY — using the mock fixture plan");
    } else {
      // Failure ladder step 2 — nothing to write from.
      throw new Error("We couldn't verify this site's history yet.");
    }
  }
  startYear = reelPlan.timeline.startYear;
  // A cached plan carries its own category; trust it over a fresh identify.
  if (reelPlan.category) category = reelPlan.category;
  finish("plan");

  /* ---------------- 4+5. ASSETS + RECONSTRUCTION ---------------- */
  step("assets");
  const assets = await buildAssets(reelPlan, {
    userPhotoPath,
    skipMedia: !hasKey(),
    // The assets step is by far the longest — two Sora clips at ~85s each plus
    // archival lookups — and it used to report a flat 50% for three or four
    // minutes. A progress bar that does not move reads as a hung app: the user
    // cannot tell a working render from a dead one, and their instinct is to
    // reload, which used to start a second billable job.
    //
    // buildAssets names the shot it is working on, so the shot number maps onto
    // real progress across the 50→88 band that this step owns.
    onProgress: (msg) => {
      const n = Number((msg.match(/shot (\d)/) ?? [])[1] ?? 0);
      const pct = /narration/i.test(msg)
        ? 88
        : n
          ? Math.round(52 + (n / reelPlan!.shots.length) * 34)
          : undefined;
      step("assets", { label: msg, ...(pct ? { pct } : {}) });
    },
  });
  finish("assets");
  // buildAssets covers the reconstruction and TTS work; mark them for the UI.
  step("reconstruct");
  finish("reconstruct");
  step("narrate");
  finish("narrate");

  /* ---------------- 6. RENDER (free) ---------------- */
  step("render");
  const propsPath = writeRenderProps(reelPlan, assets, lang);
  const outPath = paths.reel(slug, lang);
  await renderReel(propsPath, outPath);
  finish("render");

  currentStep = "done";
  emit(job, slug, lang, "done", done, {
    reelUrl: paths.reelUrl(slug, lang),
    startYear,
    ...(questions !== undefined ? { questions } : {}),
    ...(category ? { category } : {}),
  });
}

/**
 * Render in a child process. Keeps @remotion/bundler and its headless Chrome out
 * of the Next server bundle entirely, and keeps the dev server responsive.
 */
function renderReel(propsPath: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const rel = (p: string) => path.relative(process.cwd(), p);
    const child = execFile(
      "npx",
      ["tsx", "scripts/render.ts", `--props=${rel(propsPath)}`, `--out=${rel(outPath)}`],
      { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 16, timeout: 8 * 60_000 },
      (err, stdout, stderr) => {
        if (err) {
          console.error("[render]", stderr || stdout);
          reject(new Error(`render failed: ${(stderr || stdout || err.message).slice(-400)}`));
          return;
        }
        resolve();
      }
    );
    child.stdout?.on("data", (d: Buffer) => process.stdout.write(`[render] ${d}`));
  });
}

export { STEPS };

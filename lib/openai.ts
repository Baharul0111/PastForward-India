/**
 * EVERY OpenAI call in this app goes through this file (architecture.md §6).
 *
 * Each function MUST:
 *   1. assertAffordable(estimate)  — throws above the $25 hard stop
 *   2. respect the mock flags      — ALLOW_MEDIA (images+TTS), ALLOW_SORA (video)
 *   3. record(estimate)            — append to cache/budget.json after success
 *
 * Model IDs come only from config/models.ts (or cache/models-verified.json,
 * written by `npm run verify:models`). Never hardcode a model ID here.
 */

import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { FALLBACK_MODELS, MODELS, MODEL_PARAMS, type ModelRole } from "../config/models";
import { COST, allowMedia, allowSora, assertAffordable, record } from "./budget";
import {
  IDENTIFY_SYSTEM,
  QUESTIONS_SYSTEM,
  TTS_INSTRUCTIONS,
  fullMotionPrompt,
  fullStillPrompt,
  planPrompt,
  planUserMessage,
  questionsUserMessage,
  repairPrompt,
  translatePrompt,
} from "./prompts";
import {
  SHOT_TEMPLATE,
  SUBJECT_CATEGORIES,
  WAIT_QUESTION_COUNT,
  type Lang,
  type ReelPlan,
  type Shot,
  type SubjectCategory,
  type WaitQuestion,
} from "./types";

/* ------------------------------------------------------------------ */
/* Client + model resolution                                           */
/* ------------------------------------------------------------------ */

let _client: OpenAI | null = null;

export function client(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("REPLACE_ME")) {
    throw new Error("OPENAI_API_KEY is not set in .env.local — paste your key and restart the dev server.");
  }
  if (!_client) _client = new OpenAI({ apiKey });
  return _client;
}

interface VerifiedModels {
  resolved?: Partial<Record<ModelRole, string>>;
}

let _verified: VerifiedModels | null | undefined;

/** Prefers the ID that `npm run verify:models` actually saw in GET /v1/models. */
export function model(role: ModelRole): string {
  if (_verified === undefined) {
    try {
      _verified = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), "cache", "models-verified.json"), "utf8")
      ) as VerifiedModels;
    } catch {
      _verified = null;
    }
  }
  const v = _verified?.resolved?.[role];
  return v || MODELS[role] || FALLBACK_MODELS[role];
}

/**
 * Some params are model-family specific (e.g. reasoning models reject
 * `temperature`). The API names the offending param in its 400 — read it and
 * retry once without that param rather than guessing up front.
 */
async function withParamRetry<T>(
  run: (drop: Set<string>) => Promise<T>,
  label: string
): Promise<T> {
  try {
    return await run(new Set());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.match(/Unsupported parameter: '([^']+)'|Unknown parameter: '([^']+)'|'([a-z_]+)' is not supported/i);
    const bad = m?.[1] ?? m?.[2] ?? m?.[3];
    if (!bad) throw e;
    console.warn(`[openai] ${label}: API rejected '${bad}' — retrying without it. (${msg.slice(0, 140)})`);
    return run(new Set([bad]));
  }
}

/** Structured output via the Responses API. Returns the parsed object. */
async function responsesJson<S extends z.ZodTypeAny>(
  role: ModelRole,
  schema: S,
  schemaName: string,
  input: OpenAI.Responses.ResponseInput,
  opts: { temperature?: number; label: string }
): Promise<z.infer<S>> {
  const res = await withParamRetry(async (drop) => {
    const body: Record<string, unknown> = {
      model: model(role),
      input,
      text: { format: zodTextFormat(schema, schemaName) },
    };
    if (opts.temperature !== undefined && !drop.has("temperature")) body.temperature = opts.temperature;
    return client().responses.create(body as never) as Promise<OpenAI.Responses.Response>;
  }, opts.label);

  const text = res.output_text;
  if (!text) throw new Error(`${opts.label}: model returned no text output`);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${opts.label}: model output was not valid JSON: ${text.slice(0, 200)}`);
  }
  return schema.parse(raw) as z.infer<S>;
}

/* ------------------------------------------------------------------ */
/* 1. IDENTIFY                                                         */
/* ------------------------------------------------------------------ */

const IdentifySchema = z.object({
  name: z.string(),
  city: z.string(),
  state: z.string(),
  /** monument | building | natural_place | animal | other */
  category: z.string(),
  /** the Indian state or region; for a widespread species, its main range */
  region: z.string(),
  confidence: z.number(),
  alternatives: z.array(z.object({ name: z.string(), city: z.string() })),
  notes: z.string(),
});

export type IdentifyOut = Omit<z.infer<typeof IdentifySchema>, "category"> & {
  category: SubjectCategory;
};

/** Anything the model returns outside the union collapses to "other". */
function asCategory(raw: string): SubjectCategory {
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (SUBJECT_CATEGORIES as string[]).includes(v) ? (v as SubjectCategory) : "other";
}

/** Photo or name → subject + category. Vision call (~$0.005). */
export async function identify(args: { name?: string; photoDataUrl?: string }): Promise<IdentifyOut> {
  assertAffordable(COST.identify, "identify");

  const content: OpenAI.Responses.ResponseInputMessageContentList = [];
  if (args.photoDataUrl) {
    content.push({
      type: "input_text",
      text: args.name
        ? `The user typed "${args.name}" and took this photo. Identify the subject.`
        : "Identify the Indian subject in this photo — a place, a structure or an animal.",
    });
    content.push({ type: "input_image", image_url: args.photoDataUrl, detail: "low" });
  } else {
    content.push({ type: "input_text", text: `Identify this Indian subject: "${args.name ?? ""}"` });
  }

  const out = await responsesJson(
    "vision",
    IdentifySchema,
    "identification",
    [
      { role: "system", content: IDENTIFY_SYSTEM },
      { role: "user", content },
    ],
    { temperature: 0.2, label: "identify" }
  );

  record("identify", COST.identify, out.name);
  return { ...out, category: asCategory(out.category) };
}

/* ------------------------------------------------------------------ */
/* 2. PLAN                                                             */
/* ------------------------------------------------------------------ */

/**
 * Strict structured outputs require every property to be present, so anything
 * optional in ReelPlan is `.nullable()` here and normalised afterwards.
 */
const ShotSchema = z.object({
  id: z.number(),
  type: z.string(),
  narration: z.string(),
  caption: z.object({ year: z.string().nullable(), text: z.string() }),
  visual: z.object({
    archivalQuery: z.string().nullable(),
    stillPrompt: z.string().nullable(),
    motionPrompt: z.string().nullable(),
  }),
});

const PlanSchema = z.object({
  monument: z.object({ name: z.string(), city: z.string(), state: z.string() }),
  hook: z.string(),
  takeaway: z.string(),
  timeline: z.object({
    startYear: z.string(),
    events: z.array(z.object({ year: z.string(), label: z.string() })),
  }),
  shots: z.array(ShotSchema),
  narrationWordCount: z.number(),
  sources: z.array(z.object({ title: z.string(), url: z.string() })),
});

type PlanOut = z.infer<typeof PlanSchema>;

const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function narrationWords(shots: { narration: string }[]): number {
  return shots.reduce((n, s) => n + countWords(s.narration), 0);
}

/**
 * Server-side validation (architecture.md §5). The model is NEVER trusted for
 * timings or shot types — those come from SHOT_TEMPLATE.
 */
function normalise(out: PlanOut, slug: string, language: Lang): ReelPlan {
  if (out.shots.length !== 8) {
    throw new Error(`plan: expected exactly 8 shots, got ${out.shots.length}`);
  }

  const shots: Shot[] = SHOT_TEMPLATE.map((tpl) => {
    const m = out.shots.find((s) => s.id === tpl.id) ?? out.shots[tpl.id - 1];
    return {
      id: tpl.id,
      start: tpl.start,
      end: tpl.end,
      type: tpl.type,
      narration: (m?.narration ?? "").trim(),
      caption: {
        year: m?.caption?.year ?? undefined,
        text: (m?.caption?.text ?? "").trim(),
      },
      visual: {
        archivalQuery: m?.visual?.archivalQuery ?? undefined,
        stillPrompt: m?.visual?.stillPrompt ?? undefined,
        motionPrompt: m?.visual?.motionPrompt ?? undefined,
        kenBurns: tpl.kenBurns,
        grade: tpl.grade,
      },
      sfx: tpl.sfx,
    };
  });

  // The end card's spoken line IS the takeaway (skills.md §3 shot 8). Models
  // often leave shot 8's narration empty because the takeaway is a separate
  // field — fill it deterministically rather than spending a call on it. This
  // happens BEFORE the word count is taken, so the 65–75 check sees the truth
  // and the repair pass can rebalance if the total now overruns.
  const last = shots[7];
  if (!last.narration) last.narration = out.takeaway.trim();

  // 3–5 timeline events, last one must be 2026. Cap to 4 BEFORE appending the
  // present day, otherwise a plan that already returned 5 events loses the 2026
  // to the final slice — the bar would then end on a historical year.
  let events = out.timeline.events.slice(0, 5);
  if (!events.length || !/2026/.test(events[events.length - 1].year)) {
    events = [...events.slice(0, 4), { year: "2026", label: "You are standing here" }];
  }

  return {
    monument: { name: out.monument.name, city: out.monument.city, state: out.monument.state, slug },
    language,
    hook: out.hook.trim(),
    takeaway: out.takeaway.trim(),
    timeline: { startYear: out.timeline.startYear, events },
    shots,
    narrationWordCount: narrationWords(shots),
    sources: out.sources,
  };
}

export async function plan(args: {
  monument: string;
  city: string;
  slug: string;
  sourceText: string;
  sourceUrls: { title: string; url: string }[];
  language: Lang;
  category?: SubjectCategory;
}): Promise<ReelPlan> {
  assertAffordable(COST.plan, `plan ${args.monument}`);

  const system = planPrompt(args.monument, args.language);
  const user = planUserMessage({
    monument: args.monument,
    city: args.city,
    sourceText: args.sourceText,
    sourceUrls: args.sourceUrls,
    category: args.category,
  });

  const input: OpenAI.Responses.ResponseInput = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  let out = await responsesJson("vision", PlanSchema, "reel_plan", input, {
    temperature: 0.4,
    label: "plan",
  });
  record("plan", COST.plan, args.monument);

  let result = normalise(out, args.slug, args.language);

  // ONE repair pass if the narration is out of the 65–75 band (architecture.md §5).
  if (result.narrationWordCount < 65 || result.narrationWordCount > 75) {
    console.warn(`[openai] plan: narration is ${result.narrationWordCount} words — running one repair pass`);
    assertAffordable(COST.plan, "plan repair");
    out = await responsesJson(
      "vision",
      PlanSchema,
      "reel_plan",
      [
        ...input,
        { role: "assistant", content: JSON.stringify(out) },
        { role: "user", content: repairPrompt(result.narrationWordCount) },
      ],
      { temperature: 0.3, label: "plan-repair" }
    );
    record("plan", COST.plan, `${args.monument} repair`);
    const repaired = normalise(out, args.slug, args.language);
    // Keep the repair only if it actually moved toward the target.
    const before = Math.min(Math.abs(result.narrationWordCount - 70), 999);
    const after = Math.abs(repaired.narrationWordCount - 70);
    if (after < before) result = repaired;
    console.log(`[openai] plan: narration now ${result.narrationWordCount} words`);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/* 3. TRANSLATE (skills.md §11 — reuse the plan, never re-plan)        */
/* ------------------------------------------------------------------ */

const TranslateSchema = z.object({
  hook: z.string(),
  takeaway: z.string(),
  timelineLabels: z.array(z.string()),
  shots: z.array(z.object({ id: z.number(), narration: z.string(), captionText: z.string() })),
});

export async function translatePlan(source: ReelPlan, target: Lang): Promise<ReelPlan> {
  assertAffordable(COST.translate, `translate ${target}`);

  const payload = {
    hook: source.hook,
    takeaway: source.takeaway,
    timelineLabels: source.timeline.events.map((e) => e.label),
    shots: source.shots.map((s) => ({ id: s.id, narration: s.narration, captionText: s.caption.text })),
  };

  const out = await responsesJson(
    "vision",
    TranslateSchema,
    "translated_reel",
    [
      { role: "system", content: translatePrompt(target) },
      { role: "user", content: JSON.stringify(payload, null, 2) },
    ],
    { temperature: 0.3, label: `translate-${target}` }
  );
  record("translate", COST.translate, `${source.monument.slug} → ${target}`);

  return {
    ...source,
    language: target,
    hook: out.hook,
    takeaway: out.takeaway,
    timeline: {
      ...source.timeline,
      events: source.timeline.events.map((e, i) => ({ ...e, label: out.timelineLabels[i] ?? e.label })),
    },
    shots: source.shots.map((s) => {
      const t = out.shots.find((x) => x.id === s.id);
      return t
        ? { ...s, narration: t.narration, caption: { ...s.caption, text: t.captionText } }
        : s;
    }),
    narrationWordCount: narrationWords(
      source.shots.map((s) => ({ narration: out.shots.find((x) => x.id === s.id)?.narration ?? s.narration }))
    ),
  };
}

/* ------------------------------------------------------------------ */
/* 4. STILLS — gated by ALLOW_MEDIA                                    */
/* ------------------------------------------------------------------ */

/**
 * Reconstruction still. Cheap-first (skills.md §7): iterate at $0.05, never $0.40.
 * When the monument itself is in frame, pass `referenceImage` so the API uses
 * images.edit and the architecture stays geometrically correct.
 * Returns the written path, or null when mocked.
 */
export async function generateStill(args: {
  stillPrompt: string;
  era: string;
  region: string;
  outPath: string;
  referenceImage?: string;
  category?: SubjectCategory;
}): Promise<string | null> {
  if (!allowMedia()) {
    console.log(`[openai] ALLOW_MEDIA=false — still mocked for ${path.basename(args.outPath)}`);
    return null;
  }
  assertAffordable(COST.still, `still ${path.basename(args.outPath)}`);

  const prompt = fullStillPrompt(args.stillPrompt, args.era, args.region, args.category);
  const { size, quality } = MODEL_PARAMS.image;

  const res = await withParamRetry(async () => {
    if (args.referenceImage && fs.existsSync(args.referenceImage)) {
      // A bare ReadStream uploads as application/octet-stream and the API 400s
      // ("unsupported mimetype"). toFile() attaches an explicit content type.
      const ext = path.extname(args.referenceImage).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      const file = await toFile(fs.readFileSync(args.referenceImage), `reference${ext || ".jpg"}`, {
        type: mime,
      });
      return client().images.edit({
        model: model("image"),
        image: file,
        prompt,
        size: size as never,
        quality: quality as never,
      });
    }
    return client().images.generate({
      model: model("image"),
      prompt,
      size: size as never,
      quality: quality as never,
    });
  }, "still");

  const b64 = res.data?.[0]?.b64_json;
  const url = res.data?.[0]?.url;

  fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
  if (b64) {
    fs.writeFileSync(args.outPath, Buffer.from(b64, "base64"));
  } else if (url) {
    const img = await fetch(url);
    fs.writeFileSync(args.outPath, Buffer.from(await img.arrayBuffer()));
  } else {
    throw new Error("still: API returned neither b64_json nor url");
  }

  record("still", COST.still, path.basename(args.outPath));
  return args.outPath;
}

/* ------------------------------------------------------------------ */
/* 4b. WAIT-SCREEN QUESTIONS                                           */
/* ------------------------------------------------------------------ */

const QuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      chips: z.array(z.object({ label: z.string(), ack: z.string().nullable() })),
      kind: z.string(),
      reveal: z.string().nullable(),
    })
  ),
});

/**
 * The questions the viewer taps through while the reel renders.
 *
 * Deliberately best-effort: the caller treats null as "use the fixed queue" and
 * shows the viewer nothing. A failure here must never surface as an error or
 * delay the pipeline — it is engagement, not product.
 */
export async function generateQuestions(args: {
  name: string;
  category: SubjectCategory;
  description: string;
}): Promise<WaitQuestion[] | null> {
  try {
    assertAffordable(COST.questions, `questions ${args.name}`);

    const out = await responsesJson(
      "vision",
      QuestionsSchema,
      "wait_questions",
      [
        { role: "system", content: QUESTIONS_SYSTEM },
        { role: "user", content: questionsUserMessage(args) },
      ],
      // No `temperature`: the vision-tier model rejects it, so passing it cost a
      // 400 and a full retry on EVERY call — doubling the latency of the one
      // call the viewer is actually waiting on.
      { label: "questions" }
    );

    const cleaned: WaitQuestion[] = out.questions
      .filter((q) => q.question.trim() && q.chips.length >= 2)
      .slice(0, WAIT_QUESTION_COUNT)
      .map((q, i) => ({
        id: `q${i + 1}`,
        question: q.question.trim(),
        chips: q.chips
          .filter((c) => c.label.trim())
          .slice(0, 4)
          .map((c) => ({ label: c.label.trim(), ...(c.ack?.trim() ? { ack: c.ack.trim() } : {}) })),
        kind: q.kind === "guess" ? ("guess" as const) : ("poll" as const),
        ...(q.reveal?.trim() ? { reveal: q.reveal.trim() } : {}),
      }))
      .filter((q) => q.chips.length >= 2);

    if (cleaned.length < 2) {
      console.warn(`[openai] questions: only ${cleaned.length} usable — falling back`);
      return null;
    }

    // Exactly one guess. The model occasionally marks none or several; a guess
    // without a reveal has nothing to show, so it demotes to a poll.
    const guesses = cleaned.filter((q) => q.kind === "guess" && q.reveal);
    cleaned.forEach((q) => {
      if (q.kind === "guess" && !q.reveal) q.kind = "poll";
    });
    guesses.slice(1).forEach((q) => {
      q.kind = "poll";
      delete q.reveal;
    });

    record("questions", COST.questions, args.name);
    return cleaned;
  } catch (e) {
    console.warn(`[openai] questions failed:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 5. SORA — gated by ALLOW_SORA                                       */
/* ------------------------------------------------------------------ */

/**
 * Image-to-video reconstruction (architecture.md §6). The SDK has no `videos`
 * resource at 4.104, so this speaks the REST endpoint directly.
 *
 * Max 1 retry per clip. On any failure/timeout the caller Ken Burns the approved
 * still under the badge — a fully acceptable output (skills.md §7).
 * Wrapped so the provider stays swappable (Sora 2 API sunsets 2026-09-24).
 */
export async function generateReconstruction(args: {
  stillPath: string;
  stillPrompt: string;
  motionPrompt: string;
  era: string;
  region: string;
  category?: SubjectCategory;
  outPath: string;
  timeoutMs?: number;
}): Promise<string | null> {
  if (!allowSora()) {
    console.log(`[openai] ALLOW_SORA=false — Sora mocked for ${path.basename(args.outPath)}`);
    return null;
  }
  assertAffordable(COST.soraClip, `sora ${path.basename(args.outPath)}`);

  const apiKey = process.env.OPENAI_API_KEY!;
  const timeoutMs = args.timeoutMs ?? 120_000;
  const prompt = fullMotionPrompt(
    args.stillPrompt,
    args.motionPrompt,
    args.era,
    args.region,
    args.category
  );
  const { size, seconds } = MODEL_PARAMS.video;

  try {
    // 1) create the job — multipart so the approved still rides along
    const form = new FormData();
    form.append("model", model("video"));
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("seconds", seconds);
    if (fs.existsSync(args.stillPath)) {
      // The API requires input_reference to match the requested video dimensions
      // EXACTLY ("Inpaint image must match the requested width and height").
      // Stills are 1024×1536 (2:3) and video is 720×1280 (9:16), so cover-crop
      // rather than squash — the composition is already framed for vertical.
      const [vw, vh] = size.split("x").map(Number);
      const sharp = (await import("sharp")).default;
      const resized = await sharp(args.stillPath)
        .resize(vw, vh, { fit: "cover", position: "attention" })
        .png()
        .toBuffer();
      form.append(
        "input_reference",
        new Blob([new Uint8Array(resized)], { type: "image/png" }),
        `reference-${vw}x${vh}.png`
      );
    }

    const createRes = await fetch("https://api.openai.com/v1/videos", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!createRes.ok) {
      const body = await createRes.text();
      throw new Error(`POST /v1/videos → ${createRes.status}: ${body.slice(0, 300)}`);
    }
    const job = (await createRes.json()) as { id: string; status?: string };

    // 2) poll
    const started = Date.now();
    let status = job.status ?? "queued";
    while (status !== "completed") {
      if (Date.now() - started > timeoutMs) throw new Error(`sora: timed out after ${timeoutMs}ms`);
      if (status === "failed") throw new Error("sora: job reported failed");
      await new Promise((r) => setTimeout(r, 5000));
      const poll = await fetch(`https://api.openai.com/v1/videos/${job.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!poll.ok) throw new Error(`GET /v1/videos/${job.id} → ${poll.status}`);
      const body = (await poll.json()) as { status?: string };
      status = body.status ?? status;
      console.log(`[openai] sora ${job.id}: ${status} (${Math.round((Date.now() - started) / 1000)}s)`);
    }

    // 3) download
    const dl = await fetch(`https://api.openai.com/v1/videos/${job.id}/content`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!dl.ok) throw new Error(`GET /v1/videos/${job.id}/content → ${dl.status}`);
    fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
    fs.writeFileSync(args.outPath, Buffer.from(await dl.arrayBuffer()));

    record("soraClip", COST.soraClip, path.basename(args.outPath));
    return args.outPath;
  } catch (e) {
    console.warn(`[openai] sora failed → Ken Burns fallback. ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 6. TTS — gated by ALLOW_MEDIA                                       */
/* ------------------------------------------------------------------ */

/** One clip per shot (skills.md §11). Returns the path, or null when mocked. */
export async function narrate(args: { text: string; outPath: string }): Promise<string | null> {
  if (!allowMedia()) return null;
  if (!args.text.trim()) return null;

  assertAffordable(COST.ttsShot, `tts ${path.basename(args.outPath)}`);

  const speak = async (voice: string) =>
    client().audio.speech.create({
      model: model("tts"),
      voice: voice as never,
      input: args.text,
      instructions: TTS_INSTRUCTIONS,
      response_format: MODEL_PARAMS.tts.response_format as never,
    });

  let res: Awaited<ReturnType<typeof speak>>;
  try {
    res = await speak(MODEL_PARAMS.tts.voice);
  } catch (e) {
    console.warn(`[openai] tts voice '${MODEL_PARAMS.tts.voice}' failed — trying '${MODEL_PARAMS.tts.fallbackVoice}'`);
    res = await speak(MODEL_PARAMS.tts.fallbackVoice);
  }

  fs.mkdirSync(path.dirname(args.outPath), { recursive: true });
  fs.writeFileSync(args.outPath, Buffer.from(await res.arrayBuffer()));

  record("ttsShot", COST.ttsShot, path.basename(args.outPath));
  return args.outPath;
}

/**
 * ALL OpenAI model IDs live here. Never hardcode a model ID anywhere else.
 * Verified against GET /v1/models in Phase 0 — see scripts/verify-models.ts
 * and the "Verified model IDs" table in memory.md.
 */

export const MODELS = {
  /** identify (vision) + plan (structured outputs) */
  vision: "gpt-5-mini",
  /** reconstruction stills */
  image: "gpt-image-2",
  /** the two 4s reconstruction clips */
  video: "sora-2",
  /** per-shot narration */
  tts: "gpt-4o-mini-tts",
} as const;

/** Used automatically by lib/openai.ts if the primary ID is not in GET /v1/models. */
export const FALLBACK_MODELS = {
  vision: "gpt-4.1-mini",
  image: "gpt-image-1",
  video: "sora-2",
  tts: "gpt-4o-mini-tts",
} as const;

export type ModelRole = keyof typeof MODELS;

/** Fixed call parameters, kept next to the IDs so they are verified together. */
export const MODEL_PARAMS = {
  image: { size: "1024x1536", quality: "medium" },
  video: { size: "720x1280", seconds: "4" },
  tts: { voice: "marin", fallbackVoice: "cedar", response_format: "mp3" },
} as const;

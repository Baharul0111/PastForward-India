# PastForward India — ARCHITECTURE

> Read `skills.md` first (product bible), then this file. `phases.md` tells you WHEN to build each piece. `memory.md` tracks progress — update it after every phase.

## 1. What this app is

PastForward India turns any Indian monument into a 25–30 second vertical documentary reel. Input: place name OR a photo. Output: a 28.0-second, 720×1280 MP4 that looks human-edited — real archival material + programmatic motion graphics + exactly two labeled 4-second AI reconstructions + narrated voiceover (English or Indian languages) + sources card.

Tagline: **Point at history. Watch time move.**

Hard rules (never violate):
- The reel is ALWAYS exactly 28.0s (840 frames @ 30fps). Duration is enforced by the Remotion composition, never by the script length.
- Only ~8 of 28 seconds are AI-generated video (two 4s reconstructions). Everything else is archival images + code-driven motion.
- All AI calls go through OpenAI APIs only. Archival media comes from Wikimedia Commons (free, with attribution).
- Never exceed the budget guardrails in §8.

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 14+ (App Router, TypeScript) | One codebase for UI + API routes |
| Video composition | Remotion (`@remotion/renderer`, `@remotion/google-fonts`) | Programmatic editing = human-editor look, $0 per render |
| AI text/vision | OpenAI Responses API (structured outputs) | Identify + plan in cheap calls |
| AI images | OpenAI Images API (stills for reconstructions) | Cheap, reference-guided, correct architecture |
| AI video | OpenAI Sora 2 (`sora-2`, 720×1280, 4s, image-to-video) | Only for the 2 reconstruction clips |
| Narration | OpenAI `gpt-4o-mini-tts` (voice: `marin`, fallback `cedar`) | ~$0.01/reel, steerable tone, 50+ languages |
| Archival media | Wikimedia Commons API + Wikipedia REST API | Free, licensed, authentic |
| Storage/cache | Local filesystem (`/public`, `/cache`) | No DB, no auth — 4-hour build |

No login. No database. No user accounts.

## 3. Directory structure

```
pastforward/
├── app/
│   ├── page.tsx                     # Home: photo upload OR name input
│   ├── reel/[slug]/page.tsx         # Progress screen → video player + sources card + language toggle
│   └── api/
│       ├── identify/route.ts        # POST image|name → monument + confidence + alternatives
│       ├── generate/route.ts        # POST → orchestrator: runs full pipeline, writes status JSON
│       ├── status/[job]/route.ts    # GET → job status (UI polls every 1.5s)
│       └── reel/[slug]/route.ts     # GET → cached mp4 if exists
├── remotion/
│   ├── Root.tsx                     # registerRoot, Composition id="Reel", 840 frames, 30fps, 720×1280
│   ├── Reel.tsx                     # 8 <Sequence> blocks driven by ReelPlan JSON
│   └── components/
│       ├── KenBurnsImage.tsx        # pan/zoom on a still (direction + strength props)
│       ├── TimelineBar.tsx          # signature bottom bar, dot animates through years
│       ├── YearStamp.tsx            # big serif year (Playfair Display)
│       ├── CaptionBlock.tsx         # 3–7 word sans caption (Inter)
│       ├── GrainOverlay.tsx         # 35mm grain PNG loop, ~8% opacity, always on
│       ├── Grade.tsx                # per-era color grade wrapper (CSS filters)
│       ├── ReconstructionBadge.tsx  # tiny "HISTORICAL RECONSTRUCTION · c. 1200" label
│       ├── MatchCut.tsx             # old image → user photo dissolve + timeline sweep
│       └── EndCard.tsx              # takeaway line + PASTFORWARD INDIA branding
├── lib/
│   ├── types.ts                     # ReelPlan schema (§5) — single source of truth
│   ├── openai.ts                    # all OpenAI calls, wrapped with budget.ts
│   ├── prompts.ts                   # all prompt templates (copy from skills.md verbatim)
│   ├── wikipedia.ts                 # fetch article plaintext (free)
│   ├── wikimedia.ts                 # Commons image search + license/attribution capture
│   ├── budget.ts                    # cost estimator + ledger + hard-stop
│   ├── cache.ts                     # plan/asset/reel cache helpers (slug+lang keyed)
│   └── orchestrator.ts              # the pipeline state machine
├── config/models.ts                 # ALL model IDs here — verify at Phase 0, never hardcode elsewhere
├── scripts/render.ts                # node script: renderMedia(ReelPlan) → mp4
├── public/
│   ├── assets/{slug}/               # downloaded archival images + generated stills + sora clips + vo mp3s
│   ├── reels/{slug}-{lang}.mp4      # finished reels (THE cache)
│   ├── audio/music.mp3, whoosh.mp3, stone.mp3, ambience.mp3   # user drops these (CC0, Pixabay)
│   └── mock/                        # fixture ReelPlan (Qutub Minar), 6 placeholder images, silent vo
├── cache/
│   ├── plans/{slug}-{lang}.json     # ReelPlan cache
│   ├── status/{job}.json            # orchestrator progress
│   └── budget.json                  # running spend ledger
└── .env.local                       # OPENAI_API_KEY, ALLOW_MEDIA=false, ALLOW_SORA=false
```

## 4. Pipeline (data flow)

```
USER (photo | name, language)
   │
   ▼
IDENTIFY  ──────────── vision model, structured output
   │  confidence < 0.85 → return 3 tappable alternatives, wait for pick
   ▼
CACHE CHECK ────────── /public/reels/{slug}-{lang}.mp4 exists? → serve instantly, $0
   ▼
RESEARCH ───────────── Wikipedia REST plaintext (free). Web search tool ONLY if article missing/thin.
   ▼
PLAN (ONE call) ────── structured output → ReelPlan JSON (hook, 5 events, 8 shots, narration, queries, sources)
   ▼
ASSETS ─────────────── Wikimedia Commons search per shot query → download best + save attribution
   │                    gap? → Images API still (style prefix, reference photo when architecture matters)
   ▼
RECONSTRUCT (shots 3&5) ─ approved still → Sora 2 image-to-video, 4s, 720×1280
   │                    Sora fails/slow/disallowed → FALLBACK: Ken Burns the still (reel still completes!)
   ▼
NARRATE ────────────── per-shot TTS clips (auto-sync: clip N starts at shot N start)
   ▼
RENDER ─────────────── Remotion renderMedia → 28.0s mp4 → /public/reels/ → cache
   ▼
PLAYER ─────────────── vertical player + "How do we know this?" sources card + language toggle
```

Orchestrator writes `cache/status/{job}.json` after each step:
`{ step, label, done: [...], pct }` — labels are part of the UX ("Digging through the 1199 archives…", "Reconstructing what no camera ever saw…"). UI polls `/api/status/{job}`.

## 5. ReelPlan schema (`lib/types.ts`) — the spine of everything

```ts
export type Lang = "en" | "hi" | "kn" | "ta" | "te" | "bn";
export type ShotType = "USER_PHOTO" | "ARCHIVAL" | "RECONSTRUCTION" | "MOTION_GRAPHIC" | "MATCH_CUT" | "END_CARD";
export type Grade = "modern" | "archival" | "parchment" | "reconstruction";

export interface ReelPlan {
  monument: { name: string; city: string; state: string; slug: string };
  language: Lang;
  hook: string;                 // ≤ 10 words, creates a question (see skills.md §4)
  takeaway: string;             // ≤ 10 words, closing line
  timeline: { startYear: string; events: { year: string; label: string }[] }; // 3–5 dots, ends "2026"
  shots: Shot[];                // EXACTLY 8, timings fixed by template (skills.md §3)
  narrationWordCount: number;   // model must report; validate 65–75
  sources: { title: string; url: string }[];
}

export interface Shot {
  id: 1|2|3|4|5|6|7|8;
  start: number; end: number;   // seconds — server overwrites with template values, never trusts model
  type: ShotType;
  narration: string;            // this shot's spoken line
  caption: { year?: string; text: string };  // text: 3–7 words
  visual: {
    archivalQuery?: string;                  // ARCHIVAL: Wikimedia search string
    stillPrompt?: string;                    // RECONSTRUCTION: image prompt (server prepends style prefix)
    motionPrompt?: string;                   // RECONSTRUCTION: one camera move for Sora
    kenBurns: { direction: "in"|"out"|"left"|"right"; strength: number }; // vary across shots
    grade: Grade;
  };
  sfx: "stone" | "market" | "whoosh" | "ambient" | "none";
}
```

Server-side validation after the plan call: exactly 8 shots; overwrite start/end with template timings; word count 65–75 (if not, one repair call: "compress to 70 words, keep all years"); shots 3 and 5 are RECONSTRUCTION; shot 1 USER_PHOTO; shot 7 MATCH_CUT; shot 8 END_CARD.

## 6. OpenAI integration (`config/models.ts` + `lib/openai.ts`)

```ts
// config/models.ts — VERIFY AT PHASE 0 via GET /v1/models, adjust here only.
export const MODELS = {
  vision: "gpt-5-mini",          // fallback: "gpt-4.1-mini" — identify + plan (needs image input + structured outputs)
  image:  "gpt-image-2",         // fallback: "gpt-image-1" (deprecates Oct 2026). quality "medium", size "1024x1536"
  video:  "sora-2",              // 720x1280, seconds "4". NOTE: Sora 2 API sunsets Sept 24 2026 — fine for August; wrap in generateReconstruction() so provider is swappable.
  tts:    "gpt-4o-mini-tts",     // voice "marin", fallback "cedar"
};
```

Expected call shapes (verify against live docs if any 4xx — do NOT guess params):
- **Identify / Plan:** `POST /v1/responses` with `model`, `input` (text + optional `input_image` as base64 data URL), and structured output via JSON schema. Temperature 0.4 for plan.
- **Stills:** `POST /v1/images/generations` `{ model, prompt, size: "1024x1536", quality: "medium" }`. When architectural accuracy matters (the monument itself appears), use `POST /v1/images/edits` with the user's photo or best Wikimedia photo as reference image so geometry stays correct.
- **Sora:** `POST /v1/videos` `{ model: "sora-2", prompt, size: "720x1280", seconds: "4", input_reference: <approved still> }` → returns job → poll `GET /v1/videos/{id}` until `completed` → download `GET /v1/videos/{id}/content`. Timeout 120s → trigger fallback.
- **TTS:** `POST /v1/audio/speech` `{ model, voice, input, instructions, response_format: "mp3" }` — one call per shot (8 tiny clips). Instructions template in skills.md §11.

Every function in `lib/openai.ts` MUST: (1) check `budget.assertAffordable(estimate)` first, (2) respect mock flags (§8), (3) append actual estimate to `cache/budget.json` after success.

## 7. External free APIs

**Wikipedia (research):** `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&titles={name}&format=json&origin=*` → plaintext. Truncate to ~6,000 words before the plan call (token control). The plan prompt must say: *use ONLY this text; if a fact isn't in it, leave it out.*

**Wikimedia Commons (assets):** `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={query}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280&format=json&origin=*`
Pick: largest, oldest-looking, license in {Public domain, CC0, CC BY, CC BY-SA}. Save per asset: `{ url, artist, license, sourcePage }` → shown in the sources card. Query patterns: `"{monument} 19th century photograph"`, `"{monument} painting"`, `"{monument} engraving"`, `"{ruler} portrait"`, `"{city} old map"`.

## 8. Budget guardrails (`lib/budget.ts`) — NON-NEGOTIABLE

Env flags: `ALLOW_MEDIA` (images+TTS) and `ALLOW_SORA` — both default **false**. While false, `lib/openai.ts` returns fixtures from `/public/mock/` for those call types. Text/vision calls (pennies) are allowed from Phase 2 onward.

| Call | Est. cost | Mocked until |
|---|---|---|
| Identify (vision) | ~$0.005 | Phase 2 |
| Plan (structured) | ~$0.01–0.02 | Phase 2 |
| Still image (medium, 1024×1536) | ~$0.04–0.07 | Phase 5 (`ALLOW_MEDIA=true`) |
| Sora 4s clip | ~$0.40 | Phase 5 (`ALLOW_SORA=true`) |
| TTS full reel | ~$0.01 | Phase 5 |
| **New monument, full pipeline** | **~$0.95–1.10** | — |

Hard rules: ledger running total in `cache/budget.json`; `assertAffordable` throws if projected total > **$25**; Sora retries max 1 per shot; NEVER call Sora from a hot-reload/dev loop — only via the orchestrator; cached reels bypass everything.

## 9. Remotion composition

- `Composition id="Reel"`, 720×1280, fps 30, `durationInFrames={840}`. Props = `ReelPlan` + asset manifest.
- `Reel.tsx`: 8 `<Sequence from={start*30} durationInFrames={(end-start)*30}>` blocks. Shot component chosen by `shot.type`.
- Audio inside Remotion (no separate ffmpeg pass): `<Audio src={voShotN.mp3}>` at each shot start; `music.mp3` full-length at volume 0.12 (interpolate down to 0.05 under VO); SFX stingers per `shot.sfx`; final shot mixes in faint modern ambience.
- Fonts via `@remotion/google-fonts`: Playfair Display (years/hook), Inter (captions/UI).
- Grades = CSS filter presets on a wrapper: `modern` none · `archival` sepia(.55) contrast(1.05) brightness(.96) · `parchment` sepia(.3) + paper bg · `reconstruction` saturate(.85) contrast(1.08) + vignette.
- GrainOverlay on EVERY shot. TimelineBar on EVERY shot except END_CARD (it completes there).
- Render: `scripts/render.ts` uses `@remotion/renderer` `renderMedia({ codec: "h264" })` → `/public/reels/{slug}-{lang}.mp4`. Called by orchestrator, and manually via `npm run render`.
- MatchCut (shot 7): old image scales/positions toward the user photo's composition, 12-frame cross-dissolve on a whoosh, timeline dot sweeps start→2026 over 20 frames.

## 10. Frontend (2 screens, mobile-first, dark)

**Home:** logo + tagline, `[📷 Take a photo]`, "or", name input + `Generate my time travel →`, small language selector (default English). Low-confidence identify → "Is this what you're looking at?" with 3 tappable options.
**Reel page:** while generating — monument name reveal + animated checklist from status JSON (the fun labels). Done — vertical video player (loop, unmuted-on-tap), buttons: `How do we know this? ▾` (sources + reconstruction time-ranges + Wikimedia attributions), language pills (tap = cached? play : regenerate narration+render only, plan/assets reused), `Share`.

## 11. Failure ladder (every step has a fallback — the reel ALWAYS completes)

1. Identify low confidence → 3 options → user picks.
2. Wikipedia thin → one web-search call → still thin → refuse gracefully ("We couldn't verify this site's history yet").
3. Wikimedia no result for a shot → generated still (style prefix).
4. Sora error/timeout/disallowed → Ken Burns the approved still + ReconstructionBadge (looks intentional).
5. TTS error → captions-only reel with music (still watchable).
6. Render error → log, keep assets, retry once.

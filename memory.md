# PastForward India — BUILD MEMORY

> **Protocol for Claude Code (read this first, every session):**
> 1. At session start: read this file top to bottom, then `skills.md`, `architecture.md`, `phases.md`. Resume from "Current status" — never redo completed work.
> 2. After completing EACH phase: update Current status, add a Phase Log row, record Decisions, update the Budget Ledger from `cache/budget.json`, list Known Issues. Keep entries short and factual.
> 3. If you change anything that contradicts `architecture.md` or `skills.md`, record it under Decisions with a one-line reason. This file is the truth about what EXISTS; those files are the truth about what SHOULD exist.
> 4. Never delete history here — append.

## REVISED TIMEBOXES (set 13:23, user has ~90 min → hard end ~14:53)
| Window | Work | Status |
|---|---|---|
| 13:23–13:43 | NEW: while-you-wait engagement (20 min HARD, $0) | ✅ shipped in box |
| 13:43–14:08 | Phase 5 — stills → Sora → TTS → flagship render | ✅ done |
| 14:08–14:25 | Phase 6 — photo-identify E2E, cache, hi | ✅ done (kn dropped per contingency) |
| 14:25–14:38 | Phase 7 GATE + audio-fix instruction | ✅ |
| 14:38–15:00 | Audio fixes + re-render en/hi. Phase 7 batch NOT run (ENOSPC + T−5) | ✅ fixes landed |
| 15:00–15:03 | Final verification + handoff cheat-sheet | ✅ |

**Contingency (user's rule):** if <30 min remain at Phase 7 → Taj Mahal + Bengaluru site in **English only**, **Hindi only** for Qutub, skip the third extra site. A finished demoable app beats coverage.
**Scope confirmed:** local-only, zero deployment work. Photo-upload → identify → generate is the PRIMARY demo input and must work E2E.

## Current status — SHIPPED (15:00)
- **Phases 0,1,2,3,4,5,6 complete. Phase 7 deliberately not run** (stopped at the user's T−5 line; see Handoff).
- Key present, all 4 models verified, all 4 CC0 audio beds real (−14 to −16.5 dB).
- **$2.013 spent. 3 reels cached and verified. Demo path is the cached photo→Qutub flow.**

## Phase Log
| Phase | Status | Actual time | Notes |
|---|---|---|---|
| 0 — Setup | 🟨 done except model verify | ~13 min (T+0:00→0:13) | Scaffold, budget ledger, mocks, render smoke test all green. Model IDs unverified — needs key. |
| 1 — UI shell | ✅ done | ~17 min (T+0:13→0:30) | Under the 30-min box. Full click-through verified in a real browser. |
| 2 — Intelligence | ✅ done | ~25 min | Real plan for Qutb Minar, all 16 validations pass, every year verified against the article. 4 regenerations for quality. |
| 3 — Remotion template | ✅ done (ran ahead of 2) | ~25 min (T+0:30→0:55) | 840 frames / 28.000000s verified. All 9 components built + 2 render/review passes. |
| 4 — Archival assets | ✅ done (ran ahead of 2) | ~20 min (T+0:28→0:48) | 3/3 archival shots got genuine pre-1900 material. Trust card live with real licences. |
| 5 — Real media (flagship) | ✅ done | ~35 min | 2 stills approved first try; both Sora clips generated after fixing the 720×1280 reference size. |
| 6 — Recognition/cache/langs | ✅ done | ~20 min | Photo→identify 0.96 confidence E2E; cache short-circuit verified; Hindi via translate (kn dropped per contingency). |
| 7 — Freeze + demo cache | ⛔ NOT RUN | — | Stopped at the user's T−5 rule. Disk hit ENOSPC at 94%; a new site needs ~5 min. Existing cache left intact and verified. |

## Verified model IDs (Phase 0 fills this)
| Role | Configured | Verified working? | Notes |
|---|---|---|---|
| vision/plan | gpt-5-mini | ✅ VERIFIED + used | **Rejects `temperature`** — `withParamRetry` strips it from the 400 automatically |
| image | gpt-image-2 | ✅ VERIFIED + used | 1024×1536, quality medium |
| video | sora-2 | ✅ VERIFIED + used | `input_reference` MUST be exactly 720×1280 or it 400s "Inpaint image must match…" |
| tts | gpt-4o-mini-tts | ✅ VERIFIED + used | voice `marin`; fallback never needed |

## Budget Ledger (mirror of cache/budget.json — update per phase)
| When | What | Est. cost | Running total |
|---|---|---|---|
| P0–P4 | Scaffold, UI, Remotion template, Wikimedia assets — zero API calls | $0.00 | $0.00 |
| P2 | 4 plan calls (1 + 3 quality regens) | $0.08 | $0.08 |
| P5 | 2 stills ($0.10) + 2 Sora ($0.80, paid twice → $1.60 before the reuse guard) + 8 TTS | ~$1.88 | $1.964 |
| P6 | Hindi translate + 8 TTS + identify | $0.049 | $2.013 |

**FINAL: $2.061.** Hard stop $25 · target $12 · **83% of budget unused**. ALLOW_MEDIA / ALLOW_SORA now: **true / true**.

## Decisions
- `2026-08-15 P0` — Next **14.2.35** + React 18.3 (not Next 15/React 19): battle-tested against Remotion 4.0.220, and 14.2.35 is the patched release for the Dec-2025 advisory.
- `2026-08-15 P0` — No Tailwind. Plain CSS variables in `app/globals.css` (dark palette + Playfair/Inter). One less config surface in a 4-hour build.
- `2026-08-15 P0` — `ReelProps` declared as a `type` not an `interface`, so it keeps an implicit index signature and satisfies Remotion's `Record<string, unknown>` props constraint. Schema content unchanged from architecture.md §5.
- `2026-08-15 P0` — `SHOT_TEMPLATE` (the locked 28.0s / 840-frame timings, grades, sfx and Ken Burns directions) lives in `lib/types.ts` as code, and `scripts/render.ts` throws if the composition is not 840 frames. Duration can no longer drift from script length.
- `2026-08-15 P0` — Ken Burns direction sequence fixed in the template as in→out→left→in→right→out→in so no two consecutive shots share a move (skills.md §14.4) without relying on the model to vary it.
- `2026-08-15 P0` — Mock VO clips are real silent **mp3** (ffmpeg `libmp3lame`, exact template durations), not wav — ffmpeg was already on the machine, so the mock path matches the real TTS path exactly.
- `2026-08-15 P0` — Silent placeholders written to `/public/audio/{music,whoosh,stone,ambience}.mp3` under the real filenames. `npm run mocks` skips any file >20 KB, so dropping the real CC0 files in just works and re-running mocks won't clobber them.
- `2026-08-15 P0` — Placeholder stills are gradient + vignette + tower silhouette rather than flat colour, so Phase 3 framing/Ken Burns/MatchCut decisions are made against something with real tonal range.
- `2026-08-15 P0` — `lib/prompts.ts` written in Phase 0 (not Phase 2) with PLAN_PROMPT, STYLE_PREFIX, MOTION_SUFFIX and TTS instructions copied **verbatim** from skills.md §5/§7/§11. Costs nothing and locks the bible in early.
- `2026-08-15 P1` — Orchestrator's step list, status-file contract and cache short-circuit are the REAL ones; only each step's body is a `setTimeout` mock. Phases 2/4/5 swap bodies without touching the UI or the polling contract.
- `2026-08-15 P1` — Seeded `cache/plans/qutub-minar-en.json` from the mock fixture so the trust card has real sources during Phases 1–3. Phase 2 overwrites it with the generated plan.
- `2026-08-15 P1` — Reel `<video>` width is derived from a height budget (`min(100%, calc(66dvh * 9/16))`) instead of capping height. Capping height on a 9:16 box pillarboxes the video; deriving width keeps the box exactly 9:16 and still fits the language pills + trust toggle on one screen.
- **`2026-08-15 P1` — PHASE ORDER CHANGED: running Phase 3 before Phase 2.** Reason: Phase 2 is hard-blocked on the missing `OPENAI_API_KEY`, and phases.md specifies Phase 3 is built entirely against the mock fixture + placeholder images ($0, no Phase 2 output needed). The fixture ReelPlan already has the exact schema the real plan will have, so nothing is rebuilt later. Phase 2 runs the moment the key arrives. This is the "if behind, cut scope rather than overrun" principle applied to a blocked dependency rather than to a slow one.

### Phase 3 decisions
- `2026-08-15 P3` — **Timeline dot position is derived from each shot's own `caption.year`**, not a hardcoded shot→event table. The first table was off by one (shot 4 "1220s" displayed "Firoz Shah Tughlaq rebuilds"). Now: parse the first 3–4 digit year from the caption, sit on the latest event at or before it. Works for any monument, and gives the shot-4 jump and shot-7 sweep for free.
- `2026-08-15 P3` — Timeline label uses a position-dependent anchor (left-aligned at the start, centred through the middle, right-aligned at the end) instead of a fixed `translateX(-50%)`, which clipped "AIBAK BEGINS THE MINAR" and "YOU ARE STANDING HERE" off both edges.
- `2026-08-15 P3` — **Grain is a 256px tileable PNG offset per frame, not per-frame `feTurbulence`.** Identical look, and full-reel render time dropped 112s → 68s (−39%). Matters because Phase 7 renders 8 reels. `grain.png` is produced by `npm run mocks`.
- `2026-08-15 P3` — End-card brand block moved to `bottom: 208` (was 118) and enlarged; it was colliding with the completed timeline bar. The bar's moving label is hidden on the end card — the completed bar reads better alone.
- `2026-08-15 P3` — TimelineBar draws a bottom scrim then the bar once on top. An earlier version drew the bar twice (under and over the scrim) for legibility; the scrim alone is sufficient.
- `2026-08-15 P3` — Grades did NOT get tuned against the placeholder art. Placeholder tonality is arbitrary, so tuning to it would be actively wrong once real Wikimedia plates land in Phase 4.

### Phase 4 decisions
- **`2026-08-15 P4` — Commons is spelling-sensitive, and this is the single most important asset-quality lever.** `"Qutub Minar old photograph"` returns only modern tourist snaps; `"Qutb Minar old photograph"` returns 1858 photographs. `fetch-assets` now resolves the canonical Wikipedia title (`resolveTitle`) and searches BOTH spellings, interleaved.
- `2026-08-15 P4` — The plan's `archivalQuery` alone is not enough — `"Qutub Minar engraving Delhi 1800s"` returns 0 results. Added `queryLadder()`: plan query first, then `{name} old photograph / Samuel Bourne / Beato / ruins 19th century / Getty Museum / British Library / 1860s`, then the bare name. Bourne, Beato, Daniell, KITLV, Getty and the British Library ARE the colonial-era India corpus on Commons; naming them directly is what surfaces the good plates.
- `2026-08-15 P4` — Ranking fix: medium bonuses (engraving/painting/photograph) are awarded ONLY to material without a modern date, and `"engravings/carvings ON x"` is penalised. Before this, a 2019 photo of carvings ("Engravings on Qutub Minar.jpg") outranked an 1858 Beato print, because both matched the word "engraving".
- `2026-08-15 P4` — `used` set is threaded through all shots so two shots never show the same plate.
- `2026-08-15 P4` — `.tif` originals are fine: Commons' `iiurlwidth` thumbnail is a JPEG, so the KITLV/Bourne TIFF scans are usable even though Chrome cannot decode TIFF.
- `2026-08-15 P4` — Credits are deduped by source file, not per shot (shots 1 and 7 share the "today" photo), so the card reads as a list of works.

### Blocked-time work (done while waiting for the key — all $0, all Phase 2/5/6 prerequisites)
- `lib/openai.ts` — complete. Every call does assertAffordable → call → record. Verified against the **installed SDK surface (openai 4.104.0)** rather than guessed: `responses.create` + `zodTextFormat` for structured outputs, `images.generate`/`images.edit`, `audio.speech.create`. **There is no `videos` resource in 4.104**, so Sora speaks REST (`POST /v1/videos` multipart → poll `GET /v1/videos/{id}` → `GET /{id}/content`), exactly as architecture.md §6 describes.
- `withParamRetry()` — if a call 400s with "Unsupported parameter: 'x'", it retries once without `x` and logs loudly. Reads the param name out of the error instead of guessing which family rejects `temperature`.
- `lib/assets.ts` — one shared implementation of "what image does each shot get", used by BOTH the orchestrator and `npm run assets`.
- `lib/orchestrator.ts` — now the REAL pipeline with the full failure ladder. Renders in a **child process** (`npx tsx scripts/render.ts`), keeping @remotion/bundler + headless Chrome out of the Next server bundle.
- **No-key fallback:** with no `OPENAI_API_KEY` the orchestrator uses the bundled fixture plan, still does real Wikimedia sourcing, and still renders. The app stays demoable at every moment.
- Verified end-to-end through the HTTP API (Hampi, uncached): identify → research → plan → assets → render → done, ~85s wall clock, $0.

### Phase 4b decisions (asset relevance — found by testing Hampi)
- **`2026-08-15` — The "today" shot needs the OPPOSITE date preference to the archival plates.** Hampi's shot 1 came back as an 1885 Henry Hardy Cole photograph because the scorer rewards age. Added `prefer: "archival" | "modern"`; the today shot uses `modern`.
- **`2026-08-15` — Added a relevance gate (`mustMatch` name tokens, −120).** A Hampi reel was served "Tomb of Iltutmish, Qutub Complex" — a Delhi plate — because the query was loose. `downloadBest` now returns null rather than a negative-scoring match: **an off-topic image is worse than a placeholder.**
- `2026-08-15` — If the plan's `archivalQuery` doesn't name the site, the monument name is prepended before searching.
- **`2026-08-15` — Use Wikipedia's `searchinfo.suggestion`, not just `search[0].title`.** For "Qutub Minar" Wikipedia literally hands back `suggestion: "qutb minar"` — the exact spelling that unlocks the 1858 plates. `resolveAliases()` returns both, with one retry + backoff.
- **`2026-08-15` — Suggestions widen the SEARCH but must never widen the RELEVANCE GATE.** Wikipedia suggests "that mahal" for Taj Mahal and "hami" for Hampi; letting `that` into the token gate would match almost any file title. Gate tokens come only from the user's name + the real article title. `nameTokens` also drops building-type words (fort/temple/palace/minar/mahal/tomb/…) that thousands of Indian monuments share.
- **`2026-08-15` — Colonial-era place names are the key to 19th-century plates**, so `ARCHIVAL_QUERY_GUIDANCE` was added to the plan's user message (PLAN_PROMPT itself stays verbatim per skills.md): search Seringapatam not Srirangapatna, Vijianuggur not Vijayanagara, Benares not Varanasi; and when a building was rarely photographed, name the fort/complex/city that WAS.

## Cached artifacts (what exists on disk)
- Plans: `public/mock/qutub-minar-en.json` — hand-written fixture ReelPlan, 8 shots, 69 narration words, real Qutub facts (Aibak 1199 → Iltutmish 1220s → lightning/Firoz Shah Tughlaq 1368 → 1803 quake → 2026).
- Assets: `public/mock/{userphoto,shot2,shot3,shot4,shot5,shot6}.jpg` (1024×1536) · `public/mock/vo-shot1..8.mp3` (silent, exact shot durations) · `public/audio/*.mp3` (silent placeholders).
- Reels: `public/reels/qutub-minar-en.mp4` — **the Phase 3 template reel**: 840 frames, 28.000000s, 720×1280 h264 + AAC, placeholder art, silent audio beds. This is what the app serves today.
- Remotion components (all built, Phase 3): `KenBurnsImage` `TimelineBar` `YearStamp` `CaptionBlock` `GrainOverlay`(+`Vignette`) `Grade` `ReconstructionBadge` `MatchCut` `EndCard`, assembled by `remotion/Reel.tsx` (picture + VO + ducked music bed + per-shot SFX).

## Qutub Minar archival material (Phase 4, all licence-clean)
| Shot | Work | Creator | Licence |
|---|---|---|---|
| 1, 7 | Qutub Minar 6 (today) | Danish971 | CC BY-SA 4.0 |
| 2 | Tomb of Iltutmish, Qutub Complex (1857) | Getty Museum Collection | CC0 |
| 4 | *Kuttull Minor, Delhi* — aquatint after Thomas Daniell (1805) | William Orme | Public domain |
| 6 | Iron pillar at the Qutb Minar complex (1858) | Dr. John Murray | Public domain |

## Known issues / TODO
- **Model IDs unverified.** `gpt-5-mini`, `gpt-image-2` and `sora-2` may not exist for this account; `verify:models` reports the real families and auto-picks the fallback. Must run before Phase 2.
- Shot 6's plate (Murray 1858, iron pillar + tree) is period-correct but doesn't literally illustrate "lightning strikes the top". Content matching is limited by what Commons actually holds. A better `archivalQuery` from the real Phase 2 plan may improve it; not worth hand-picking yet.
- **⚠️ PHASE 7 RISK — Tipu Sultan's Summer Palace has NO pre-1900 material on Commons under its own name.** Every hit is a 2017–2019 tourist photo. Probed archival availability for all four demo sites:
  | Site | pre-1900 plates ≥60 | Verdict |
  |---|---|---|
  | Taj Mahal | 11 (Bourne c.1860, Beato 1865, 1874) | excellent |
  | Hampi | 6 (Greenlaw 1856, Lyon 1868, Cole 1885) | good |
  | Qutub Minar | 3 in use (Daniell 1805, Getty 1857, Murray 1858) | good |
  | Tipu Sultan's Summer Palace | **0** | needs the workaround below |
  **Workaround (verified by probe):** the material exists under the colonial-era names — `"Seringapatam"` yields Tipu's throne (1799), the assault (1802), British Library plates (1804), sketches (1818); `"Bangalore Fort 19th century"` yields 11 pre-1900 including an 1804 plate captioned *"The North Entrance Into The Fort Of Bangalore — with Tipu's palace"*. `ARCHIVAL_QUERY_GUIDANCE` now instructs the planner to produce exactly these exonyms, and `queryLadder` also searches `{city} 19th century` / `{city} British Library`. **Verify this specific site first in Phase 7** — if the plan still produces 0 archival plates, hand-pick the 1804 Bangalore Fort plate rather than letting the reel go majority-generative (that would break the ~70/30 real-to-generative promise in skills.md §1).
- Remotion downloaded Chrome Headless Shell (81 MB) on first render — one-time, now cached; later renders won't pay it.
- `app/page.tsx` and `remotion/Reel.tsx` are deliberate stubs (Phase 1 / Phase 3 replace them).
- API routes and `remotion/components/*` not created yet — Phases 1–3 create them as they are wired.

## ⏱ FINAL CHANGE (15:20) — reel is now 56.0s / 1680 frames
The 28s template forced ~1.35x atempo on nearly every VO clip and it was audible.
Every template timing was doubled in `lib/types.ts` (0–5, 5–12, 12–20, 20–28, 28–36, 36–44, 44–52, 52–56);
`DURATION_FRAMES = 1680`; `scripts/render.ts` now asserts against `DURATION_FRAMES` rather than a literal.
- **English VO is now natural pace** (no atempo on shots 1–7). Hindi ≤1.01x. Only the 4s end card still compresses (1.35x).
- Sora clips are 4s in 8s windows → `playbackRate = 0.5` on `OffthreadVideo`: slow-motion reconstruction, intentional documentary style.
- **Reconstruction ranges are now `00:12–00:20, 00:28–00:36`** — the trust card derives them from `SHOT_TEMPLATE`, so it updated automatically.
- Music `loop` covers 56s; timeline/music-duck boundaries now derive from `SHOT_TEMPLATE[7].start`; MatchCut dissolves at 63% of its shot rather than a hardcoded frame.
- **Fit windows come from `SHOT_TEMPLATE`, never the cached plan** — a plan cached under the old template still carried 28s timings and produced wrong windows.

### ⚠️ STATE AT HANDOFF — READ THIS FIRST
| File | Duration | Status |
|---|---|---|
| `qutub-minar-en.mp4` | **56.0s / 1680f** | ✅ **NEW — demo this one.** Natural-pace VO, slow-mo Sora |
| `qutub-minar-hi.mp4` | 28.05s / 840f | ⚠️ **OLD 28s render** — its re-render hit ENOSPC. Still valid and playable (sped-up VO), preserved by the atomic temp+rename |
| `taj-mahal-en.mp4` | 28.05s / 840f | ⚠️ OLD 28s, partial assets |
**The two languages are now different lengths.** For the language-pill demo beat, either accept the mismatch or re-render Hindi first: `npm run render -- --props=cache/plans/qutub-minar-hi.render.json --out=public/reels/qutub-minar-hi.mp4` (~165s, needs ~1.5GB free — clear `/var/folders/**/T/react-motion-render*` first).

## ✅ HANDOFF / DEMO CHEAT-SHEET

### Total spend: **$2.061** of a $12 target / $25 hard stop. 83% of budget unused.
Ledger breakdown: 7 plan calls $0.14 · 4 stills $0.20 · 2 Sora clips $0.80 · 25 TTS $0.038 · rest translate/identify.
(4 of the 7 plan calls were deliberate quality regenerations — hook, chronology, end-card VO. 2 Sora clips were paid twice before the clip-reuse guard landed: **$0.40 of avoidable spend**, now impossible.)

### Verified model IDs (all four confirmed live in GET /v1/models)
| Role | ID | Note |
|---|---|---|
| vision/plan | `gpt-5-mini` | **rejects `temperature`** — `withParamRetry` strips it automatically |
| image | `gpt-image-2` | 1024×1536, quality medium |
| video | `sora-2` | works; `input_reference` MUST be exactly 720×1280 or it 400s |
| tts | `gpt-4o-mini-tts` | voice `marin`, no fallback needed |

### Cached reels (all verified: 840 frames · 720×1280 · 28.05s · aac audio)
| File | Quality |
|---|---|
| `qutub-minar-en.mp4` | **FLAGSHIP — demo this.** 3 real archival plates (Daniell aquatint 1805, Murray 1858, Bourne 1860) + 2 Sora reconstructions + full audio mix |
| `qutub-minar-hi.mp4` | Same visuals, Hindi VO. Plan translated, not re-planned |
| `taj-mahal-en.mp4` | **BONUS, partial.** Real plan (hook "The Taj began with one death.") + 2 archival + 2 stills, but shots 1/2/7 are placeholders and it predates the audio fixes. Use only if asked for a second site |

### THE DEMO PATH (skills.md §15)
1. Hold up a printed Qutub Minar photo: *"Imagine I'm visiting Delhi and I know nothing about this."*
2. Home → **Take a photo** → shoot the print. Vision identifies it (~0.96 confidence, ~3s).
3. It lands on the **cached** reel → plays instantly, $0. **Let all 28 seconds play without talking over it.**
4. *"Every fact came from historical sources. Real material stays real. What no camera could capture is clearly labelled reconstruction."*
5. Open **"How do we know this?"** → 3 sources, 4 Wikimedia credits with licences, `Reconstructed scenes: 00:12–00:20, 00:28–00:36`, AI-narration disclosure.
6. Tap **हिन्दी** → Hindi reel. *"First view costs about eighty rupees of compute. Every view after is free."*

### IF LIVE GENERATION STALLS — serve cache, never apologise
- Everything demoable is already cached. Typing "Qutub Minar" or photographing it **always** hits cache and is instant.
- **Do NOT type an uncached monument on stage.** A cold site takes ~5 min (2 Sora clips ≈ 85s each + ~95s render).
- If a generation is running and stalls, hit **← New place** and use a suggestion chip — the cache short-circuit fires before any spend.
- If the dev server dies: `npm run dev`, then open `http://localhost:3000`. Reels are static files under `/public/reels/`, so even a bare `open public/reels/qutub-minar-en.mp4` is a valid fallback.
- **⚠️ Disk is at 88% (~1.6 GB free).** Two concurrent renders exhausted it once (ENOSPC). Render one at a time. Reels survived only because `scripts/render.ts` writes to a temp file and renames on success.

---

# POST-HACKATHON FINAL BUILD (2026-08-15, 17:15 → 18:30)

Five changes shipped by a 4-agent team: LEAD (pipeline, AI questions, all paid calls),
AGENT-APP (Android/Capacitor), AGENT-UI (frontend), AGENT-QA (read-only, 19 numbered defects).

## What shipped
| Item | Status | Where |
|---|---|---|
| 1 — both inputs first-class | ✅ | `app/page.tsx` — "NAME IT" / "SHOW IT" blocks, one `identifyThenGo()` path |
| 2 — English + Hindi only | ✅ | `VISIBLE_LANGS` in `lib/types.ts`, filtered in both screens. `Lang` stays wide |
| 3 — real AI wait-questions | ✅ | `generateQuestions()` → `JobStatus.questions` → `Engagement.tsx` |
| 4 — generalize to ANY subject | ✅ | `SubjectCategory`, category-conditioned plan/art/query blocks |
| 5 — Android APK | ✅ built, ⚠️ not device-tested | `dist/pastforward-india-debug.apk` |

## Decisions
- `2026-08-15 F1` — **Reel is now 58.0s / 1740 frames** (end card 4.0s → 6.0s). With atempo disabled a natural-pace takeaway (~4.5s) overran the 4.0s end card and was cut at the composition boundary. Shots 1–7 are untouched, so the trust card's reconstruction ranges (00:12–00:20, 00:28–00:36) are unchanged.
- `2026-08-15 F2` — **`SHOT_TEMPLATE_BRIEF` → `shotTemplateBrief(category)`, timings derived from `SHOT_TEMPLATE`.** The brief still described a 28s reel with a 2.0s end card long after both had doubled, so the model was writing takeaways for a window that no longer existed. A prompt that hardcodes a duration will drift from the renderer; this one can't.
- `2026-08-15 F3` — **`ReelPlan.monument` keeps its name; `category` carries the real kind.** Renaming to `subject` would touch every Remotion component, the trust card and every cached plan for zero user-visible gain.
- `2026-08-15 F4` — **Animal reconstructions are natural-history plates, never photoreal.** `stylePrefix()` branches on category. A photoreal tiger that never existed is fabricated evidence; a lithograph is openly an illustration. The reference image is also withheld for animals — `images.edit` carries the source photo's photographic character into the result.
- `2026-08-15 F5` — **atempo re-enabled as a collision guard at 1.15x** (was 1.35x, then disabled entirely). A line that fits its window is untouched at natural pace; only a line that would talk over the NEXT line is nudged. Disabling it entirely left nothing bounding VO length — the first tiger reel shipped with 1.46s of two narrators at once.
- `2026-08-15 F6` — **Cache lookup resolves spelling variants** (`resolveCachedSlug`). The vision model returns "Qutb Minar" ~2 runs in 3, which slugified to a different cache key than the cached `qutub-minar` and started a 5-minute cold generation for a reel we already had. Consonant-skeleton match + a learned alias map.
- `2026-08-15 F7` — **Advisory cross-process job lock** (`cache/locks/`). The in-process `inFlight` map didn't stop a second browser tab or a CLI run from starting a duplicate billable pipeline; two concurrent renders then exhausted the disk.
- `2026-08-15 F8` — **Relevance gate matches file TITLE only, and short tokens are not evidence.** A creator's name says nothing about what a picture depicts. See the two blockers below.
- `2026-08-15 F9` — **`safetyPenalty()` in the Commons scorer.** Political allegory/satire, 1857-Rebellion and Partition terms, trophy/hunt imagery, human remains, nudity, religious-classical allegory: −120 to −200, i.e. below the "return nothing" threshold.
- `2026-08-15 F10` — **Archival failure falls back to the present-day photo, never `/mock/shotN.jpg`.** The mock carries burned-in text ("PLACEHOLDER · NOT FINAL ART") over a Qutub silhouette. Repeating a real photo is a compromise; a NOT-FINAL-ART card in a finished reel is a bug.
- `2026-08-15 F11` — **A shot's archival preference derives from its own caption year.** A shot dated 2022 is searched as modern. The turning point is 19th-century for a monument but a modern census for wildlife.

## ⚠️ The two blockers worth remembering (same root cause)
The relevance gate accepted a single short substring match anywhere in title **or artist**. Twice it admitted material that was on-topic by title and catastrophic by meaning:
1. **Bengal tiger shot 6** → Tenniel's *"The British lion's vengeance on the Bengal tiger"* (1870), his 1857-Rebellion cartoon: a tiger over a fallen British woman, 8 seconds, captioned "2022 / Poaching".
2. **Dal Lake shot 6** → *"Roman Charity (after Guido Reni) — isabella Maria dal Pozzo"*, a breastfeeding nude. `"dal"` matched the **artist's surname particle**.
Every heuristic rewarded them independently: title names the subject, genuinely 19th-century, genuinely a painting, huge scan. **A colonial allegory whose title names the subject is the highest-scoring wrong answer this scorer can produce.** Fixed at the root (F8 + F9), not hand-pinned.

## Budget
**$5.944** of $25 hard stop / $12 target. This session added ~$1.97 (2 subjects × 2 Sora + 2 stills + TTS + plans + questions). Sora is 81% of all spend ever.
Questions calls are $0.005/reel and ledgered as kind `questions`.

## Known issues (post-session)
- **Bengal tiger shot 4** is a modern CC BY-SA photo, not period material — the tightened gate rejects weakly-titled 19th-century plates ("Tigre du Bengale", "Felis tigris" don't contain "bengal"/"tiger"). Tiger reel is 2 archival / 2 generative.
- **Dal Lake shots 2 and 4 are near-duplicate KITLV plates** of the same Akbar Bridge view. The gate now requires "lake" in the title, which excludes the Shalimar Bagh material that would have differentiated shot 4.
- **Hindi:** `qutub-minar-hi.mp4` is still the pre-doubling 28s render. The language-pill beat shows a reel half the length of the English one.
- **Four older reels are 1680 frames** against a 1740-frame composition (harmless — static files — but the end-card fix is not in them).
- **Timeline label clips** at the right edge on long labels (dot index 3 of 4).
- `?qa=` harness removed from the reel page. `scripts/regen-vo.ts` (`npm run vo`) added to recover lost narration without re-fetching images.

## Late session — user feedback pass (18:15 → 18:35)
User typed "Narendra Modi" live and reported: questions after the first were not relevant,
questions ran out too soon, no music during the wait, and "50%" for minutes with no way to
tell whether it was working.

- `2026-08-15 F12` — **Wait questions ask about the VIEWER, not the subject's facts.** The generated set was subject-anchored but trivia-shaped ("Pick a place associated with him", "Which role feels most central?"), which asks the viewer to choose between facts they may not know. Every non-guess question must now be answerable by someone who knows nothing about the subject, from their own experience or taste. Plus a hard rule for people: never ask for approval, opinion, or anything readable as taking a political side.
- `2026-08-15 F13` — **`WAIT_QUESTION_COUNT` 4 → 8.** Four questions were spent in about a minute of a three-to-five-minute wait. **Watch the two-message trap:** the count is stated in BOTH `QUESTIONS_SYSTEM` and `questionsUserMessage()`. Raising it in the system prompt alone did nothing — the user message still said "Write the 4 questions", and the model followed the later, more specific message. Verified after the fix: 8 returned, all viewer-shaped ("Seen a tiger in the wild?", "Which habitat would you stand inside?"), guess revealing the real 3,167–3,682 figure.
- `2026-08-15 F14` — **The assets step reports granular progress (52 → 88).** It sat at a flat 50% for three or four minutes. A progress bar that does not move reads as a hung app, and the user's instinct is to reload — which (before the F7 lock) started a second billable job.
- **NOT DONE, deliberately: no "person" refusal.** It was drafted after the Modi run looked like unrequested spend, then dropped once the user confirmed they typed it. Blocking persons would break what they asked for. The real safeguard is already in place and holding: `fullStillPrompt()` renders SCENES, never faces ("people appear only as silhouettes, hands, crowds or distant figures"), so the Modi reconstruction came back as a 1960s Gujarat tea stall rather than a likeness. **If a generated still is ever a recognisable likeness of a real living person, that is a blocker.**

### ⚠️ Person subjects work but source badly — known limitation
`narendra-modi-en.mp4` renders correctly (58.0s / 1740 frames) but shots 1, 2, 4 and 7 are all
the SAME image, "Narendra Modi Stadium Ahmedabad.jpg" — a cricket stadium. Cause: Commons has
almost no material titled with a living person's name that passes the relevance gate, so the
archival lookups fail and F10's fallback (repeat the present-day photo) fires four times. F10 is
still right — repetition beats a "NOT FINAL ART" card — but a person needs its own archival
vocabulary (portraits, contemporary photographs, associated places) and its own category. The
category enum has no "person", so identify classified him as "other" and the monument beats ran.
**Do not demo a person subject.**

## 🏁 FINAL PRE-SUBMISSION PASS (19:05 → 19:30)

### Charminar — the live end-to-end proof, generated fresh through the UI pipeline
The stale `charminar-en.json` (a Phase-6 dedupe artifact) was moved to `.stale-bak` first, so this
exercised the FULL new pipeline — fresh identify, fresh category-conditioned plan, fresh questions,
fresh archival sourcing. **This is the run that proves the session's work, because everything else
was verified on reels built before the fixes landed.**

| Check | Result |
|---|---|
| Frames vs computed duration | **1740 frames / 58.048s** — matches the composition exactly |
| Audio | AAC; all 8 VO lines fit their windows at natural pace, **zero overlap** (no atempo fired) |
| Archival sourcing | 3 real plates: *Charminar in 1887* (PD), *Charminar and market around it in 1887* (PD), *Charminar @ Old city* (CC BY-SA 3.0) |
| `/mock/` assets | **zero** — the F10 fallback change holds |
| Wait questions | **8 delivered live**, all viewer-shaped, guess revealed a real fact ("a mosque for more than 434 years") |
| Progress | Climbed **50 → 65 → 73 → 93** with live shot labels. The F14 fix is confirmed in the real pipeline |

Sample of the generated questions, as the shape to preserve: *"Visited a monument surrounded by
markets?"* · *"Sunrise or sunset by a riverside monument?"* · *"On the top floor, what would you
notice first?"* — every one answerable with no prior knowledge of Charminar.

**Interruption note:** the first Charminar attempt died at `assets 65%` when the dev server was
stopped by a session restart. The orchestrator runs IN the Next process, so killing the server kills
any in-flight job. Resuming cost nothing beyond the ~$0.05 already spent — the plan, research and
questions were cached and the asset layer's idempotency guards reused everything on disk.

### Qutub flagship re-rendered to 58s ✅
`vo8-en.mp3` is 4.512s against a 5.8s usable end card, so the closing line
("One tower. Many builders. Many restorations.") now plays at **natural pace** rather than the
~1.35x compression baked into the 14:48 render. A safety copy was taken first; the atomic
temp+rename means a failure could not have damaged the shipped file either way.

**Result: 1740 frames / 58.048s, h264 + aac.** VO8 runs 52.20 → 56.71s against a 58.00s
composition — **1.29s of headroom**, so the line completes uncompressed. Two earlier attempts at
this same render died of ENOSPC; both times the cause was CONCURRENCY (a second render, or Gradle
downloading), never the render itself. Alone with 5+ GB free it finished in 198.8s and free space
never fell below 5.3 GB.

### Reel inventory at submission
| File | Frames | Duration | Note |
|---|---|---|---|
| `qutub-minar-en.mp4` | 1740 | 58.05s | **FLAGSHIP** — natural-pace closing line |
| `charminar-en.mp4` | 1740 | 58.05s | fresh end-to-end proof of the new pipeline |
| `bengal-tiger-en.mp4` | 1740 | 58.05s | animal category · Curzon 1903 on the decline beat |
| `dal-lake-en.mp4` | 1740 | 58.05s | natural_place category |
| `narendra-modi-en.mp4` | 1740 | 58.05s | ⚠️ renders, but 4 shots repeat one photo — **do not demo** |
| `humayuns-tomb-en/hi`, `taj-mahal-en` | 1680 | 56.04s | pre-fix bonus reels, still playable |
| `qutub-minar-hi.mp4` | 840 | 28.05s | ⚠️ pre-doubling; half the English length |

**`SUBMISSION.md` written at the repo root** — what the app is, a text architecture diagram, run
instructions (server + APK + the same-Wi-Fi/LAN-IP requirement stated plainly), the demo path, the
cost story, and known limitations.

## 🎬 DEMO PACING MODE (added 20:30, for recording the launch video)

**Problem it solves:** the cache short-circuit is the product's best trick — a photographed
monument returns instantly for $0 — but it also skips the entire wait screen, so a recording of
the cached path never shows the questions that are half the experience.

**Toggle — read from disk per request, so no dev-server restart is needed:**
```
cache/demo.json   →  { "waitMs": 60000 }     # on, paced over 60s
cache/demo.json   →  { "waitMs": 0 }         # off, instant cache hit (normal)
```
With it on, a cached subject walks the real step sequence over `waitMs`, then reveals the cached
reel. Nothing is re-rendered, no media is bought. `startJob` reports `cached: false` so the client
polls instead of jumping straight to the video.

- `2026-08-15 F15` — **The schedule is ABSOLUTE, not per-phase sleeps.** Each phase has a deadline
  measured from t0, so a phase that runs long (the questions call) compresses the phases after it
  instead of pushing the reveal past `waitMs`.
- `2026-08-15 F16` — **Questions are now CACHED** (`cache/plans/{slug}-{lang}.questions.json`), by
  both the demo path and the normal pipeline. This is what makes them usable at all on a replay:
  generating takes ~35s, which is longer than the entire reveal, so on the first attempt the
  questions arrived at t+41s — after most of the wait was over. Off disk they appear at ~t+4s.
- `2026-08-15 F17` — **Dropped `temperature` from the questions call.** The vision-tier model
  rejects it, so `withParamRetry` stripped it and re-sent — every questions call was two round
  trips. Removing it halves the latency of the one call a viewer actually waits on.
- **Fire-and-forget was wrong here and cost a debugging cycle:** the promise resolved *after* the
  final `emit`, so the questions were bought ($0.005, confirmed in the ledger) and then thrown
  away. In the paced path they are awaited, with a 40s race that falls back to the UI's own deck.

**Verified end-to-end:** questions on screen at t+4s ("Seen a tall brick tower before?"), progress
climbing 21 → 36 → 62 → 80 → 93, elapsed clock ticking, reel revealed at ~t+60s. **$0 per run.**

⚠️ The wait-screen copy reads *"Nothing about this is pre-made"* — true of a real generation, but
it is on screen while a **cached** reel is being paced. Fine for a launch video; do not say it
aloud as a claim about that specific run.

## ✅ Verified at close (18:45, in a real mobile browser at 375×812)
- Home: "NAME IT" and "SHOW IT" as equal blocks, placeholder "Bengal tiger, Dal Lake, Qutub Minar…", chips Qutub Minar / Taj Mahal / Bengal Tiger / Dal Lake, languages English + हिन्दी ONLY.
- Bengal Tiger chip → cached reel plays instantly, 0:58, timeline dot correctly at "c. 16,500 BP · ARRIVAL IN THE SUBCONTINENT" on shot 1.
- Trust card: 1 source, 4 archival credits with licences (all four ON SCREEN — no credit for anything unshown, nothing shown uncredited), ranges 00:12–00:20 / 00:28–00:36, "58-second introduction" derived from `DURATION_SECONDS`.
- `npx tsc --noEmit` exits 0. Wait-screen music, elapsed clock and the "3–5 minutes" expectation copy are all in `app/reel/[slug]/page.tsx`.
- **Wait screen itself was NOT observed live** — that needs an uncached generation (~$0.95 and 4 minutes), which was not spent. Music/questions/progress are verified by code + a direct `generateQuestions()` call, not by watching a real wait.

⚠️ **Never run `next build` while `next dev` is running** — they share `.next` and it corrupts the running server (every route 500s). Recovery: stop dev, `rm -rf .next`, restart dev.

## 🚀 SUBMISSION CHEAT-SHEET

### Start the backend (laptop)
```
cd ~/Desktop/PastForwardIndia
npm run dev          # already binds 0.0.0.0; npm run dev:lan is belt-and-braces
```
Open http://localhost:3000

### Connect the phone
1. **Check the IP still matches** — this is a DHCP lease and the APK has it baked in:
   `ipconfig getifaddr en0` must return **10.24.164.170**
   If it changed: edit `LAN_URL` in `capacitor.config.ts`, then `npm run android:sync && npm run android:apk`
2. Phone on the **same Wi-Fi** as the laptop
3. Install: `npm run android:install` (or `adb install -r dist/pastforward-india-debug.apk`)
   adb lives at `~/Library/Android/sdk/platform-tools/adb`
4. No cable? AirDrop/Drive the APK and tap it (needs "Install unknown apps")

### The demo path
1. **"Qutub Minar"** typed, or photograph a printed Qutub photo → **instant, cached, $0**. Spelling variants all resolve now.
2. Let the 58 seconds play. Narration is continuous and natural-paced.
3. **"How do we know this?"** → sources, Wikimedia credits with licences, reconstruction ranges 00:12–00:20 / 00:28–00:36.
4. **हिन्दी** pill → Hindi reel (⚠️ still the 28s render — mention it or skip).
5. **Range proof:** tap **Bengal Tiger** or **Dal Lake** — both cached and instant. Tiger shows lithograph reconstructions and a real population collapse (100,000 → 3,167–3,682); Dal Lake shows formation → Mughal gardens → houseboats → eutrophication.

### On stage, do NOT
- Type an **uncached** subject — that is a ~5 minute cold generation (2 Sora clips + render).
- Run two generations at once — disk is at ~2 GB free and two concurrent renders have hit ENOSPC twice.

---

## Known issues / TODO (post-demo)
- **Hindi VO overruns its windows.** Hindi TTS is ~2x longer than the shot windows; even at the 1.35x `atempo` cap, clips still exceed (e.g. shot 1: 3.52s into a 2.20s window). Reads as heavy J-cutting. Real fix: ask the translator for ~55 words rather than matching English length.
- Phase 7 batch (Hampi / Tipu / extra languages) **not run** — stopped at the T−5 line by the user's own rule. Tipu's exonym ladder (Seringapatam / Bangalore Fort 1804) is implemented and probe-verified but never executed end-to-end.
- `taj-mahal-en.mp4` predates the audio fixes and has 3 placeholder shots. Re-run `npm run assets -- --slug=taj-mahal --lang=en --media` then re-render to bring it up to flagship standard (~$0.80 for its 2 Sora clips).
- `charminar-en.json` plan exists with no assets/reel (dedupe test artifact) — harmless.
- Engagement wait-screen ships all 4 questions; only visible on uncached generations, so it will NOT appear in the cached demo path.

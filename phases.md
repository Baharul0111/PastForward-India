# PastForward India — PHASES (4-hour build, 240 min)

> Rules: Work phases IN ORDER. Do not start a phase until the previous phase's **Done means** list is fully true. After EVERY phase: update `memory.md` (status, decisions, spend, issues) — this is mandatory, not optional. If a phase overruns its box by >50%, cut scope per its "If behind" line and move on. `ALLOW_MEDIA=false` and `ALLOW_SORA=false` until Phase 5 — no exceptions.

Timeboxes assume start at T+0:00.

---

## Phase 0 — Setup & config (T+0:00 → 0:15) · $0.00

- Scaffold Next.js (TS, App Router) + install: `remotion @remotion/cli @remotion/renderer @remotion/google-fonts openai zod`.
- Create full directory tree from `architecture.md` §3 with stub files. Create `.env.local` (read OPENAI_API_KEY from user), `config/models.ts`, `lib/budget.ts` with flags + ledger.
- **Verify model IDs**: one `GET /v1/models` call; confirm/adjust the four IDs in `config/models.ts`. Record verified IDs in `memory.md`.
- Create `/public/mock/`: fixture `qutub-minar-en.json` ReelPlan (write it by hand now — 8 shots per skills.md §3, real Qutub facts), 6 placeholder images (solid-color 1024×1536 PNGs with era labels, generate via canvas/sharp script), one 3s silent mp3 ×8 as mock VO.
- **USER TASK (tell the user now, takes them 2 min):** download 1 documentary music bed + whoosh + stone-taps + street ambience (CC0, pixabay.com) into `/public/audio/`. Until then use silence — never block on this.

**Done means:** app boots, `npm run render` runs against a trivial test comp, model IDs verified, mock fixtures exist, memory.md updated.

---

## Phase 1 — UI shell + fake flow (T+0:15 → 0:45) · $0.00

- Home screen + reel page exactly per `architecture.md` §10 (dark, mobile-first, big type).
- Orchestrator skeleton: `POST /api/generate` runs mock pipeline (setTimeout steps), writes `cache/status/{job}.json`; UI polls and animates the checklist with the fun labels; ends by playing a placeholder mp4.
- Language pills present (en/hi/kn/ta) — wired later.

**Done means:** full click-through — type "Qutub Minar" → progress theater → placeholder video plays. Feels like the real product.
**If behind:** skip photo-upload UI polish; name input only, camera in Phase 6.

---

## Phase 2 — Intelligence: identify → research → plan (T+0:45 → 1:20) · ≤ $0.10 (text/vision only)

- `lib/wikipedia.ts` (free extract, 6k-word truncate).
- `POST /api/identify`: name passthrough + photo→vision structured output `{name, city, confidence, alternatives[3]}`; <0.85 → alternatives UI.
- Plan call in `lib/openai.ts`: ONE structured-output request → `ReelPlan` (schema via zod → JSON schema). Prompt from `skills.md` §5 + §4 verbatim, includes the Wikipedia text with the "use ONLY this text" rule.
- Server-side validation + repair pass per `architecture.md` §5. Cache plan to `cache/plans/`.
- Test on **Qutub Minar only**. Print the plan; check: hook is a hook, 65–75 words, years correct vs article, shots 3&5 reconstructions.

**Done means:** real ReelPlan JSON for Qutub Minar cached, validated, looks like skills.md demands. memory.md updated with any prompt tweaks that worked.
**If behind:** drop photo-identify (name only), keep alternatives UI stubbed.

---

## Phase 3 — Remotion template until it's GORGEOUS (T+1:20 → 2:05) · $0.00  ← biggest quality lever

Build `Reel.tsx` + all components against the MOCK fixture + placeholder images. Judges see this frame quality, so iterate here, free, in Remotion Studio (`npx remotion studio`):
- KenBurnsImage (varied directions per shot — never two identical moves in a row), TimelineBar with animated dot + year ticks, YearStamp (huge Playfair serif, quick scale-in), CaptionBlock (Inter, 3–7 words, timed to shot), Grade wrapper, GrainOverlay, ReconstructionBadge, MatchCut (dissolve + timeline sweep), EndCard (takeaway + PASTFORWARD INDIA · "You are standing inside history.").
- Audio scaffolding: per-shot `<Audio>` slots, music bed at ducked volume, SFX per `shot.sfx`.
- Beat feel: cuts land ON shot boundaries; captions enter 4 frames after cut; nothing static >2s.
- Render the mock reel to mp4. Watch it on a phone. Fix what feels "AI" using skills.md §14 checklist.

**Done means:** 28.0s mock reel that already looks like a human-made history reel — with placeholder art. memory.md updated.
**If behind:** cut MatchCut to a simple cross-dissolve; keep TimelineBar (it's the identity).

---

## Phase 4 — Real archival assets (T+2:05 → 2:30) · $0.00

- `lib/wikimedia.ts` per `architecture.md` §7: search per shot's `archivalQuery`, rank, download to `/public/assets/{slug}/`, save attribution manifest.
- Wire orchestrator: plan → assets → render (reconstruction shots still use placeholder stills).
- Sources card UI reads manifest + plan.sources + reconstruction time-ranges.
- Run for Qutub Minar: real 19th-century photos/engravings now inside the template.

**Done means:** Qutub reel rendered with real archival imagery + working "How do we know this?" card.
**If behind:** manual fallback — hand-pick 4 Commons images for Qutub, hardcode the manifest, keep the API code for later.

---

## Phase 5 — Real media: stills → Sora → TTS → flagship reel (T+2:30 → 3:00) · ≤ $4.00  ← first real credits

Flip `ALLOW_MEDIA=true`. Then, in order:
1. **Stills for shots 3&5** (Images API, style prefix from skills.md §7; use edits+reference when the monument itself is in frame). Eyeball each still BEFORE any video spend — regenerate at $0.05 until right (max 3 tries/shot).
2. Flip `ALLOW_SORA=true`. **Sora i2v** from approved stills, motionPrompt, 4s, 720×1280. Max 1 retry each. Timeout → Ken Burns fallback and MOVE ON.
3. **TTS**: 8 per-shot clips, voice `marin`, instructions from skills.md §11. Mute any Sora audio.
4. Full render → `/public/reels/qutub-minar-en.mp4`. Watch full-screen on a phone with sound.

**Done means:** flagship Qutub Minar reel, fully real, ≤ $2 actual spend (ledger check), cached. memory.md updated with actual costs.
**If behind:** ship ONE Sora reconstruction + one Ken Burns still — nobody will know.

---

## Phase 6 — Recognition, cache, languages (T+3:00 → 3:20) · ≤ $0.50

- Camera/photo upload polish end-to-end (photo of a printed Qutub photo must identify).
- Cache short-circuit everywhere: reel exists → play instantly; plan/assets exist → only narrate+render for a new language.
- Language toggle live: regenerate narration in `hi` + one southern language (`kn` since Bengaluru) for Qutub. Narration text: one cheap translation call reusing the plan (do NOT re-plan). Verify TTS pronunciation is acceptable.

**Done means:** photo→reel works; instant replay from cache; Qutub plays in en/hi/kn.
**If behind:** ship en+hi only.

---

## Phase 7 — FREEZE, test, pre-generate demo cache (T+3:20 → 3:40) · ≤ $5.00

**No new features past this line. Seriously.**
- Full pipeline on 3 more visually different sites: Taj Mahal, Hampi (Virupaksha), Tipu Sultan's Summer Palace (Bengaluru local point). Fix only breakages.
- Pre-generate + cache all demo reels (en + hi). Verify budget ledger total ≤ $12.
- Rehearse the demo path per skills.md §15; confirm the printed-photo → live-generate path AND the cached fallback both work.

**Done means:** 4 monuments cached in 2 languages, demo rehearsed, memory.md final entry with total spend + known issues.

## Buffer (T+3:40 → 4:00)
Bug fixes only. If everything works: one extra Bengaluru monument, or record a screen capture of the flagship reel as ultimate demo insurance.

---

## Budget summary (target ≤ $12 of $35; hard stop $25)
Phases 0–4: $0.10 · Phase 5: ≤$4 · Phase 6: ≤$0.50 · Phase 7: ≤$5 · Retries/buffer: ~$2.

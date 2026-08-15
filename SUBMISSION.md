# PastForward India

**Point at history. Watch time move.**

PastForward India is a **location-based history storyteller**. A visitor standing in front of an Indian monument, fort, temple, palace or heritage site either types its name or photographs what is in front of them. The app identifies the site, researches it against trustworthy sources, finds the few events that actually explain why the place exists and how it changed, and produces a 58-second vertical documentary: what stood there before, why it was built, who built it, what the earliest version looked like, how later rulers and events modified it, and how it became what the visitor sees today.

The crucial difference is that it does **not** generate 58 seconds of obviously synthetic video. It behaves like a human history editor: real photographs and archival material wherever it exists (19th-century plates sourced live from Wikimedia Commons, each credited with its licence), maps and typography drawn programmatically, and selective AI reconstruction **only** for moments that could never have been photographed — two windows, about eight of the fifty-eight seconds, each labelled **HISTORICAL RECONSTRUCTION** on screen and listed by timecode in a "How do we know this?" card. That restraint is the point: the app makes a claim about the past, so it shows its working. Every fact comes from the article it cites; nothing is invented to fill a gap.

The result is not "AI imagining history" — it is a mini historical documentary generated for the exact place you are standing in. The domain was later broadened from monuments to any Indian subject, including natural places and wildlife, and the reel grew from 25–30s to 58s so the narration could run at natural pace. A first-time subject costs about ninety cents of compute and takes four minutes. Every replay after that is free and instant.

---

## Architecture

```
                    ┌─────────────────────────┐
   TEXT ──────────► │   Next.js 14 App Router │ ◄────── ANDROID (Capacitor)
   PHOTO ─────────► │   app/page.tsx          │         WebView → LAN → laptop
                    └───────────┬─────────────┘
                                │ POST /api/generate
                                ▼
                    ┌─────────────────────────┐
                    │   lib/orchestrator.ts   │  the pipeline state machine
                    │   • advisory job lock   │  (cache/locks/ — no duplicate
                    │   • cache short-circuit │   billable runs)
                    └───────────┬─────────────┘
                                │
    ┌───────────────────────────┼────────────────────────────┐
    ▼                           ▼                            ▼
┌─────────┐            ┌────────────────┐          ┌──────────────────┐
│IDENTIFY │            │   RESEARCH     │          │  WAIT QUESTIONS  │
│gpt-5-mini│──────────►│  Wikipedia     │─────────►│  8 tap-only Qs   │
│+ category│  $0.005   │  FREE          │  $0.005  │  fire-and-forget │
└─────────┘            └───────┬────────┘          └──────────────────┘
                               │                    (never blocks the reel)
                               ▼
                    ┌─────────────────────────┐
                    │  PLAN — gpt-5-mini      │  $0.02
                    │  8 shots, category-     │  ReelPlan JSON, 65–75
                    │  conditioned beats      │  narration words
                    └───────────┬─────────────┘
                                ▼
    ┌───────────────────────────┼────────────────────────────┐
    ▼                           ▼                            ▼
┌──────────────┐      ┌──────────────────┐        ┌────────────────────┐
│  ARCHIVAL    │      │  RECONSTRUCTION  │        │    NARRATION       │
│  Wikimedia   │      │  gpt-image-2     │        │  gpt-4o-mini-tts   │
│  Commons     │      │  → sora-2        │        │  8 clips, natural  │
│  relevance   │      │  2 clips × $0.40 │        │  pace  $0.0015 ea  │
│  gate +      │      │  = the cost      │        └────────────────────┘
│  safety      │      └──────────────────┘
│  scorer      │       ALL IDEMPOTENT — re-running never re-buys
└──────────────┘
                                ▼
                    ┌─────────────────────────┐
                    │  RENDER (child process) │
                    │  Remotion → 1740 frames │  FREE
                    │  720×1280 h264 + AAC    │  ~3 min
                    └───────────┬─────────────┘
                                ▼
                  public/reels/{slug}-{lang}.mp4
                  ← THE CACHE. Its existence means $0 replay.
```

**Storage is the filesystem, not a database.** `cache/plans/` holds ReelPlans, `public/assets/{slug}/` holds sourced and generated media, `public/reels/` holds the finished MP4s. A reel's existence on disk *is* the cache entry.

**The 58-second template is locked in code** (`lib/types.ts` → `SHOT_TEMPLATE`), never taken from the model. The renderer throws if the composition is not 1740 frames, so duration can never drift from script length.

---

## Running it

### 1. Backend (this laptop)

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Next binds all interfaces by default, so the phone can already reach it; `npm run dev:lan` is belt-and-braces.

Requires `.env.local`:

```
OPENAI_API_KEY=sk-...
ALLOW_MEDIA=true
ALLOW_SORA=true
BUDGET_HARD_STOP=25
BUDGET_TARGET=12
```

`ALLOW_MEDIA=false` runs the whole pipeline against bundled fixtures for $0.

> ⚠️ **Never run `next build` while `next dev` is running.** They share `.next` and it corrupts the running server (every route 500s). Recovery: stop dev, `rm -rf .next`, restart.

### 2. Android app

The APK is a thin Capacitor shell around the same frontend. **The backend keeps running on the laptop; the phone talks to it over Wi-Fi.**

```bash
npm run android:install
```

or install the prebuilt APK directly:

```bash
adb install -r dist/pastforward-india-debug.apk
```

`adb` lives at `~/Library/Android/sdk/platform-tools/adb`. With no cable, AirDrop or Drive the APK to the phone and tap it (needs "Install unknown apps" allowed).

**Two hard requirements, and the demo fails without them:**

1. **The phone and the laptop must be on the same Wi-Fi network.** The app is a WebView pointed at the laptop; there is no cloud backend.
2. **The laptop's LAN IP must match the one baked into the APK** — currently `http://10.24.164.170:3000`. This is a DHCP lease, so confirm it before demoing:

```bash
ipconfig getifaddr en0
```

If it has changed, edit `LAN_URL` in `capacitor.config.ts` and rebuild:

```bash
npm run android:sync && npm run android:apk
```

On unfamiliar venue Wi-Fi, a laptop hotspot keeps the address under your control.

---

## Demo path

1. **Type "Qutub Minar"**, or photograph a printed picture of it. Lands on the cached reel **instantly, $0**. Spelling variants ("Qutb", "Qutab") all resolve to the same cache entry.
2. **Let all 58 seconds play.** Narration is continuous and at natural pace — speech is never time-compressed to fit a window.
3. **Open "How do we know this?"** — sources, every Wikimedia work credited with its licence, and the reconstruction windows given as timecodes (`00:12–00:20, 00:28–00:36`).
4. **Tap हिन्दी** for the Hindi narration.
5. **Prove the range:** tap **Bengal Tiger** or **Dal Lake**, both cached and instant. The tiger reel reconstructs its evolutionary past as a 19th-century natural-history plate — never photorealistic fake wildlife — and its turning point carries the real population collapse (~100,000 → 3,167–3,682). The lake reel runs formation → Mughal gardens → houseboats → eutrophication.

**Do not type an uncached subject on stage.** A cold generation is ~4 minutes and about $0.95.

---

## Cost

**Total OpenAI spend across the entire build: $6.87** — eight reels in two languages, plus every experiment, regeneration and failed attempt along the way.

| | |
|---|---|
| Marginal cost of a new reel | **~$0.95** (2 Sora clips = $0.80 of it) |
| Marginal cost of a replay | **$0.00** |
| Marginal cost of a new language | ~$0.02 (translate the plan, re-narrate — never re-plan, never re-buy video) |

Every call goes through one file (`lib/openai.ts`) which asserts affordability against a hard stop before spending and appends to a ledger after. Nothing can be bought twice: stills, Sora clips and narration are all keyed to disk, so re-running the asset step to fix an archival lookup costs nothing. Two paid clips were bought twice early in the build, before that guard existed — it has been impossible since.

---

## Known limitations

**Person subjects source poorly.** The pipeline generalizes to monuments, buildings, natural places and animals. People technically work, but Wikimedia Commons holds almost nothing titled with a living person's name that passes the relevance gate, so archival lookups fail and shots fall back to repeating the present-day photo. A person needs its own archival vocabulary (portraits, contemporary photography, associated places) and its own category. Not demoed.

**The backend runs on this laptop.** There is no deployment in this build. The Android app is a WebView over the LAN, which is why the same-Wi-Fi and IP requirements above are load-bearing. Rendering is CPU-bound and takes ~3 minutes per reel, so a hosted version would need a render queue rather than the in-process child process used here.

**Sora 2 sunsets on 24 September 2026.** The reconstruction provider is deliberately isolated behind `generateReconstruction()` in `lib/openai.ts`, which speaks the REST endpoint directly rather than through the SDK. Swapping to another image-to-video model means reimplementing that one function; nothing else in the pipeline knows what produced the clip, and the failure path already exists — when a clip cannot be produced, the shot Ken Burns the approved still under the same reconstruction badge, which is a fully acceptable output.

**Archival sourcing is non-deterministic and its failure mode is quiet.** Two runs of the same plan can return different plates, and a transient Commons failure degrades a shot to a fallback image without any visible error. The relevance gate matches file titles only and penalises political allegory, violence and nudity below the "return nothing" threshold — a deliberate choice that a missing image beats a wrong one, after two separate runs surfaced material that was on-topic by title and unusable in fact.

**Hindi narration runs long.** Hindi TTS is roughly twice the length of English for the same content; the translator should be asked for ~55 words rather than to match English length. `qutub-minar-hi.mp4` is still a pre-doubling 28-second render.

---

## Stack

Next.js 14 (App Router, TypeScript) · Remotion 4 for composition · OpenAI `gpt-5-mini` (vision, plan, translate, questions), `gpt-image-2` (stills), `sora-2` (reconstructions), `gpt-4o-mini-tts` (narration) · Wikimedia Commons + Wikipedia for source material · Capacitor 6 for Android · no database, no Tailwind, no UI library.

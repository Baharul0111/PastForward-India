# PastForward India

**Point at history. Watch time move.**

Turn any Indian subject — a monument, a lake, a tiger — into a 58-second vertical documentary reel, narrated and scored, built mostly from real archival material.

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://react.dev/)
[![Remotion](https://img.shields.io/badge/Remotion-4.0-orange)](https://remotion.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Android](https://img.shields.io/badge/Android-Capacitor%206-green)](https://capacitorjs.com/)

**Version:** `0.1.0` · **Android:** `1.0` (versionCode 1) · app id `in.pastforward.app`

---

## What it does

Type the name of an Indian subject, or upload a photo of one, and the app produces a 58-second vertical video about it.

The reel is assembled from **real historical material** — 19th-century photographs, lithographs, aquatints and survey plates pulled live from Wikimedia Commons, each credited with its licence. Only about **8 of the 58 seconds** are AI-generated video, and those two windows are labelled `HISTORICAL RECONSTRUCTION` on screen and listed by timecode in a "How do we know this?" card. Every fact comes from the Wikipedia article the reel cites.

While it builds, the wait screen asks you eight short, tap-only questions written for that specific subject — a tiger reel asks whether you've seen one in the wild; a fort asks if you've climbed one before.

**It works for more than monuments.** The pipeline classifies the subject and changes the story beats to match:

| Category | Story spine |
|---|---|
| `monument` / `building` | built → changed → damaged → restored → today |
| `natural_place` | formed → found → used → changed → today |
| `animal` | evolved → ranged → hunted/lost → protected → today |

Animal reconstructions are rendered as **19th-century natural-history plates, never photorealistic wildlife** — a photoreal animal that never existed would be fabricated evidence; a lithograph is openly an illustration.

---

## How it works

```
   TEXT ──┐
          ├──►  IDENTIFY  ──►  RESEARCH  ──►  PLAN  ──►  ASSETS  ──►  RENDER  ──►  MP4
  PHOTO ──┘     gpt-5-mini    Wikipedia     gpt-5-mini    │          Remotion      cached
                + category      FREE        8 shots       │          FREE          forever
                  $0.005                     $0.02        │
                                                          ├── Wikimedia Commons  FREE
                                                          ├── gpt-image-2        $0.05 ×2
                                                          ├── sora-2             $0.40 ×2
                                                          └── gpt-4o-mini-tts    $0.0015 ×8
```

- **No database.** The filesystem is the cache: `cache/plans/` holds the plans, `public/assets/{slug}/` the media, `public/reels/{slug}-{lang}.mp4` the finished video. A reel existing on disk *is* the cache entry.
- **The 58-second template is locked in code** (`lib/types.ts` → `SHOT_TEMPLATE`), never decided by the model. The renderer throws if the composition isn't 1740 frames, so duration can't drift.
- **Nothing is ever bought twice.** Stills, video clips, narration and questions are all keyed to disk and reused.

---

## Getting started

### Prerequisites

- **Node.js 18+**
- **ffmpeg** — `brew install ffmpeg` (macOS) or `apt install ffmpeg` (Linux)
- An **OpenAI API key** with access to the models in `config/models.ts`

### 1. Install

```bash
git clone <your-repo-url>
cd PastForwardIndia
npm install
```

### 2. Add your API key

Copy the example env file and put your own key in it:

```bash
cp .env.example .env.local
```

Then open `.env.local` and replace the placeholder:

```
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

> `.env.local` is gitignored. **Never commit your key.**

**Start with `ALLOW_MEDIA=false` and `ALLOW_SORA=false`** (the defaults). The full pipeline runs against bundled fixtures and spends **$0**, which is the right way to check everything works. Flip both to `true` when you want real media.

### 3. Run

```bash
npm run dev
```

Open **http://localhost:3000**.

Type a subject — `Qutub Minar`, `Bengal tiger`, `Dal Lake` — or upload a photo. The first reel for any subject takes about 4 minutes and costs roughly $0.95 with media enabled. Every replay after that is instant and free.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app on port 3000 |
| `npm run dev:lan` | Same, bound to `0.0.0.0` so phones on your Wi-Fi can reach it |
| `npm run build` | Production build (stop `dev` first — they share `.next`) |
| `npm start` | Serve the production build |
| `npm run verify:models` | Check your key can reach every model the app needs |
| `npm run plan -- --name="Hampi"` | Generate a plan only |
| `npm run assets -- --slug=hampi --lang=en --media` | Fetch/generate media for a cached plan |
| `npm run assets -- --probe="Hampi Greenlaw 1856"` | Inspect how Commons ranks a search — free, no writes |
| `npm run vo -- --slug=hampi --lang=en` | Re-record narration only |
| `npm run render -- --props=cache/plans/hampi-en.render.json --out=public/reels/hampi-en.mp4` | Render a reel |
| `npm run studio` | Open Remotion Studio to inspect the composition |
| `npm run mocks` | Regenerate the $0 fixture assets |

---

## Running on Android

The Android app is a thin [Capacitor](https://capacitorjs.com/) shell around the same frontend. **The backend keeps running on your computer** — the phone talks to it over Wi-Fi. There is no cloud backend in this build.

**Both of these must be true or the app shows a blank error page:**

1. The phone and the computer are on the **same Wi-Fi network**
2. The computer's **LAN IP** matches the one compiled into the APK

### Build and install

```bash
# 1. Find your machine's LAN IP
ipconfig getifaddr en0            # macOS
hostname -I | awk '{print $1}'    # Linux

# 2. Put that IP in capacitor.config.ts  →  LAN_URL = "http://<your-ip>:3000"

# 3. Sync, build, install
npm run android:sync
npm run android:apk
npm run android:install           # needs USB debugging enabled on the phone
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

Then start the server (`npm run dev`) and open the app. The native camera sheet gives you both "Take Photo" and "Choose from Gallery"; the web build keeps a normal file input.

> **The IP is a DHCP lease.** If you change networks, re-run steps 1–3 or the app will point at nothing.

### No cable?

You don't need the APK at all — just open `http://<your-ip>:3000` in the phone's browser. It's the same app.

---

## Cost

Every OpenAI call goes through one file (`lib/openai.ts`) that checks affordability against `BUDGET_HARD_STOP` **before** spending and appends to a ledger at `cache/budget.json` after.

| | |
|---|---|
| First reel for a new subject | **~$0.95** (two Sora clips are $0.80 of it) |
| Every replay | **$0.00** |
| Adding a language to an existing reel | **~$0.02** |
| Running with `ALLOW_MEDIA=false` | **$0.00** |

---

## Project structure

```
app/                    Next.js App Router — UI + API routes
  api/generate          starts a job
  api/status/[job]      progress the UI polls
  reel/[slug]           the reel page + wait screen
lib/
  orchestrator.ts       the pipeline state machine
  openai.ts             EVERY paid call lives here
  prompts.ts            all model instructions
  wikimedia.ts          Commons search, ranking + content-safety scorer
  assets.ts             what image each shot gets
  types.ts              SHOT_TEMPLATE — the locked 58s timeline
remotion/               the video composition
scripts/                CLI entry points
config/models.ts        model IDs, in one place
```

---

## Known limitations

- **People source poorly.** The pipeline handles monuments, buildings, natural places and animals. A person renders, but Commons has little material titled with a living person's name that passes the relevance gate, so shots fall back to repeating one photograph.
- **The backend runs locally.** No deployment in this build; rendering is CPU-bound (~3 minutes per reel) and would need a queue to host.
- **Sora 2 sunsets on 24 September 2026.** The video provider is isolated behind `generateReconstruction()` in `lib/openai.ts` — swapping it means reimplementing one function. If a clip can't be produced, the shot Ken Burns the approved still under the same reconstruction badge.
- **Archival sourcing is non-deterministic.** Two runs of one plan can return different plates. The relevance gate matches file titles only and heavily penalises political allegory, violence and nudity — a deliberate choice that **no image is better than a wrong one**.
- **Hindi narration runs long.** Hindi TTS is roughly twice the length of English for the same content.

---

## Credits

Archival material comes from [Wikimedia Commons](https://commons.wikimedia.org) and text from [Wikipedia](https://wikipedia.org), each work credited with its licence inside the app's "How do we know this?" card. Audio beds are CC0.

Built with [Next.js](https://nextjs.org), [Remotion](https://remotion.dev), [Capacitor](https://capacitorjs.com) and the [OpenAI API](https://platform.openai.com).

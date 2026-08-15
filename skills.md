# PastForward India — SKILLS (the product bible)

> Everything the app produces must obey this file. When code and this file disagree, this file wins. Copy prompt blocks into `lib/prompts.ts` verbatim.

## §1. The product promise

PastForward India is a location-based history storyteller that turns any Indian monument, heritage site, fort, temple, palace, or historically significant place into a 25–30 second vertical documentary reel. A visitor types the place name or photographs what's in front of them. PastForward identifies the site, researches trustworthy historical sources, finds the few events that actually explain why the place exists and how it changed, and automatically produces a fast, cinematic timeline. The crucial difference: PastForward does NOT generate 30 seconds of obviously synthetic video. It behaves like a human history editor — real photographs and archival material where available, maps and typography created programmatically, selective AI reconstruction ONLY for moments that cannot be photographed, narration, sound design, citations, and one consistent visual language. The result is not "AI imagining history"; it is a mini historical documentary for the exact place you're standing in.

Tagline: **Point at history. Watch time move.** · Ratio: **~70% real/editorial, ~30% generative.** · Promise: *Understand the story of what you're seeing in 30 seconds* — never claim it's the complete history.

## §2. The five questions every reel answers (and nothing more)

1. Why is this here? 2. Who created it? 3. What did it originally look like? 4. What happened to it afterward? 5. Why does what I'm seeing today look this way?

Never: 15 facts, dimensions, every ruler, all inscriptions, every restoration, UNESCO trivia. Those live behind "Explore the full history" in the app, not in the reel.

## §3. The locked 28.0-second template (every monument plugs into this)

| # | Time | Type | Content | Visual | SFX |
|---|---|---|---|---|---|
| 1 | 0.0–2.5 | USER_PHOTO | HOOK line | User's photo, slow push-in; big title `NAME / CITY`; timeline bar appears | ambient |
| 2 | 2.5–6.0 | ARCHIVAL | WHY IT BEGAN — one human motivation, one founder, one year | Real portrait / old map / manuscript (Wikimedia), Ken Burns | market/none |
| 3 | 6.0–10.0 | RECONSTRUCTION | Earliest form — "show what I can no longer see" | 4s AI clip from approved still + badge `HISTORICAL RECONSTRUCTION · c. {year}` | stone |
| 4 | 10.0–14.0 | ARCHIVAL / MOTION_GRAPHIC | SOMETHING CHANGES — successor/expansion | Archival art or detail photo; timeline dot JUMPS to new year with label | whoosh |
| 5 | 14.0–18.0 | RECONSTRUCTION | The BIGGEST visual transformation (early→later, city→ruin, original→colonial) | 4s AI clip + badge | stone/none |
| 6 | 18.0–22.0 | ARCHIVAL / MOTION_GRAPHIC | THE TURNING POINT — lightning, siege, earthquake, restoration, rediscovery. CAUSAL, not a list | Archival + kinetic caption | whoosh |
| 7 | 22.0–26.0 | MATCH_CUT | TO TODAY — old view dissolves into the user's own photo; timeline sweeps to 2026 | Signature moment | whoosh→ambient |
| 8 | 26.0–28.0 | END_CARD | One line to remember + branding | Takeaway (Playfair) → `PASTFORWARD INDIA · You are standing inside history.` | none |

Story spine: BUILT → CHANGED → DAMAGED/CHALLENGED → RESTORED → TODAY. Duration is enforced by the composition (840 frames), never by script length.

## §4. Hook-writing skill

Never open with "X is located in Y and was built in Z" — dead. The hook creates a question in ≤10 words. Calibration examples:
- Qutub Minar: "This tower took several rulers to finish."
- Taj Mahal: "The Taj didn't begin with architecture. It began with a death."
- Hampi: "These ruins were once one of the world's great cities."
- Red Fort: "The fort you see isn't the fort its builders saw."
- Gateway of India: "Built to welcome an empire. Its last soldiers left through it."
Takeaway line = same skill, closing form: "One tower. Several rulers. Eight centuries."

## §5. Narration skill + the plan prompt

65–75 words TOTAL (validated server-side; ~2.5 words/sec keeps VO ≥25s of the 28s edit). Per-shot budget ≈ hook 6–8 w · shots 2–6 ≈ 10–12 w each · shot 7 ≈ 10 w · shot 8 ≈ 6–8 w. Tone: someone interesting standing beside you, not an encyclopedia. Reference density (Qutub, 68 words):

> "That tower behind you wasn't built by one ruler. Qutb-ud-din Aibak began it around 1199, but only its first storey was finished under him. Iltutmish added three more. After lightning damaged the tower, Firoz Shah Tughlaq rebuilt its upper section. Centuries of construction, damage and restoration created what stands here today. One monument. Several rulers. More than eight centuries."

**PLAN_PROMPT (system):**
```
You are PastForward's history editor. Using ONLY the source text provided (never outside knowledge — if a fact is not in the text, omit it), produce a ReelPlan JSON for a 28-second vertical documentary reel about {monument}.
Rules: answer only the five questions (why here / who created / original form / what changed it / why it looks this way today). Exactly 8 shots matching the fixed template types and order. Hook ≤10 words that creates a question; never start with location+date. Total narration 65–75 words; report narrationWordCount. Captions 3–7 words. Shots 3 and 5 are RECONSTRUCTION: stillPrompt describes a scene no camera could capture (construction, original form, transformation) with era, region, materials, activity — no text in scene, no famous faces, place over people; motionPrompt = ONE slow camera move. Shot 5 must show the largest visual transformation in the site's history. Shot 6 must be causal (what EVENT changed it). archivalQuery per ARCHIVAL shot = a Wikimedia Commons search string favoring 19th-century photographs, paintings, engravings, portraits, old maps. timeline: 3–5 dated events ending at 2026. sources: the source URLs provided. Language of narration/captions/hook/takeaway: {language}.
```

## §6. Visual language system (identical across every reel)

- Typography: years/hook/takeaway = Playfair Display (large serif); captions/UI = Inter (clean sans). AI never renders text — ALL text is code overlay (pixel-perfect every time).
- Grades: real modern footage = natural · historical photos = slightly muted sepia · documents/maps = parchment paper background · reconstructions = filmic, slightly desaturated + vignette + tiny badge.
- 35mm grain overlay on every frame (~8% opacity). Nothing on screen static >2s.
- **Timeline bar = the identity.** Bottom 10–15%, always visible (completes on end card): `1199 ●━━━━━━━━━━━○ 2026`, dot animates through event years, jumps with a whoosh on shot 4, sweeps to 2026 on shot 7.
- Ken Burns: vary direction every shot (in/out/left/right — never repeat consecutively); zoom toward meaningful details (faces, hands, carvings) that match the narration line.

## §7. Reconstruction skill (the 2 AI moments)

Workflow (cheap-first): still image (~$0.05) → human/visual check → approved still → Sora image-to-video 4s (~$0.40). Iterate at 5 cents, never at 40. When the monument itself is in frame, generate via image EDITS with the user's photo or best Wikimedia photo as reference so the architecture stays geometrically correct. Max 3 still tries, 1 Sora retry per shot; Sora failure → Ken Burns the approved still under the badge (fully acceptable output).

**STYLE_PREFIX (prepend to every still + Sora prompt):**
```
Historical documentary reconstruction. Naturalistic, hand-crafted historical documentary look. Subtle 35mm film texture. Muted sandstone, earth and parchment palette. Historically grounded clothing and architecture for {era}, {region}. No fantasy elements. No modern objects. No text, titles, lettering or watermarks anywhere in frame. No exaggerated cinematic action. Natural human-scale perspective.
```
**MOTION_SUFFIX (Sora):** `One slow controlled camera movement only: {move}. Four seconds. Mute ambient realism; audio will be replaced.`

Bans: no talking rulers or close-up historical faces (paintings, silhouettes, hands, crowds, distant figures only — the subject is the PLACE); no "anime"/stylized-cartoon looks; never ask AI to render dates or names.

## §8. Archival sourcing skill

Wikimedia Commons first — 19th-century photographs, colonial engravings, miniature paintings are the authenticity money can't buy. Capture `{artist, license, sourcePage}` per asset and surface it in the credits. License allowlist: Public domain, CC0, CC BY, CC BY-SA. Never scrape random Google Images. Facts hierarchy: ASI → UNESCO → established museum/government → Wikipedia/Wikidata for discovery and cross-check; the model writes ONLY from retrieved text.

## §9. Sound design skill (disproportionately important)

Mute all Sora audio. The soundtrack is built: per-shot VO clips (auto-synced by placement) + one low music bed (vol ~0.12, ducked to 0.05 under VO) + SFX: stone tapping (construction), distant market ambience (old-city shots), soft whoosh (timeline jumps + match cut), present-day ambience (final shots). A mediocre visual with intentional sound feels human; great visuals with chaotic audio feel AI.

## §10. Caption skill

3–7 words, kinetic, entering ~4 frames after each cut: `1199 / Construction begins` → `1220s / The tower grows` → `Lightning strikes` → `Centuries later…`. Captions complement narration, never transcribe it.

## §11. Narration voice + languages

TTS instructions: `Warm Indian documentary narrator. Curious rather than dramatic. Moderately fast. Brief pauses around dates and before the final line. Never sound like an advertisement, never theatrical.` Voice `marin` (fallback `cedar`), one clip per shot. Languages: en, hi, kn, ta, te, bn — new language reuses the cached plan+assets: translate narration/captions/hook/takeaway in one cheap call, regenerate TTS, re-render. The language toggle is the flagship "Build for India" demo beat. Disclose in the UI footer that narration is AI-generated.

## §12. Trust skill

Every reel ends with tap-to-open **"How do we know this?"**: ✓ sources (ASI/UNESCO/Wikipedia links) ✓ Wikimedia attributions ✓ `Reconstructed scenes: 00:06–00:10, 00:14–00:18`. Reconstructions are always labeled in-frame — admitting reconstruction makes the product MORE trustworthy. Contested sites (disputed religious/political history): stick strictly to ASI-neutral, court-neutral facts; if the retrieved text is substantially contested, present only undisputed facts or decline gracefully. Never claim completeness.

## §13. Budget skill

Mock tiers: text/vision live from Phase 2; images/TTS behind `ALLOW_MEDIA`; Sora behind `ALLOW_SORA` (both false until Phase 5). Every OpenAI wrapper: assertAffordable → call → append ledger. Costs: still ~$0.05 · Sora 4s ~$0.40 · TTS reel ~$0.01 · plan ~$0.02 · full new monument ~**$1** · cached replay **$0**. Hard stop $25; target ≤$12 of the $35. Develop the edit on placeholders — never burn a credit changing CSS.

## §14. Anti-AI-look checklist (run before shipping any reel)

1. ≤8s generated footage, both clips badged. 2. Real archival assets in shots 2/4/6. 3. All text is code-rendered. 4. Ken Burns directions varied. 5. Grain everywhere, grades consistent. 6. Cuts on beats, captions 3–7 words. 7. Sora audio muted; VO+music+SFX mixed. 8. No talking/close-up historical faces. 9. Timeline bar present and animating. 10. Ends on user's own photo → takeaway. If ≥2 fail, fix before demo.

## §15. Demo skill (judge script)

Hold up a printed monument photo: "Imagine I'm visiting Delhi and I know nothing about this." Upload → identification → "PastForward asks one question: what do I need to understand to appreciate what I'm standing in front of?" → let all 28 seconds play WITHOUT talking over it → "Every fact came from historical sources. Real material stays real. What no camera could capture is clearly labeled reconstruction." → open "How do we know this?" → tap language pill, replay in Hindi/Kannada instantly (cache) → close: "First view costs about eighty rupees of compute. Every view after is free. India has thousands of places we walk past without knowing what happened there. PastForward turns the place you're standing into its own 30-second time machine." Fallback: cached reels for everything; if live generation stalls, switch to cache without apologizing.

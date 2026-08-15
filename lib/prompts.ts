/**
 * All prompt templates. The blocks marked VERBATIM are copied character-for-character
 * from skills.md (the product bible) — if they disagree, skills.md wins. Only the
 * {placeholders} are interpolated.
 */

import { DURATION_SECONDS, SHOT_TEMPLATE, type Lang, type SubjectCategory } from "./types";

export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
};

/* ------------------------------------------------------------------ */
/* skills.md §5 — PLAN_PROMPT (system) · VERBATIM                      */
/* ------------------------------------------------------------------ */

export function planPrompt(monument: string, language: Lang): string {
  return `You are PastForward's history editor. Using ONLY the source text provided (never outside knowledge — if a fact is not in the text, omit it), produce a ReelPlan JSON for a ${DURATION_SECONDS}-second vertical documentary reel about ${monument}.
Rules: answer only the five questions (why here / who created / original form / what changed it / why it looks this way today). Exactly 8 shots matching the fixed template types and order. Hook ≤10 words that creates a question; never start with location+date. Total narration 65–75 words; report narrationWordCount. Captions 3–7 words. Shots 3 and 5 are RECONSTRUCTION: stillPrompt describes a scene no camera could capture (construction, original form, transformation) with era, region, materials, activity — no text in scene, no famous faces, place over people; motionPrompt = ONE slow camera move. Shot 5 must show the largest visual transformation in the site's history. Shot 6 must be causal (what EVENT changed it). archivalQuery per ARCHIVAL shot = a Wikimedia Commons search string favoring 19th-century photographs, paintings, engravings, portraits, old maps. timeline: 3–5 dated events ending at 2026. sources: the source URLs provided. Language of narration/captions/hook/takeaway: ${LANGUAGE_NAMES[language]}.`;
}

/**
 * skills.md §3 — the fixed template, restated for the model so shot types and
 * intent line up with what the server will enforce anyway.
 */
/** "0.0–5.0s", straight from the locked template. */
function windowOf(id: number): string {
  const t = SHOT_TEMPLATE.find((s) => s.id === id)!;
  return `${t.start.toFixed(1)}–${t.end.toFixed(1)}s`;
}

/**
 * The 8 beats. The SKELETON is identical for every category — only what each
 * beat is ABOUT changes, because a lake has no founder and a tiger has no
 * architect.
 *
 * Timings are derived from SHOT_TEMPLATE rather than written out, so this brief
 * can never drift from what the renderer enforces. It drifted once: the brief
 * still described a 28s reel with a 2.0s end card long after both had doubled,
 * and the model duly wrote a takeaway too long for the window it was actually
 * given — the closing words were cut off at the end of every reel.
 */
export function shotTemplateBrief(category: SubjectCategory = "monument"): string {
  const w = windowOf;

  const beats: Record<SubjectCategory, string[]> = {
    monument: [
      `2. ARCHIVAL (${w(2)}) — WHY IT BEGAN: one human motivation, one founder, one year.`,
      `3. RECONSTRUCTION (${w(3)}) — the earliest form; show what can no longer be seen.`,
      `4. ARCHIVAL (${w(4)}) — SOMETHING CHANGES: a successor or an expansion.`,
      `5. RECONSTRUCTION (${w(5)}) — the BIGGEST visual transformation in the site's history.`,
      `6. ARCHIVAL (${w(6)}) — THE TURNING POINT: a causal event (lightning, siege, earthquake, restoration, rediscovery). Not a list.`,
    ],
    building: [
      `2. ARCHIVAL (${w(2)}) — WHY IT BEGAN: one human motivation, one founder, one year.`,
      `3. RECONSTRUCTION (${w(3)}) — the earliest form; show what can no longer be seen.`,
      `4. ARCHIVAL (${w(4)}) — SOMETHING CHANGES: a successor or an expansion.`,
      `5. RECONSTRUCTION (${w(5)}) — the BIGGEST visual transformation in the building's history.`,
      `6. ARCHIVAL (${w(6)}) — THE TURNING POINT: a causal event that changed the building. Not a list.`,
    ],
    natural_place: [
      `2. ARCHIVAL (${w(2)}) — ORIGIN: how this place FORMED. Geology, glaciers, a river, a tectonic event. There is no founder and no architect — never invent one.`,
      `3. RECONSTRUCTION (${w(3)}) — the place BEFORE people: the landscape as it stood when nobody lived beside it.`,
      `4. ARCHIVAL (${w(4)}) — HOW PEOPLE FOUND AND USED IT: settlement, pilgrimage, trade, boats, agriculture, a ruler who prized it.`,
      `5. RECONSTRUCTION (${w(5)}) — the BIGGEST visual change humans made to it, or that it made to itself.`,
      `6. ARCHIVAL (${w(6)}) — WHAT CHANGED IT: a causal pressure — shrinkage, silting, pollution, tourism, a dam, an earthquake, a conservation effort. Use real figures from the source text if it gives them.`,
    ],
    animal: [
      `2. ARCHIVAL (${w(2)}) — RANGE & HABITAT: where this animal lives and lived. Prefer an old natural-history illustration, a distribution map, or a 19th-century plate.`,
      `3. RECONSTRUCTION (${w(3)}) — its EVOLUTIONARY PAST: an ancestor or an earlier form, drawn as a natural-history plate. Never a photograph.`,
      `4. ARCHIVAL (${w(4)}) — LIFE & BEHAVIOUR: how it hunts, raises young, moves, or survives. One concrete behaviour, not a list of traits.`,
      `5. RECONSTRUCTION (${w(5)}) — the BIGGEST change in its story: the historical landscape it once ranged across, or the pressure that shrank it.`,
      `6. ARCHIVAL (${w(6)}) — THE TURNING POINT: population decline, with the REAL NUMBERS from the source text (e.g. "about 100,000 to about 3,000"). Hunting, habitat loss, a ban, a protection law. If the text gives no figures, name the cause precisely instead — never invent a number.`,
    ],
    other: [
      `2. ARCHIVAL (${w(2)}) — WHY IT BEGAN or how it came to be. One motivation, one year.`,
      `3. RECONSTRUCTION (${w(3)}) — its earliest form; show what can no longer be seen.`,
      `4. ARCHIVAL (${w(4)}) — SOMETHING CHANGES.`,
      `5. RECONSTRUCTION (${w(5)}) — the BIGGEST transformation in its story.`,
      `6. ARCHIVAL (${w(6)}) — THE TURNING POINT: a causal event. Not a list.`,
    ],
  };

  const spine: Record<SubjectCategory, string> = {
    monument: "BUILT → CHANGED → DAMAGED/CHALLENGED → RESTORED → TODAY.",
    building: "BUILT → CHANGED → DAMAGED/CHALLENGED → RESTORED → TODAY.",
    natural_place: "FORMED → FOUND → USED → CHANGED/THREATENED → TODAY.",
    animal: "EVOLVED → RANGED → HUNTED/LOST → PROTECTED → TODAY.",
    other: "BEGAN → CHANGED → CHALLENGED → TODAY.",
  };

  const subject = category === "animal" ? "animal" : category === "natural_place" ? "place" : "site";

  return `The 8 shots, in this exact order:
1. USER_PHOTO (${w(1)}) — the HOOK line. The viewer's own photo.
${beats[category].join("\n")}
7. MATCH_CUT (${w(7)}) — TO TODAY: the old view dissolves into the viewer's own photo.
8. END_CARD (${w(8)}) — the takeaway line. Shot 8's narration must BE the takeaway, word for word. Keep the takeaway to 5–8 words: it is the last thing the viewer hears and it must land as a complete sentence.
Story spine: ${spine[category]}

CHRONOLOGY IS ABSOLUTE. The years on shots 2,3,4,5,6 must never go backwards — each shot is at or after the one before it. The reel is a timeline moving forward; an on-screen timeline bar animates through these years, so an out-of-order year visibly jumps backwards and breaks the film. If a cause and its consequence both belong in the reel, the CAUSE goes in the earlier shot (an earthquake in shot 6 cannot precede its repair in shot 5 — put the earthquake earlier, or make shot 6 a later event).

Timeline years may be era labels where exact years do not apply to this ${subject} — "10,000 BCE", "c. 1600", "1970s" are all valid. The final timeline event is always 2026.`;
}

/** skills.md §4 — hook calibration, given to the model as few-shot guidance. */
export const HOOK_GUIDANCE = `The hook must create a question in ≤10 words. Never open with "X is located in Y and was built in Z" — that is dead on arrival. Calibration:
- Qutub Minar: "This tower took several rulers to finish."
- Taj Mahal: "The Taj didn't begin with architecture. It began with a death."
- Hampi: "These ruins were once one of the world's great cities."
- Red Fort: "The fort you see isn't the fort its builders saw."
- Gateway of India: "Built to welcome an empire. Its last soldiers left through it."
- Bengal tiger: "A hundred thousand once. Then almost none."
- Dal Lake: "This lake is smaller than it was a lifetime ago."
The takeaway is the same skill in closing form: "One tower. Several rulers. Eight centuries."

Critical: the hook is a STATEMENT that makes the viewer ask the question themselves — every calibration line above is declarative. Never write the question out literally ("Why did…?", "Did you know…?", "Ever wondered…?"); that hands over the answer's shape and kills the pull. Name something concrete and slightly surprising instead.

Captions never break the fourth wall. Never write "your photo", "this reel", "watch as", or any reference to the app or the viewer's device — the caption describes the HISTORY on screen.`;

/**
 * Supplementary archival-query guidance. skills.md §5 asks for "a Wikimedia
 * Commons search string favoring 19th-century photographs, paintings,
 * engravings, portraits, old maps" — this tells the model HOW to hit them.
 * Discovered empirically in Phase 4: Commons titles 19th-century plates under
 * colonial-era spellings and place names, so the exonym is often the only way in.
 */
export function archivalQueryGuidance(category: SubjectCategory = "monument"): string {
  const common = `Writing archivalQuery — these are searched against Wikimedia Commons file titles, so use the words a 19th-century plate would actually be catalogued under. Avoid modern touristic phrasing and avoid years alone.`;

  if (category === "animal") {
    return `${common}
- Always include the animal's name. The material you want is ILLUSTRATION, not photography: 19th-century natural-history plates, lithographs, engravings, hunting records and distribution maps.
- Good shapes: "{animal} lithograph", "{animal} Daniel Giraud Elliot", "{animal} natural history illustration", "{animal} Sterndale mammals India", "{animal} distribution map", "{animal} engraving plate", "Fauna of British India {animal}".
- Sterndale's "Natural History of the Mammalia of India", Jerdon, Elliot's monographs and the Fauna of British India series ARE the colonial-era Indian wildlife corpus on Commons — naming them directly is what surfaces the good plates.
- NEVER write a query for hunting, shikar, trophies or killed animals, and never for political cartoons or allegories. Those queries return colonial propaganda — a Bengal tiger hunting query returns Tenniel's 1857-Rebellion cartoon of a tiger over a dead woman, which is contested political history (see NEUTRALITY) and cannot appear under a line about wildlife.
- For the turning-point shot, ask for the CONSERVATION record instead, which is where the real numbers live: "{animal} conservation", "{animal} reserve", "{animal} census", "Project Tiger", "{animal} habitat", "{animal} national park". The decline is carried by the narration's figures, not by an image of a dead animal.`;
  }

  if (category === "natural_place") {
    return `${common}
- Always include the place's name, and prefer the spelling used in colonial-era records where it differs (Cashmere not Kashmir, Ootacamund not Udhagamandalam, Benares not Varanasi).
- Good shapes: "{place} old painting", "{place} 19th century", "{place} Samuel Bourne", "{place} British Library", "{place} lithograph", "{place} old map", "{region} survey map", "{place} houseboat 1880s".
- Landscapes were painted and surveyed far more than they were photographed — watercolours, aquatints, lithographs and survey maps are the richest seam, and the surrounding valley, river or district is often catalogued where the specific place is not.`;
  }

  return `${common}
- Always include the site's name. Prefer the spelling used in colonial-era records where it differs from the modern one (Seringapatam not Srirangapatna, Kootub/Qutb not Qutub, Vijianuggur not Vijayanagara, Benares not Varanasi, Calcutta not Kolkata).
- If the building itself was rarely photographed, name the larger complex, fort or city that WAS — a plate titled "The North Entrance Into The Fort Of Bangalore, with Tipu's palace" is found under "Bangalore Fort", never under the palace's modern name.
- Good shapes: "{historical name} 1860s", "{site} Samuel Bourne", "{site} Felice Beato", "{site} British Library", "{siege or event} {year}", "{ruler} portrait", "{historical city name} old map".`;
}

/** skills.md §12 — contested sites. */
export const NEUTRALITY_RULE = `If the source text shows the site's history is substantially contested (disputed religious or political claims), present only the undisputed, ASI-neutral and court-neutral facts. Never claim completeness. Never editorialise about a dispute.`;

export function planUserMessage(args: {
  monument: string;
  city: string;
  sourceText: string;
  sourceUrls: { title: string; url: string }[];
  category?: SubjectCategory;
}): string {
  const category = args.category ?? "monument";
  const label =
    category === "animal" ? "ANIMAL" : category === "natural_place" ? "PLACE" : "SUBJECT";

  return `${label}: ${args.monument}${args.city ? ` (${args.city})` : ""}
CATEGORY: ${category}

${shotTemplateBrief(category)}

${HOOK_GUIDANCE}

${archivalQueryGuidance(category)}

${NEUTRALITY_RULE}

SOURCE URLS to put in plan.sources:
${args.sourceUrls.map((s) => `- ${s.title} — ${s.url}`).join("\n")}

SOURCE TEXT (use ONLY this text; if a fact is not in it, leave it out):
"""
${args.sourceText}
"""`;
}

/** architecture.md §5 — the single repair pass when word count is out of range. */
export function repairPrompt(actual: number): string {
  return `The narration totals ${actual} words. Rewrite the eight narration lines so the TOTAL is 70 words (hard range 65–75). Keep every year, name and fact exactly as written — only compress phrasing. Keep the same 8 shots, captions, prompts and queries. Return the full ReelPlan JSON again with an updated narrationWordCount.`;
}

/* ------------------------------------------------------------------ */
/* skills.md §7 — STYLE_PREFIX · VERBATIM                              */
/* ------------------------------------------------------------------ */

export function stylePrefix(era: string, region: string, category: SubjectCategory = "monument"): string {
  // An animal reconstruction must never read as wildlife footage. A photoreal
  // tiger that never existed is a fabricated observation; a lithograph is openly
  // an illustration, which is what an honest reconstruction of a living creature
  // looks like. This is the same promise the reel makes about buildings —
  // labelled reconstruction, never counterfeit evidence.
  if (category === "animal") {
    return `Nineteenth-century natural-history plate. Hand-drawn scientific illustration in the style of a colonial-era Indian mammal monograph — lithograph or hand-coloured engraving on aged paper, visible plate texture and fine ink linework. Muted earth, ochre and parchment palette. Anatomically accurate for the species, in its natural habitat of ${region}, ${era}. NEVER photographic and never photorealistic. No fantasy elements. No modern objects. No text, titles, lettering, captions or watermarks anywhere in frame. No exaggerated action — the animal is observed, not staged.`;
  }

  if (category === "natural_place") {
    return `Historical documentary reconstruction of a landscape. Naturalistic, hand-crafted look recalling a 19th-century topographical watercolour or aquatint. Subtle 35mm film texture. Muted earth, water and parchment palette. Historically grounded vegetation, boats, dwellings and dress for ${era}, ${region}. No fantasy elements. No modern objects. No text, titles, lettering or watermarks anywhere in frame. No exaggerated cinematic action. Natural human-scale perspective.`;
  }

  return `Historical documentary reconstruction. Naturalistic, hand-crafted historical documentary look. Subtle 35mm film texture. Muted sandstone, earth and parchment palette. Historically grounded clothing and architecture for ${era}, ${region}. No fantasy elements. No modern objects. No text, titles, lettering or watermarks anywhere in frame. No exaggerated cinematic action. Natural human-scale perspective.`;
}

/* skills.md §7 — MOTION_SUFFIX (Sora) · VERBATIM */
export function motionSuffix(move: string): string {
  return `One slow controlled camera movement only: ${move}. Four seconds. Mute ambient realism; audio will be replaced.`;
}

/** Full still prompt = style prefix + the plan's stillPrompt + the standing bans (§7). */
export function fullStillPrompt(
  stillPrompt: string,
  era: string,
  region: string,
  category: SubjectCategory = "monument"
): string {
  const subjectRule =
    category === "animal"
      ? `The subject is the ANIMAL, rendered as a scientific plate. Any humans present are small, distant, period-dressed figures. Vertical composition, 2:3.`
      : `The subject is the PLACE, not a person. Vertical composition, 2:3.`;

  return `${stylePrefix(era, region, category)}

${stillPrompt}

No talking figures and no close-up historical faces — people appear only as silhouettes, hands, crowds or distant figures. ${subjectRule}`;
}

export function fullMotionPrompt(
  stillPrompt: string,
  move: string,
  era: string,
  region: string,
  category: SubjectCategory = "monument"
): string {
  // The motion pass animates the plate itself — it must not "come alive" into
  // video-realistic wildlife, or the reconstruction stops being an illustration.
  const holdStyle =
    category === "animal"
      ? ` The image remains a hand-drawn natural-history plate throughout — paper texture and ink linework stay visible; never becomes photographic footage.`
      : "";

  return `${stylePrefix(era, region, category)}

${stillPrompt}

${motionSuffix(move)}${holdStyle}`;
}

/* ------------------------------------------------------------------ */
/* skills.md §11 — TTS instructions · VERBATIM                         */
/* ------------------------------------------------------------------ */

export const TTS_INSTRUCTIONS = `Warm Indian documentary narrator. Curious rather than dramatic. Moderately fast. Brief pauses around dates and before the final line. Never sound like an advertisement, never theatrical.`;

/* ------------------------------------------------------------------ */
/* Identify (architecture.md §4)                                       */
/* ------------------------------------------------------------------ */

export const IDENTIFY_SYSTEM = `You identify ANY Indian subject from a photograph or a typed name: monuments, heritage sites, forts, temples and palaces, but equally lakes, rivers, mountains, forests and national parks, and Indian wildlife.

Return the single most likely subject plus up to 3 alternatives, and classify it:
- "monument" — a heritage structure: fort, temple, tomb, minaret, palace, stepwell, ruin.
- "building" — a notable non-heritage or modern structure.
- "natural_place" — a lake, river, mountain, valley, waterfall, desert, forest, beach or national park.
- "animal" — a species of Indian wildlife (Bengal tiger, Asiatic lion, Indian elephant, snow leopard, great hornbill).
- "other" — genuinely Indian in subject but none of the above.

Use the common English name as used on Wikipedia — for an animal, the species' common name ("Bengal tiger"), not an individual's name. Set region to the Indian state or region it is most associated with; for a widespread species use its main Indian range. city may be empty for animals and for large natural features.

confidence is your honest probability from 0 to 1 that the primary answer is correct. If the subject is not Indian, or you cannot tell what it is, set confidence below 0.3 and explain in notes.`;

/* ------------------------------------------------------------------ */
/* Wait-screen questions — one cheap call, fired right after identify   */
/* ------------------------------------------------------------------ */

export const QUESTIONS_SYSTEM = `You write the short questions a viewer taps through while their documentary reel renders (three to five minutes). This is a waiting room, not a quiz.

THE ONE RULE THAT MATTERS: ask about the VIEWER, anchored to this subject. Not about the subject's facts.
The viewer is a person waiting, not an exam candidate. Ask what they have seen, done, felt, would choose, would expect, or are curious about — with the subject as the anchor.
  GOOD  "Seen a tiger in the wild?" · "Sunrise or sunset on the water?" · "Climbed one of these before?" · "Which part would you want to stand in?"
  BAD   "Pick a place associated with him" · "Which role was most central?" · "What part of the story interests you most?"
The bad ones are list-picking: they test recall or make the viewer choose between facts they may not know. Every question except the guess must be answerable by someone who knows NOTHING about the subject, purely from their own experience or taste.

Rules, all hard:
- Write 8 questions. Each is at most 10 words.
- Each has 3–4 chips. A chip is 1–2 words. The viewer only ever TAPS — never typing — so each chip must be a complete answer on its own.
- Each chip may carry a one-line "ack": a warm, specific reply shown after the tap, at most 12 words. React to what they actually picked. Never "Nice!" or "Great choice!".
- EXACTLY ONE question has kind "guess" and carries a "reveal": a real, surprising fact drawn ONLY from the research text. Every other question has kind "poll" and no reveal. Put the guess third or later — open with something easy.
- Vary the shape across the eight: personal experience, preference, expectation, imagination, curiosity. Never eight of the same shape.
- No wrong answers anywhere except the guess, where being wrong is the fun.
- Warm, curious, plain English. No emoji. No exclamation marks. Never mention loading, waiting, rendering, or the app.

WHEN THE SUBJECT IS A PERSON: ask about the viewer's relationship to the story — whether they have visited a place from it, what part they would want to see, what they would have expected. NEVER ask for approval, support, opinion of the person, or anything a viewer could read as taking a political side. No questions about parties, elections, policies or controversies. The reel is history, not commentary.

The reveal must be TRUE according to the supplied text. If the text supports no surprising fact, use the most concrete fact it does give — never invent one.`;

export function questionsUserMessage(args: {
  name: string;
  category: SubjectCategory;
  description: string;
}): string {
  return `SUBJECT: ${args.name}
CATEGORY: ${args.category}
WHAT IT IS: ${args.description}

Write the 8 questions. The guess question's reveal must come from the text above.`;
}

/* ------------------------------------------------------------------ */
/* Translation (skills.md §11 — reuse the plan, never re-plan)          */
/* ------------------------------------------------------------------ */

export function translatePrompt(target: Lang): string {
  return `Translate this reel's spoken and on-screen text into ${LANGUAGE_NAMES[target]} for a warm documentary narrator.
Translate ONLY: hook, takeaway, each shot's narration, each caption text, and each timeline event label.
Do NOT translate or change: years, proper names of people and places (transliterate them naturally into the target script), archivalQuery, stillPrompt, motionPrompt, sources, shot types, timings.
Keep the same compressed, spoken rhythm — this is read aloud, not read on a page. Captions stay 3–7 words. Keep the total narration close to the original length so it still fits ${DURATION_SECONDS} seconds — if the target language is naturally longer than English, compress the phrasing rather than letting the lines run long.
Return the same JSON structure with the translated fields replaced and language set to "${target}".`;
}

/* ------------------------------------------------------------------ */
/* Orchestrator status labels (architecture.md §4 — part of the UX)     */
/* ------------------------------------------------------------------ */

export const STEP_LABELS: Record<string, string> = {
  identify: "Working out what you're standing in front of…",
  research: "Reading the historical record…",
  plan: "Deciding which five things actually matter…",
  assets: "Digging through the archives…",
  reconstruct: "Reconstructing what no camera ever saw…",
  narrate: "Finding the voice for this story…",
  render: `Cutting your ${Math.round(DURATION_SECONDS)} seconds…`,
  done: "Ready.",
  error: "Something broke.",
};

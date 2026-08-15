"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SubjectCategory, WaitQuestion } from "@/lib/types";
import styles from "./engagement.module.css";

/**
 * While-you-wait micro-conversation on the progress screen.
 *
 * Tap-only (never typing), one card at a time, interleaved with progress
 * milestones. Entirely client-side — answers live in React state and are never
 * sent anywhere. The reel ALWAYS wins: when status flips to done this unmounts
 * mid-question and unanswered questions simply disappear.
 *
 * The questions themselves are now generated per subject and arrive on the
 * status JSON:
 *   undefined → still being written  → shimmer placeholder
 *   null      → generation failed    → the fixed queue below, silently
 *   array     → use them
 * The user must never learn that anything failed.
 */

export type AnswerMap = Record<string, string>;

interface Choice {
  label: string;
  ack?: string;
}

interface Question {
  id: string;
  prompt: string;
  choices: Choice[];
  /** a "guess" question: the real fact, revealed after the tap */
  reveal?: string;
  /** fixed-queue age question only: the reveal is computed from the plan's start year */
  deriveReveal?: boolean;
}

/**
 * Used only when the generated set fails or never arrives — and the subject is
 * NOT always a monument. An animal has no construction date and a lake has no
 * "first time here", so the fallback is picked per category. The failure is
 * silent by design, which means a wrong question here would be the only clue
 * anything went wrong.
 */
const WHO_QUESTION: Question = {
  id: "who",
  prompt: "Who's with you today?",
  choices: [
    { label: "Solo", ack: "Solo travellers notice more 👀" },
    { label: "Family", ack: "Something here for everyone 👨‍👩‍👧" },
    { label: "Friends", ack: "Best watched together 🎬" },
    { label: "On a trip", ack: "Adding some depth to the trip ✈️" },
  ],
};

/** monument · building · natural_place — somewhere you can stand. */
const PLACE_DECK: Question[] = [
  {
    id: "visit",
    prompt: "Is this your first time here?",
    choices: [
      { label: "First time", ack: "First-timers get the best surprises 👀" },
      { label: "Been before", ack: "Then you'll spot what changed 🔍" },
      { label: "I live nearby", ack: "The best history is what you walk past 🏛️" },
    ],
  },
  {
    id: "feel",
    prompt: "How does this place make you feel?",
    choices: [
      { label: "😮 Amazed", ack: "Wait until you see what it looked like" },
      { label: "🤔 Curious", ack: "Curiosity is the whole point" },
      { label: "😌 Peaceful", ack: "It's held that calm for centuries" },
      { label: "📸 Just exploring", ack: "Exploring is how the best stories start" },
    ],
  },
  WHO_QUESTION,
];

/** Only ever appended to the deck for something that was BUILT. */
const AGE_QUESTION: Question = {
  id: "age",
  prompt: "Quick guess — how old is this place?",
  deriveReveal: true,
  choices: [{ label: "~200 years" }, { label: "~500 years" }, { label: "800+ years" }],
};

const ANIMAL_DECK: Question[] = [
  {
    id: "seen",
    prompt: "Have you ever seen one in the wild?",
    choices: [
      { label: "Never", ack: "Most people never do 👀" },
      { label: "Once", ack: "Then you know how that feels" },
      { label: "Many times", ack: "You've been lucky 🐾" },
      { label: "Only in photos", ack: "Photos never quite do it 📸" },
    ],
  },
  {
    id: "feel",
    prompt: "How does this creature make you feel?",
    choices: [
      { label: "😮 Amazed", ack: "Wait until you see it move" },
      { label: "🤔 Curious", ack: "Curiosity is the whole point" },
      { label: "😌 Calm", ack: "There's a stillness to it" },
      { label: "😬 A little afraid", ack: "Respect is the right instinct" },
    ],
  },
  {
    id: "who",
    prompt: "Who's watching with you?",
    choices: WHO_QUESTION.choices,
  },
];

const OTHER_DECK: Question[] = [
  {
    id: "known",
    prompt: "How much do you already know about this?",
    choices: [
      { label: "Nothing at all", ack: "Perfect place to start 👀" },
      { label: "A little", ack: "We'll fill in the gaps" },
      { label: "Quite a lot", ack: "See if we can still surprise you" },
    ],
  },
  {
    id: "feel",
    prompt: "How does this make you feel?",
    choices: [
      { label: "😮 Amazed", ack: "Wait until you see the rest" },
      { label: "🤔 Curious", ack: "Curiosity is the whole point" },
      { label: "😌 Calm", ack: "Some stories land quietly" },
      { label: "📸 Just exploring", ack: "Exploring is how the best stories start" },
    ],
  },
  WHO_QUESTION,
];

/**
 * `category` is absent on statuses cached before the app was generalised —
 * treat that as a monument (lib/types.ts says the same about ReelPlan).
 */
function fallbackDeck(category?: SubjectCategory): Question[] {
  if (category === "animal") return ANIMAL_DECK;
  if (category === "other") return OTHER_DECK;
  // Only something that was BUILT gets asked when it was built.
  const built = category === undefined || category === "monument" || category === "building";
  return built ? [...PLACE_DECK, AGE_QUESTION] : PLACE_DECK;
}

/** Shown when a generated chip carries no ack of its own. */
const DEFAULT_ACKS = ["Noted 👍", "Good to know 👀", "Got it ✍️"];

/**
 * How long the shimmer may run before we quietly use the fixed queue.
 * Question generation is a few seconds; a full generation is minutes. Waiting
 * forever on a status field that never arrives would silently delete the whole
 * wait-screen experience, so the shimmer has a hard ceiling.
 */
const SHIMMER_GRACE_MS = 10_000;

const ACK_MS = 1500;
const REVEAL_MS = 2600;

/**
 * Fallback only. The pipeline now sends a live `label` on every poll — the real
 * one names the shot it is on ("Reconstructing shot 3 — c. 1960s"), which is far
 * better proof of life than anything derived from a percentage. These are used
 * for the first poll or two, before any status has landed.
 */
const MILESTONES: { at: number; text: string }[] = [
  { at: 0, text: "Working out what you're looking at…" },
  { at: 25, text: "Digging through the archives…" },
  { at: 50, text: "Halfway — your reel is taking shape 🎬" },
  { at: 75, text: "Recording your narration…" },
  { at: 90, text: "Almost there…" },
];

/**
 * Shown once the deck is spent. A cold generation runs three to five minutes and
 * even eight questions do not fill that, so the last card must not read as an
 * ending — it rotates, so the screen keeps moving until the reel interrupts it.
 */
const HOLD_LINES = [
  "That's all the questions — thanks for playing along.",
  "The archive is deep. Still digging through it.",
  "Every shot is being rebuilt, one at a time.",
  "Narration, music and subtitles are being cut together.",
  "Almost none of this is stock footage. That's why it's worth the wait.",
  "Hang tight — it starts the second it's ready.",
];

const HOLD_ROTATE_MS = 6500;

/** Generated questions → the shape this component renders. Defensive: the model
 *  can always hand back a malformed entry, and a broken card is worse than one
 *  question fewer. */
function adopt(list: WaitQuestion[]): Question[] {
  return list
    .filter((q) => q && typeof q.question === "string" && q.question.trim() && Array.isArray(q.chips))
    .map((q, i) => ({
      id: q.id?.trim() || `q${i}`,
      prompt: q.question.trim(),
      choices: q.chips
        .filter((c) => c && typeof c.label === "string" && c.label.trim())
        .slice(0, 4)
        .map((c) => ({ label: c.label.trim(), ack: c.ack?.trim() || undefined })),
      reveal: q.kind === "guess" ? q.reveal?.trim() || undefined : undefined,
    }))
    .filter((q) => q.choices.length >= 2);
}

const CURRENT_YEAR = 2026;

/**
 * A timeline's startYear is only sometimes a calendar year. Bengal tiger's is
 * "c. 16,500 BP" — a bare /\d{3,4}/ skips the "16" and matches "500", which is
 * how a tiger ends up being told its construction began in 500. Anything on a
 * prehistoric scale, or any number that isn't a plausible past year, is refused.
 */
function parseStartYear(startYear?: string): number | null {
  if (!startYear) return null;
  if (/\b(bp|bce|b\.?c\.?|mya|kya|million|billion)\b|years ago/i.test(startYear)) return null;
  const m = startYear.match(/\d[\d,]*/);
  if (!m) return null;
  const year = Number(m[0].replace(/,/g, ""));
  if (!Number.isFinite(year) || year < 1 || year > CURRENT_YEAR) return null;
  return year;
}

function ageReveal(guess: string, startYear?: string): string {
  const year = parseStartYear(startYear);
  if (!year) return "Watch the reel to find out 👀";

  const age = CURRENT_YEAR - year;
  const bucket = age >= 800 ? "800+ years" : age >= 350 ? "~500 years" : "~200 years";
  const lead = guess === bucket ? "Spot on" : "Close";
  return `${lead} — construction began in ${year}!`;
}

function ackFor(q: Question, c: Choice, index: number, startYear?: string): string {
  if (q.deriveReveal) return ageReveal(c.label, startYear);
  if (q.reveal) return c.ack ? `${c.ack} — ${q.reveal}` : q.reveal;
  return c.ack ?? DEFAULT_ACKS[index % DEFAULT_ACKS.length];
}

export function Engagement({
  pct,
  label,
  elapsed,
  startYear,
  questions,
  category,
  onAnswers,
}: {
  pct: number;
  /** live step line from the pipeline — the honest one; MILESTONES is the fallback */
  label?: string;
  /** pre-formatted m:ss from the page — proof the screen is alive */
  elapsed?: string;
  startYear?: string;
  /** undefined = still generating · null = failed · array = use these */
  questions?: WaitQuestion[] | null;
  /** what the subject turned out to be — only shapes the fallback deck */
  category?: SubjectCategory;
  onAnswers?: (a: AnswerMap) => void;
}) {
  const [index, setIndex] = useState(0);
  const [ack, setAck] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  /**
   * The question set, locked once chosen. Polling delivers a new `questions`
   * array every 1.5s; swapping the deck out from under someone mid-answer would
   * be the one obviously broken thing on this screen.
   */
  const [deck, setDeck] = useState<Question[] | null>(null);
  /** which hold line is up, once the deck runs out */
  const [hold, setHold] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (deck) return; // already committed

    if (Array.isArray(questions)) {
      const adopted = adopt(questions);
      // An empty/unusable set is treated exactly like a failure: fall back, quietly.
      setDeck(adopted.length ? adopted : fallbackDeck(category));
      return;
    }
    // A known failure still waits for the category — the fallback deck is shaped
    // by it, and asking an animal about its construction date is worse than
    // shimmering for another second.
    if (questions === null && category) {
      setDeck(fallbackDeck(category));
      return;
    }

    // Still generating → shimmer, but never forever. Anchored to mount so that
    // a late-arriving category can't keep pushing the ceiling back.
    const wait = Math.max(0, SHIMMER_GRACE_MS - (Date.now() - mountedAt.current));
    const t = setTimeout(() => setDeck(fallbackDeck(category)), wait);
    return () => clearTimeout(t);
  }, [questions, category, deck]);

  const advance = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAck(null);
      setIndex((i) => i + 1);
    }, delay);
  }, []);

  const pick = useCallback(
    (q: Question, c: Choice, i: number) => {
      const next = { ...answers, [q.id]: c.label };
      setAnswers(next);
      onAnswers?.(next);
      setAck(ackFor(q, c, i, startYear));
      // A revealed fact needs longer on screen than a one-line ack.
      advance(q.reveal || q.deriveReveal ? REVEAL_MS : ACK_MS);
    },
    [answers, advance, onAnswers, startYear]
  );

  const skip = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setAck(null);
    setIndex((i) => i + 1);
  }, []);

  // Prefer what the pipeline actually says it is doing; the pct-derived line is
  // only for the first poll or two, before any status has landed.
  const step = useMemo(() => {
    if (label && label.trim() && label.trim() !== "Ready.") return label.trim();
    let m = MILESTONES[0].text;
    for (const x of MILESTONES) if (pct >= x.at) m = x.text;
    return m;
  }, [label, pct]);

  const q = deck?.[index];
  const spent = Boolean(deck) && !q;

  useEffect(() => {
    if (!spent) return;
    const id = setInterval(() => setHold((h) => h + 1), HOLD_ROTATE_MS);
    return () => clearInterval(id);
  }, [spent]);

  // Their own taps, played back — it makes the answers feel like they landed
  // somewhere instead of vanishing.
  const recap = useMemo(() => Object.values(answers).slice(0, 4), [answers]);

  return (
    <section className={styles.wrap} aria-live="polite">
      <div className={styles.progressRow}>
        <span className={styles.pct}>{Math.min(99, Math.max(1, Math.round(pct)))}%</span>
        <span className={styles.milestone} key={step}>
          {step}
        </span>
      </div>

      <div className={styles.meta}>
        <span className={styles.beat} aria-hidden />
        <span className={styles.working}>Still working</span>
        {elapsed && (
          <>
            <span aria-hidden>·</span>
            <span className={styles.elapsed}>{elapsed}</span>
          </>
        )}
      </div>

      {!deck ? (
        <div className={styles.card}>
          <p className={styles.thinking}>Thinking of a question for you…</p>
          <div className={styles.shimmerLine} aria-hidden />
          <div className={styles.shimmerChips} aria-hidden>
            <span className={`${styles.shimmerChip} ${styles.sA}`} />
            <span className={`${styles.shimmerChip} ${styles.sB}`} />
            <span className={`${styles.shimmerChip} ${styles.sC}`} />
          </div>
        </div>
      ) : q ? (
        <div className={styles.card} key={q.id}>
          {ack ? (
            <p className={styles.ack}>{ack}</p>
          ) : (
            <>
              <p className={styles.prompt}>{q.prompt}</p>
              <div className={styles.chips}>
                {q.choices.map((c, i) => (
                  <button
                    key={c.label}
                    type="button"
                    className={styles.chip}
                    onClick={() => pick(q, c, i)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <button type="button" className={styles.skip} onClick={skip}>
                Skip
              </button>
            </>
          )}
        </div>
      ) : (
        /* Deck spent — but the render is not. This must never read as finished. */
        <div className={styles.card}>
          <p className={styles.holdLine} key={hold}>
            {HOLD_LINES[hold % HOLD_LINES.length]}
          </p>

          {recap.length > 0 && (
            <div className={styles.recap}>
              <span className={styles.recapLead}>You said</span>
              {recap.map((r) => (
                <span key={r} className={styles.recapChip}>
                  {r}
                </span>
              ))}
            </div>
          )}

          <div className={styles.breath} aria-hidden>
            <span />
            <span />
            <span />
          </div>
        </div>
      )}
    </section>
  );
}

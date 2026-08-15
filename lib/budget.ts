/**
 * Budget ledger + hard stop (architecture.md §8). NON-NEGOTIABLE.
 *
 * Every OpenAI call in lib/openai.ts must:
 *   1. assertAffordable(estimate)   — throws BudgetExceededError above the hard stop
 *   2. respect the mock flags       — ALLOW_MEDIA / ALLOW_SORA
 *   3. record(estimate)             — append to cache/budget.json after success
 */

import fs from "node:fs";
import path from "node:path";

const LEDGER_PATH = path.join(process.cwd(), "cache", "budget.json");

export const HARD_STOP = Number(process.env.BUDGET_HARD_STOP ?? 25);
export const TARGET = Number(process.env.BUDGET_TARGET ?? 12);

/** Per-call cost estimates in USD (architecture.md §8). */
export const COST = {
  identify: 0.005,
  plan: 0.02,
  translate: 0.01,
  still: 0.05,
  soraClip: 0.4,
  ttsShot: 0.0015, // 8 shots ≈ $0.012 per reel
  questions: 0.005, // one small structured call on the identify tier, per reel
} as const;

export type CostKind = keyof typeof COST;

export interface LedgerEntry {
  at: string;
  kind: CostKind | string;
  detail: string;
  usd: number;
  runningTotal: number;
}

export interface Ledger {
  total: number;
  entries: LedgerEntry[];
}

export class BudgetExceededError extends Error {
  constructor(projected: number, estimate: number) {
    super(
      `BUDGET HARD STOP: projected $${projected.toFixed(2)} (current + $${estimate.toFixed(
        2
      )}) exceeds $${HARD_STOP.toFixed(2)}. Refusing the call.`
    );
    this.name = "BudgetExceededError";
  }
}

function emptyLedger(): Ledger {
  return { total: 0, entries: [] };
}

export function readLedger(): Ledger {
  try {
    const raw = fs.readFileSync(LEDGER_PATH, "utf8");
    const parsed = JSON.parse(raw) as Ledger;
    if (typeof parsed.total !== "number" || !Array.isArray(parsed.entries)) return emptyLedger();
    return parsed;
  } catch {
    return emptyLedger();
  }
}

function writeLedger(ledger: Ledger) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

export function spent(): number {
  return readLedger().total;
}

export function remaining(): number {
  return Math.max(0, HARD_STOP - spent());
}

/** Throws BEFORE the call if it would push projected spend past the hard stop. */
export function assertAffordable(estimate: number, detail = ""): void {
  const projected = spent() + estimate;
  if (projected > HARD_STOP) throw new BudgetExceededError(projected, estimate);
  if (projected > TARGET) {
    console.warn(
      `[budget] ⚠️  $${projected.toFixed(2)} projected — past the $${TARGET} target (hard stop $${HARD_STOP}). ${detail}`
    );
  }
}

/** Append an actual spend AFTER a successful call. */
export function record(kind: CostKind | string, usd: number, detail = ""): number {
  const ledger = readLedger();
  const total = Number((ledger.total + usd).toFixed(4));
  ledger.entries.push({
    at: new Date().toISOString(),
    kind,
    detail,
    usd: Number(usd.toFixed(4)),
    runningTotal: total,
  });
  ledger.total = total;
  writeLedger(ledger);
  console.log(`[budget] +$${usd.toFixed(3)} ${kind} ${detail} → total $${total.toFixed(3)}`);
  return total;
}

/* ------------------------------------------------------------------ */
/* Mock flags                                                          */
/* ------------------------------------------------------------------ */

const truthy = (v: string | undefined) => v === "true" || v === "1";

/** images + TTS. false until Phase 5. */
export function allowMedia(): boolean {
  return truthy(process.env.ALLOW_MEDIA);
}

/** Sora 2 video. false until Phase 5. */
export function allowSora(): boolean {
  return truthy(process.env.ALLOW_SORA);
}

export function budgetSummary(): string {
  const l = readLedger();
  return `$${l.total.toFixed(3)} spent · $${remaining().toFixed(2)} left of $${HARD_STOP} · target $${TARGET} · ALLOW_MEDIA=${allowMedia()} ALLOW_SORA=${allowSora()}`;
}

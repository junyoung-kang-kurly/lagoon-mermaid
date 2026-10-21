import type { Diagnostic } from '../diagnose'
import { type Candidate, LAST_RESORT, RULES, type Rule, contextFor } from './rules'
import { splitLines } from './text'

export type Validate = (code: string) => Promise<Diagnostic | null>

export interface FixStep extends Candidate {
  ruleId: string
  before: string
}

export interface FixResult {
  /** the diagram parses after applying every step */
  ok: boolean
  code: string
  steps: FixStep[]
  remaining: Diagnostic | null
}

/**
 * How much of the document is still unparsed: the lines after the error, then the rest of its
 * line. Measured from the end so that edits before the error (inserting quotes, deleting a fence
 * line) do not look like progress, and in lines so that edits after it (one candidate quoting
 * every label) do not look like a setback.
 */
function remainingAfter(code: string, d: Diagnostic): number {
  const lines = splitLines(code)
  const at = Math.min(d.line, lines.length)
  return (lines.length - at) * 1e6 + Math.max(0, lines[at - 1].length - d.column)
}

/** higher is better; null when the candidate made things worse */
function gain(prev: Diagnostic, prevCode: string, next: Diagnostic | null, cand: Candidate): number | null {
  if (!next) return Number.POSITIVE_INFINITY
  if (prev.kind === 'unknown-diagram') return next.kind === 'unknown-diagram' ? null : 1e9
  if (next.kind === 'unknown-diagram') return null
  const before = remainingAfter(prevCode, prev)
  const after = remainingAfter(cand.code, next)
  // an unterminated construct swallowed the rest of the file; closing it may surface earlier errors
  if (prev.atEnd && !next.atEnd) return 1e12 - after
  // still stuck at the end, but one of several open constructs got closed: the parser wants something else now
  if (prev.atEnd && next.atEnd && !cand.lossy && cand.code.length >= prevCode.length && prev.expected.join() !== next.expected.join()) return 1
  return after < before ? before - after : null
}

async function bestCandidate(
  rules: Rule[],
  code: string,
  diag: Diagnostic,
  validate: Validate,
  seen: Set<string>,
  stop: () => boolean,
): Promise<{ step: FixStep; diag: Diagnostic | null } | null> {
  const ctx = contextFor(code, diag)
  let best: { step: FixStep; diag: Diagnostic | null; score: number } | null = null
  for (const rule of rules) {
    for (const cand of rule.propose(ctx)) {
      if (cand.code === code || seen.has(cand.code)) continue
      if (stop()) return best
      seen.add(cand.code)
      const next = await validate(cand.code)
      const score = gain(diag, code, next, cand)
      if (score === null) continue
      const step: FixStep = { ...cand, ruleId: rule.id, before: code }
      if (!next) return { step, diag: null }
      if (!best || score > best.score) best = { step, diag: next, score }
    }
  }
  return best
}

/**
 * Repairs a diagram by trying rule-generated candidates and keeping only those the
 * real mermaid parser confirms: either the error disappears or the parser gets
 * further into the document. No guessing is ever shown to the user unverified.
 */
export async function autoFix(
  code: string,
  validate: Validate,
  // most rules repair one line per step, so a long diagram needs more of them
  { maxSteps = Math.max(12, splitLines(code).length), budgetMs = 2500, signal }: { maxSteps?: number; budgetMs?: number; signal?: AbortSignal } = {},
): Promise<FixResult> {
  const deadline = performance.now() + budgetMs
  // a background search is abandoned as soon as the user edits again
  const stop = () => signal?.aborted === true || performance.now() > deadline
  let current = code
  let diag = await validate(current)
  const steps: FixStep[] = []
  const seen = new Set<string>([code])
  let usedLastResort = false

  for (let i = 0; i < maxSteps && diag && !signal?.aborted; i++) {
    let found = await bestCandidate(RULES, current, diag, validate, seen, stop)
    if (!found && !usedLastResort) {
      found = await bestCandidate(LAST_RESORT, current, diag, validate, seen, stop)
      if (found) usedLastResort = true
    }
    if (!found) break
    steps.push(found.step)
    current = found.step.code
    diag = found.diag
  }
  return { ok: !diag, code: current, steps, remaining: diag }
}

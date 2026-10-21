import { diffChars, diffLines } from 'diff'
import { type ReactNode, useMemo } from 'react'
import { cx } from './ui'

interface Row {
  kind: 'same' | 'add' | 'del' | 'gap'
  oldNo?: number
  newNo?: number
  content: ReactNode
}

function splitLines(value: string): string[] {
  const lines = value.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function inline(before: string, after: string, side: 'del' | 'add'): ReactNode {
  const parts = diffChars(before, after)
  return parts
    .filter((p) => (side === 'del' ? !p.added : !p.removed))
    .map((p, i) =>
      (side === 'del' && p.removed) || (side === 'add' && p.added) ? (
        <mark key={i} className={cx('rounded-[3px] px-[1px] text-inherit', side === 'add' ? 'bg-ok/30' : 'bg-danger/30')}>
          {p.value}
        </mark>
      ) : (
        <span key={i}>{p.value}</span>
      ),
    )
}

function similarity(a: string, b: string): number {
  if (!a.trim() && !b.trim()) return 1
  const same = diffChars(a, b).reduce((n, p) => (p.added || p.removed ? n : n + p.value.length), 0)
  return (2 * same) / (a.length + b.length || 1)
}

/** pairs up removed/added lines that are edits of each other, keeping order */
function align(dels: string[], adds: string[]): Array<[string | undefined, string | undefined]> {
  type Pair = [string | undefined, string | undefined]
  if (dels.length * adds.length > 4000)
    return [...dels.map((d, i): Pair => [d, adds[i]]), ...adds.slice(dels.length).map((a): Pair => [undefined, a])]
  const n = dels.length
  const m = adds.length
  const score = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  const sim = dels.map((d) => adds.map((a) => similarity(d, a)))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      score[i][j] = Math.max(score[i + 1][j], score[i][j + 1], sim[i][j] > 0.45 ? score[i + 1][j + 1] + sim[i][j] : 0)
  const out: Array<[string | undefined, string | undefined]> = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && sim[i][j] > 0.45 && score[i][j] === score[i + 1][j + 1] + sim[i][j]) out.push([dels[i++], adds[j++]])
    else if (i < n && (j >= m || score[i][j] === score[i + 1][j])) out.push([dels[i++], undefined])
    else out.push([undefined, adds[j++]])
  }
  return out
}

export function DiffView({ before, after, context = 3 }: { before: string; after: string; context?: number }) {
  const rows = useMemo(() => {
    const parts = diffLines(before, after)
    const out: Row[] = []
    let oldNo = 1
    let newNo = 1
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const lines = splitLines(part.value)
      const next = parts[i + 1]
      if (part.removed && next?.added) {
        const added = splitLines(next.value)
        for (const [a, b] of align(lines, added)) {
          if (a !== undefined) out.push({ kind: 'del', oldNo: oldNo++, content: b !== undefined ? inline(a, b, 'del') : a })
          if (b !== undefined) out.push({ kind: 'add', newNo: newNo++, content: a !== undefined ? inline(a, b, 'add') : b })
        }
        i++
        continue
      }
      for (const line of lines) {
        if (part.added) out.push({ kind: 'add', newNo: newNo++, content: line })
        else if (part.removed) out.push({ kind: 'del', oldNo: oldNo++, content: line })
        else out.push({ kind: 'same', oldNo: oldNo++, newNo: newNo++, content: line })
      }
    }
    // collapse long unchanged stretches
    const keep = out.map((r, i) => r.kind !== 'same' || out.slice(Math.max(0, i - context), i + context + 1).some((x) => x.kind !== 'same'))
    const collapsed: Row[] = []
    let hidden = 0
    out.forEach((r, i) => {
      if (keep[i]) {
        if (hidden) collapsed.push({ kind: 'gap', content: hidden })
        hidden = 0
        collapsed.push(r)
      } else hidden++
    })
    if (hidden) collapsed.push({ kind: 'gap', content: hidden })
    return collapsed
  }, [before, after, context])

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface font-mono text-[12.5px] leading-[1.7]">
      <div className="max-h-[42vh] overflow-auto">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((r, i) =>
              r.kind === 'gap' ? (
                <tr key={i} className="bg-surface-3/50 text-muted">
                  <td colSpan={3} className="px-3 py-0.5 text-[11px]">
                    ⋯ {r.content} lines
                  </td>
                </tr>
              ) : (
                <tr
                  key={i}
                  className={cx(r.kind === 'add' && 'bg-ok/[0.09]', r.kind === 'del' && 'bg-danger/[0.08]')}
                >
                  <td className="w-9 select-none border-r border-line px-2 text-right align-top text-[11px] text-muted/70">{r.oldNo ?? ''}</td>
                  <td className="w-5 select-none text-center align-top">
                    <span className={cx(r.kind === 'add' && 'text-ok', r.kind === 'del' && 'text-danger')}>
                      {r.kind === 'add' ? '+' : r.kind === 'del' ? '−' : ''}
                    </span>
                  </td>
                  <td className={cx('whitespace-pre-wrap break-all pr-4', r.kind === 'del' ? 'text-text-2' : 'text-text')}>{r.content || ' '}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

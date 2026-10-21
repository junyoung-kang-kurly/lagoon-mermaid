import { DIRECTIVE_RE, buildLineMap } from '../diagnose'

export type DiagramFamily =
  | 'flowchart'
  | 'sequence'
  | 'class'
  | 'state'
  | 'er'
  | 'gantt'
  | 'journey'
  | 'pie'
  | 'git'
  | 'mindmap'
  | 'quadrant'
  | 'xy'
  | 'timeline'
  | 'other'

// every header mermaid 12.2 detects, so a valid but less common type is never "corrected"
export const DIAGRAM_KEYWORDS = [
  'flowchart', 'graph', 'flowchart-elk', 'sequenceDiagram', 'classDiagram', 'classDiagram-v2', 'stateDiagram',
  'stateDiagram-v2', 'erDiagram', 'journey', 'gantt', 'pie', 'quadrantChart', 'requirementDiagram', 'requirement',
  'gitGraph', 'C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment', 'mindmap', 'timeline', 'zenuml',
  'sankey-beta', 'sankey', 'xychart-beta', 'xychart', 'block-beta', 'block', 'packet-beta', 'packet', 'kanban',
  'architecture-beta', 'architecture', 'radar-beta', 'treemap-beta', 'treemap', 'treeView-beta', 'info', 'agentflow-beta',
  'swimlane-beta', 'eventmodeling', 'ishikawa', 'ishikawa-beta', 'venn-beta', 'usecase-beta', 'cynefin-beta',
  'railroad-beta', 'railroad-ebnf-beta', 'railroad-abnf-beta', 'railroad-peg-beta',
]

export function header(code: string): { word: string; line: number; text: string } | null {
  const map = buildLineMap(code)
  if (!map.cleanedLines.length) return null
  const text = map.cleanedLines[0]
  return { word: text.trim().split(/[\s:]+/)[0] ?? '', line: map.toOriginal[0], text }
}

export function familyOf(code: string): DiagramFamily {
  const word = header(code)?.word ?? ''
  if (word === 'flowchart' || word === 'graph' || word === 'flowchart-elk') return 'flowchart'
  if (word === 'sequenceDiagram') return 'sequence'
  if (word.startsWith('classDiagram')) return 'class'
  if (word.startsWith('stateDiagram')) return 'state'
  if (word === 'erDiagram') return 'er'
  if (word === 'gantt') return 'gantt'
  if (word === 'journey') return 'journey'
  if (word === 'pie') return 'pie'
  if (word === 'gitGraph') return 'git'
  if (word === 'mindmap') return 'mindmap'
  if (word === 'quadrantChart') return 'quadrant'
  if (word.startsWith('xychart')) return 'xy'
  if (word === 'timeline') return 'timeline'
  return 'other'
}

export const splitLines = (code: string) => code.split('\n')

export function replaceLine(code: string, index: number, next: string): string {
  const lines = splitLines(code)
  lines[index] = next
  return lines.join('\n')
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/** closest keyword within a small edit distance; exact (case-sensitive) matches return null */
export function closestKeyword(word: string, keywords: string[]): string | null {
  if (!word || keywords.includes(word)) return null
  let best: string | null = null
  let bestScore = Infinity
  for (const k of keywords) {
    const d = levenshtein(word.toLowerCase(), k.toLowerCase())
    const limit = k.length <= 4 ? 1 : k.length <= 8 ? 2 : 3
    if (d <= limit && d < bestScore) {
      best = k
      bestScore = d
    }
  }
  return best
}

const ID_CHAR = /[\p{L}\p{N}_]/u

export const SHAPES: Array<[string, string]> = [
  ['(((', ')))'], ['((', '))'], ['([', '])'], ['[[', ']]'], ['[(', ')]'], ['{{', '}}'],
  ['[/', '/]'], ['[\\', '\\]'], ['[/', '\\]'], ['[\\', '/]'], ['[', ']'], ['(', ')'], ['{', '}'], ['>', ']'],
]

const AFTER_SHAPE = /^\s*($|[;&:|%<]|[-=.~])/

// a leading or trailing slash would read as a trapezoid, `@` as an edge id
const NEEDS_QUOTES = /[()[\]{}"|@]|^\s*[/\\]|[/\\]\s*$/

function quoteContent(content: string): string | null {
  const trimmed = content.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    const inner = trimmed.slice(1, -1)
    const q = inner.indexOf('"')
    if (q === -1) return null
    // `"a" and "b"`: the first inner quote closes the opening one, so these are two quoted parts
    if (q === 0 || /\s/.test(inner[q - 1])) return `"${inner.replace(/"/g, '#quot;')}"`
  } else if (trimmed.startsWith('`') || !NEEDS_QUOTES.test(content)) return null
  return `"${content.replace(/"/g, '#quot;')}"`
}

/**
 * Wraps flowchart node labels and edge labels that contain shape characters in
 * double quotes: A[Start (beta)] → A["Start (beta)"], -->|go (now)| → -->|"go (now)"|
 */
export function quoteLabelsInLine(line: string): string {
  if (line.includes('@{')) return line
  let out = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (line.startsWith('%%', i)) return out + line.slice(i)
    if (ch === '"') {
      const end = line.indexOf('"', i + 1)
      const stop = end === -1 ? line.length : end + 1
      out += line.slice(i, stop)
      i = stop
      continue
    }
    if (ch === '|') {
      const end = line.indexOf('|', i + 1)
      if (end > i) {
        const content = line.slice(i + 1, end)
        out += '|' + (quoteContent(content) ?? content) + '|'
        i = end + 1
        continue
      }
    }
    if (ID_CHAR.test(ch) && (i === 0 || !ID_CHAR.test(line[i - 1]))) {
      let j = i
      while (j < line.length && ID_CHAR.test(line[j])) j++
      // `[/api]` opens like a trapezoid but only closes as a plain `]`: fall through to the next shape
      let shaped = false
      for (const [open, close] of SHAPES) {
        if (!line.startsWith(open, j)) continue
        let k = line.indexOf(close, j + open.length)
        while (k !== -1 && !AFTER_SHAPE.test(line.slice(k + close.length))) k = line.indexOf(close, k + 1)
        if (k === -1) continue
        const content = line.slice(j + open.length, k)
        out += line.slice(i, j) + open + (quoteContent(content) ?? content) + close
        i = k + close.length
        shaped = true
        break
      }
      if (shaped) continue
      out += line.slice(i, j)
      i = j
      continue
    }
    out += ch
    i++
  }
  return out
}

/** Applies fn to the parts of a line that are outside of labels, quotes and comments */
export function mapOutsideLabels(line: string, fn: (segment: string) => string): string {
  let out = ''
  let buf = ''
  const flush = () => {
    out += fn(buf)
    buf = ''
  }
  const pairs: Record<string, string> = { '[': ']', '(': ')', '{': '}', '"': '"', '|': '|' }
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (line.startsWith('%%', i)) {
      flush()
      return out + line.slice(i)
    }
    const close = pairs[ch]
    if (close) {
      const end = line.indexOf(close, i + 1)
      if (end !== -1) {
        flush()
        // nested shapes like (( )) or [( )] close with the last matching closer before a boundary
        let stop = end
        if (ch !== '"' && ch !== '|') {
          let depth = 0
          for (let k = i; k < line.length; k++) {
            if (line[k] === ch) depth++
            else if (line[k] === close) {
              depth--
              if (depth === 0) {
                stop = k
                break
              }
            }
          }
        }
        out += line.slice(i, stop + 1)
        i = stop + 1
        continue
      }
    }
    buf += ch
    i++
  }
  flush()
  return out
}

const OPENERS: Record<string, string> = { '[': ']', '(': ')', '{': '}' }

/** Closes brackets/quotes left open on a line: A[hello --> B → A[hello] --> B */
export function closeOpenBrackets(line: string): string | null {
  const stack: Array<{ ch: string; at: number }> = []
  let inQuote = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuote = inQuote === -1 ? i : -1
      continue
    }
    if (inQuote !== -1) continue
    if (OPENERS[ch]) stack.push({ ch, at: i })
    else if (ch === ']' || ch === ')' || ch === '}') {
      if (stack.length && OPENERS[stack[stack.length - 1].ch] === ch) stack.pop()
    }
  }
  // a `{` or `[` ending the line opens a block body (ER entity, class, composite state), closed on a later line
  if (stack.length && stack[stack.length - 1].at === line.trimEnd().length - 1 && /[[{]/.test(stack[stack.length - 1].ch)) stack.pop()
  if (!stack.length && inQuote === -1) return null
  const fromIdx = stack.length ? stack[0].at : inQuote
  const rest = line.slice(fromIdx)
  const arrow = rest.search(/\s+(-->|---|-\.->|==>|-\.-|<-->|&)\s*/)
  const insertAt = arrow > 0 ? fromIdx + arrow : line.trimEnd().length
  const closers = (inQuote !== -1 ? '"' : '') + stack.map((s) => OPENERS[s.ch]).reverse().join('')
  return line.slice(0, insertAt) + closers + line.slice(insertAt)
}

// ── free text vs. syntax ────────────────────────────────────────────────────

const LINK_AT = /<?(?:--+[-xo>]|==+[=xo>]|-?\.+-[xo>]?|~~~+)/y
const START_LINK_AT = /<?(?:--|==|-\.)/y
// edge text runs to the next link; a typographic arrow counts too, so it can still be repaired
const LINK_END = /<?(?:--+[-xo>]|==+[=xo>]|-?\.+-[xo>]?|~~~+)|[—–―‐‑]+>|[→⟶➔➜➝➞⇢⇒⟹↔⟷]/g
const TITLE_LINE = /^\s*(?:title|section|acc(?:Title|Descr)\s*:)/
const SEQ_BLOCK_LINE = /^\s*(?:loop|alt|else|opt|par_over|par|and|critical|option|break|rect|box)\b/
const COLON_FAMILIES = new Set<DiagramFamily>(['sequence', 'class', 'state', 'er'])

function matchLength(re: RegExp, s: string, i: number): number {
  re.lastIndex = i
  return re.exec(s)?.[0].length ?? 0
}

/** index of the closer matching the opener at `i` (quotes skipped), -1 when it stays open */
function shapeEnd(line: string, i: number): number {
  const open = line[i]
  let depth = 0
  for (let k = i; k < line.length; k++) {
    if (line[k] === '"') {
      k = line.indexOf('"', k + 1)
      if (k === -1) return -1
    } else if (line[k] === open) depth++
    else if (line[k] === OPENERS[open] && --depth === 0) return k
  }
  return -1
}

type Mark = (from: number, to: number) => void

function maskFlowLine(line: string, mark: Mark, state: { inString: boolean; inAcc: boolean }) {
  let i = 0
  if (state.inString) {
    const q = line.indexOf('"')
    if (q === -1) return mark(0, line.length)
    mark(0, q + 1)
    i = q + 1
    state.inString = false
  } else if (state.inAcc) {
    const c = line.indexOf('}')
    if (c === -1) return mark(0, line.length)
    mark(0, c)
    i = c + 1
    state.inAcc = false
  } else {
    const acc = line.match(/^\s*acc(?:Title|Descr)\s*([:{])/)
    if (acc) {
      const close = acc[1] === '{' ? line.indexOf('}', acc[0].length) : -1
      state.inAcc = acc[1] === '{' && close === -1
      return mark(acc[0].length, close === -1 ? line.length : close)
    }
  }
  while (i < line.length) {
    const ch = line[i]
    if (line.startsWith('%%', i)) return mark(i, line.length)
    if (ch === '"') {
      const q = line.indexOf('"', i + 1)
      if (q === -1) {
        state.inString = true
        return mark(i, line.length)
      }
      mark(i, q + 1)
      i = q + 1
      continue
    }
    const pipe = ch === '|' ? line.indexOf('|', i + 1) : -1
    const shape = OPENERS[ch] ? shapeEnd(line, i) : -1
    if (pipe !== -1 || shape !== -1) {
      const close = pipe !== -1 ? pipe : shape
      mark(i + 1, close)
      i = close + 1
      continue
    }
    const link = matchLength(LINK_AT, line, i)
    if (link) {
      i += link
      continue
    }
    const start = matchLength(START_LINK_AT, line, i)
    if (start) {
      LINK_END.lastIndex = i + start
      const end = LINK_END.exec(line)?.index ?? line.length
      mark(i + start, end)
      i = end
      continue
    }
    i++
  }
}

function maskLine(line: string, family: DiagramFamily, mark: Mark) {
  const labelled = (family === 'sequence' && line.match(SEQ_BLOCK_LINE)) || line.match(TITLE_LINE)
  if (labelled) return mark(labelled[0].length, line.length)
  for (let i = 0; i < line.length; i++) {
    if (line.startsWith('%%', i)) return mark(i, line.length)
    if (line[i] === '"') {
      const q = line.indexOf('"', i + 1)
      if (q === -1) return mark(i, line.length)
      mark(i, q + 1)
      i = q
    } else if (COLON_FAMILIES.has(family) && /[:：]/.test(line[i]) && line[i - 1] !== ':' && line[i + 1] !== ':') {
      return mark(i + 1, line.length)
    }
  }
}

/**
 * Marks with 1 the characters rules must leave alone: frontmatter, directives, comments,
 * strings, labels, edge text, and message/label text after `:`. Everything else is syntax.
 */
export function textMask(code: string, family: DiagramFamily): Uint8Array {
  const mask = new Uint8Array(code.length)
  const body = new Set(buildLineMap(code).toOriginal)
  for (const m of code.matchAll(DIRECTIVE_RE)) mask.fill(1, m.index, m.index + m[0].length)
  const state = { inString: false, inAcc: false }
  let start = 0
  splitLines(code).forEach((line, n) => {
    const mark: Mark = (from, to) => mask.fill(1, start + from, start + to)
    if (!body.has(n)) mark(0, line.length)
    else if (family === 'flowchart') maskFlowLine(line, mark, state)
    else maskLine(line, family, mark)
    start += line.length + 1
  })
  return mask
}

/** Applies fn to each run of syntax characters, keeping masked text verbatim */
export function mapSyntax(code: string, mask: Uint8Array, fn: (segment: string) => string): string {
  let out = ''
  for (let i = 0; i < code.length; ) {
    let j = i
    while (j < code.length && mask[j] === mask[i]) j++
    out += mask[i] ? code.slice(i, j) : fn(code.slice(i, j))
    i = j
  }
  return out
}

/** the code with every masked character (except newlines) replaced by \u0001, so syntax can be searched by index */
export function blankText(code: string, mask: Uint8Array): string {
  let out = ''
  for (let i = 0; i < code.length; i++) out += mask[i] && code[i] !== '\n' ? '\u0001' : code[i]
  return out
}

const isIdChar = (c: string | undefined) => c !== undefined && ID_CHAR.test(c)

/**
 * Where `word` occurs as a whole identifier; with `dashed`, `back-end` counts as one id, not `end`.
 * A scan rather than a lookbehind regex, which Safari < 16.4 rejects.
 */
function wordIndexes(text: string, word: string, dashed = false): number[] {
  const out: number[] = []
  for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + word.length)) {
    const end = i + word.length
    const before = dashed && text[i - 1] === '-' ? text[i - 2] : text[i - 1]
    const after = dashed && text[end] === '-' ? text[end + 1] : text[end]
    if (!isIdChar(before) && !isIdChar(after)) out.push(i)
  }
  return out
}

/** `base`, or `base_`, `base__`, … whichever is not already a word of the diagram's syntax */
export function freshId(blank: string, base: string): string {
  let id = base
  while (wordIndexes(blank, id).length) id += '_'
  return id
}

// ── flowchart node references ───────────────────────────────────────────────

const NOT_A_STATEMENT = /^\s*(?:subgraph\b|end\s*;?\s*\u0001*$)/
const NODE_SEP = /\s*(?:<?(?:--|==|-\.)\s*\u0001+\s*)?(?:<?--+[-xo>]|<?==+[=xo>]|<?-?\.+-[xo>]?|~~~+)\s*(?:\|\u0001*\|)?\s*|\s*[&;]\s*/g

/** The node ids of a blanked flowchart statement line, without their shapes, with the index each starts at */
export function flowNodeIds(blankLine: string): Array<{ id: string; at: number; shaped: boolean }> {
  const out: Array<{ id: string; at: number; shaped: boolean }> = []
  let from = 0
  const take = (to: number) => {
    const part = blankLine.slice(from, to)
    const id = part.replace(/(?:[[({>]|:::|@\{)[\s\S]*$/, '')
    if (id.trim()) out.push({ id: id.trim(), at: from + id.length - id.trimStart().length, shaped: id.length < part.length })
  }
  for (const m of blankLine.matchAll(NODE_SEP)) {
    take(m.index)
    from = m.index + m[0].length
  }
  take(blankLine.length)
  return out
}

/**
 * Renames the identifier `from` → `to` wherever flowchart syntax uses it (node ids, class names), leaving
 * labels, edge text, titles, frontmatter and subgraph lines alone. `back-end` is one id, not `end`.
 */
export function renameFlowNode(code: string, from: string, to: string): string {
  const blank = splitLines(blankText(code, textMask(code, 'flowchart')))
  return splitLines(code)
    .map((line, n) => {
      if (NOT_A_STATEMENT.test(blank[n])) return line
      let out = line
      for (const at of wordIndexes(blank[n], from, true).reverse()) out = out.slice(0, at) + to + out.slice(at + from.length)
      return out
    })
    .join('\n')
}

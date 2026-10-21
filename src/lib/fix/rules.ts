import type { Diagnostic } from '../diagnose'
import {
  DIAGRAM_KEYWORDS,
  type DiagramFamily,
  blankText,
  closeOpenBrackets,
  closestKeyword,
  familyOf,
  flowNodeIds,
  freshId,
  header,
  mapOutsideLabels,
  mapSyntax,
  quoteLabelsInLine,
  renameFlowNode,
  replaceLine,
  splitLines,
  textMask,
} from './text'

export interface FixMessage {
  key: string
  params?: Record<string, string>
}

export interface Candidate {
  code: string
  /** 1-based line the change is about */
  line?: number
  msg: FixMessage
  /** keeps the diagram rendering but drops content — offered last, flagged in the UI */
  lossy?: boolean
}

export interface RuleContext {
  code: string
  diag: Diagnostic
  family: DiagramFamily
  lines: string[]
  /** 0-based index of the error line */
  at: number
}

export interface Rule {
  id: string
  propose(ctx: RuleContext): Candidate[]
}

const one = (c: Candidate | null | undefined): Candidate[] => (c && c.code ? [c] : [])

/** lines worth trying for a problem reported at `at`: the line itself, then earlier non-empty lines */
function nearbyLines(ctx: RuleContext, back = 3): number[] {
  const out = [ctx.at]
  for (let i = ctx.at - 1; i >= 0 && out.length <= back; i--) if (ctx.lines[i].trim()) out.push(i)
  return out
}

// ── whole-document clean-ups ────────────────────────────────────────────────

const FENCE_LINE = /^\s*```+\s*([\w-]*)/

const stripFences: Rule = {
  id: 'fences',
  propose({ code }) {
    const lines = splitLines(code)
    if (!lines.some((l) => FENCE_LINE.test(l))) return []
    const blocks: Array<{ lang: string; body: string[] }> = []
    let open: { lang: string; body: string[] } | null = null
    for (const line of lines) {
      const fence = line.match(FENCE_LINE)
      if (!fence) open?.body.push(line)
      else if (open) {
        blocks.push(open)
        open = null
      } else open = { lang: fence[1].toLowerCase(), body: [] }
    }
    if (open) blocks.push(open)
    const [first, ...rest] = blocks.filter((b) => ['', 'mermaid', 'mmd'].includes(b.lang))
    if (!first) return one({ code: lines.filter((l) => !FENCE_LINE.test(l)).join('\n'), msg: { key: 'fix.fences' } })
    if (!rest.length) return one({ code: first.body.join('\n'), msg: { key: 'fix.fences' } })
    // only one diagram can render: keep the others as comments rather than dropping them unflagged
    const others = rest.flatMap((b) => ['', ...b.body.map((l) => `%% ${l.replace(/%%\{/g, '%% {')}`)])
    return one({ code: [...first.body, ...others].join('\n'), msg: { key: 'fix.fencesExtra' }, lossy: true })
  },
}

const INVISIBLE = /[​-‍⁠﻿­]/g
const ODD_SPACES = /[   　 -  - ]/g

const invisibleChars: Rule = {
  id: 'invisible',
  propose({ code }) {
    const next = code.replace(/\r\n?/g, '\n').replace(INVISIBLE, '').replace(ODD_SPACES, ' ').replace(/\t/g, '    ')
    return next === code ? [] : [{ code: next, msg: { key: 'fix.invisible' } }]
  },
}

const TYPOGRAPHY: Array<(s: string, family: DiagramFamily) => string> = [
  (s, family) => {
    const seq = family === 'sequence'
    return s
      .replace(/<[—–―‐‑]+>/g, seq ? '<<->>' : '<-->')
      .replace(/[—–―‐‑]+>>?/g, seq ? '->>' : '-->')
      .replace(/[→⟶➔➜➝➞⇢]/g, seq ? '->>' : '-->')
      .replace(/[⇒⟹]/g, seq ? '->>' : '==>')
      .replace(/[↔⟷]/g, seq ? '<<->>' : '<-->')
  },
  (s) => s.replace(/[“”„‟″]/g, '"').replace(/[‘’‚‛′]/g, "'"),
  (s) => s.replace(/：/g, ':').replace(/；/g, ';'),
]

// labels, strings and comments keep their characters; arrows, quotes and punctuation are separate
// candidates so the parser can accept just the part that helps
const typography: Rule = {
  id: 'typography',
  propose({ code, family }) {
    const mask = textMask(code, family)
    const all = mapSyntax(code, mask, (s) => TYPOGRAPHY.reduce((acc, fn) => fn(acc, family), s))
    const each = TYPOGRAPHY.map((fn) => mapSyntax(code, mask, (s) => fn(s, family)))
    return [...new Set([all, ...each])].filter((next) => next !== code).map((next) => ({ code: next, msg: { key: 'fix.typography' } }))
  },
}

const htmlEntities: Rule = {
  id: 'entities',
  propose({ code }) {
    if (!/&(gt|lt|amp|quot|#39|nbsp);/.test(code)) return []
    const next = code
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
    return [{ code: next, msg: { key: 'fix.entities' } }]
  },
}

const foreignComments: Rule = {
  id: 'comments',
  propose({ code, family }) {
    if (!/^\s*(\/\/|#\s)/m.test(code)) return []
    const mask = textMask(code, family)
    let start = 0
    // a `# heading` inside a multi-line markdown label is text, not a comment
    const next = splitLines(code)
      .map((line) => {
        const at = start + line.length - line.trimStart().length
        start += line.length + 1
        return mask[at] ? line : line.replace(/^(\s*)(?:\/\/+|#)\s?(.*)$/, (_, ws, rest) => `${ws}%% ${rest}`)
      })
      .join('\n')
    return next === code ? [] : [{ code: next, msg: { key: 'fix.comments' } }]
  },
}

// ── diagram header ──────────────────────────────────────────────────────────

function inferFamily(code: string): string {
  if (/->>|-->>|^\s*(participant|actor)\s/m.test(code)) return 'sequenceDiagram'
  if (/[|}][|o]--[|o{]|[|}][|o]\.\.[|o{]/.test(code)) return 'erDiagram'
  if (/\[\*\]/.test(code)) return 'stateDiagram-v2'
  if (/<\|--|\*--|o--|^\s*class\s+\w+\s*\{/m.test(code)) return 'classDiagram'
  if (/^\s*(commit|branch|checkout)\b/m.test(code)) return 'gitGraph'
  if (/^\s*"[^"]+"\s*:\s*\d/m.test(code)) return 'pie'
  if (/^\s*section\s/m.test(code) && /\d{4}-\d{2}-\d{2}/.test(code)) return 'gantt'
  return 'flowchart TD'
}

// mermaid detects headers by prefix, so `graphTD` or `sequenceDiagramm` fail as parse errors, not unknown diagrams
const diagramHeader: Rule = {
  id: 'header',
  propose({ code, diag }) {
    const head = header(code)
    if (!head) return []
    const out: Candidate[] = []
    const glued = head.word.match(/^(graph|flowchart)(TD|TB|BT|LR|RL)$/i)
    const guess = glued ? `${glued[1].toLowerCase()} ${glued[2].toUpperCase()}` : closestKeyword(head.word, DIAGRAM_KEYWORDS)
    if (guess) {
      const lines = splitLines(code)
      lines[head.line] = lines[head.line].replace(head.word, guess)
      out.push({ code: lines.join('\n'), line: head.line + 1, msg: { key: 'fix.headerTypo', params: { from: head.word, to: guess } } })
    }
    // the type was detected, so the first line is a header: another one above it would turn it into a node
    if (diag.kind !== 'unknown-diagram') return out
    const inferred = inferFamily(code)
    const lines = splitLines(code)
    lines.splice(head.line, 0, inferred)
    out.push({ code: lines.join('\n'), line: head.line + 1, msg: { key: 'fix.headerMissing', params: { type: inferred } } })
    return out
  },
}

const DIRECTIONS: Record<string, string> = {
  TD: 'TD', TB: 'TB', BT: 'BT', LR: 'LR', RL: 'RL',
  TOP: 'TD', DOWN: 'TD', TOPDOWN: 'TD', 'TOP-DOWN': 'TD', VERTICAL: 'TD', V: 'TD',
  UP: 'BT', BOTTOM: 'BT', 'BOTTOM-UP': 'BT',
  LEFT: 'LR', RIGHT: 'LR', HORIZONTAL: 'LR', H: 'LR', 'LEFT-RIGHT': 'LR', 'RIGHT-LEFT': 'RL',
}

const flowDirection: Rule = {
  id: 'direction',
  propose({ code, family }) {
    if (family !== 'flowchart') return []
    const head = header(code)
    if (!head) return []
    const m = head.text.match(/^(\s*)(flowchart|graph)(\s+)(\S+)(.*)$/)
    if (!m) return []
    const dir = m[4]
    const mapped = DIRECTIONS[dir.toUpperCase()]
    if (!mapped || mapped === dir) {
      if (mapped) return []
      const lines = splitLines(code)
      lines[head.line] = lines[head.line].replace(/^(\s*)(flowchart|graph)\s+\S+/, '$1flowchart TD')
      return [{ code: lines.join('\n'), line: head.line + 1, msg: { key: 'fix.direction', params: { from: dir, to: 'TD' } } }]
    }
    const lines = splitLines(code)
    lines[head.line] = lines[head.line].replace(/^(\s*)(flowchart|graph)(\s+)\S+/, `$1$2$3${mapped}`)
    return [{ code: lines.join('\n'), line: head.line + 1, msg: { key: 'fix.direction', params: { from: dir, to: mapped } } }]
  },
}

// ── flowchart ───────────────────────────────────────────────────────────────

/**
 * Body lines with where their syntax starts: past frontmatter, comments and the part of a
 * multi-line string that a line may begin inside of. Lines that are text throughout are left out.
 */
function syntaxLines(ctx: RuleContext): Array<{ i: number; from: number }> {
  const mask = textMask(ctx.code, ctx.family)
  const head = header(ctx.code)?.line
  const out: Array<{ i: number; from: number }> = []
  let start = 0
  ctx.lines.forEach((line, i) => {
    let from = 0
    while (from < line.length && mask[start + from]) from++
    if (i !== head && line.slice(from).trim()) out.push({ i, from })
    start += line.length + 1
  })
  return out
}

const quoteLabels: Rule = {
  id: 'quote-labels',
  propose(ctx) {
    if (ctx.family !== 'flowchart' && ctx.family !== 'mindmap') return []
    const starts = new Map(syntaxLines(ctx).map(({ i, from }) => [i, from]))
    const quote = (i: number) => {
      const from = starts.get(i)
      return from === undefined ? ctx.lines[i] : ctx.lines[i].slice(0, from) + quoteLabelsInLine(ctx.lines[i].slice(from))
    }
    const out: Candidate[] = []
    // LLM output often has a dozen such labels; one candidate for all of them keeps maxSteps for the rest
    const all = ctx.lines.map((_, i) => quote(i))
    const first = all.findIndex((l, i) => l !== ctx.lines[i])
    if (first !== -1) out.push({ code: all.join('\n'), line: first + 1, msg: { key: 'fix.quoteLabel' } })
    for (const i of nearbyLines(ctx, 1)) {
      const fixed = quote(i)
      if (fixed !== ctx.lines[i]) out.push({ code: replaceLine(ctx.code, i, fixed), line: i + 1, msg: { key: 'fix.quoteLabel' } })
    }
    return out
  },
}

const subgraphTitle: Rule = {
  id: 'subgraph-title',
  propose(ctx) {
    if (ctx.family !== 'flowchart') return []
    const out: Candidate[] = []
    // `subgraph Back end` ends the block right there, so the parser only complains on the next line
    for (const i of nearbyLines(ctx, 1)) {
      const m = ctx.lines[i].match(/^(\s*subgraph\s+)(.+?)\s*$/)
      if (!m || /^[\p{L}\p{N}_-]+$/u.test(m[2]) || /^\S+\s*\[.*\]$/.test(m[2]) || /^".*"$/.test(m[2])) continue
      const title = m[2].replace(/"/g, '#quot;')
      const id = m[2].replace(/[^\p{L}\p{N}_]+/gu, '_').replace(/^_+|_+$/g, '') || 'group'
      out.push({ code: replaceLine(ctx.code, i, `${m[1]}${id}["${title}"]`), line: i + 1, msg: { key: 'fix.subgraphTitle' } })
    }
    return out
  },
}

function fixArrowSegment(seg: string, family: DiagramFamily): string {
  let s = seg
  if (family === 'flowchart') {
    s = s
      .replace(/<->/g, '<-->')
      .replace(/(^|[^-.=<])\.\.>/g, '$1-.->')
      .replace(/(^|[^-])-\.>/g, '$1-.->')
      .replace(/(^|[^=])=>/g, '$1==>')
      .replace(/(^|[^-.=<>])->(?!>)/g, '$1-->')
      .replace(/(^|[^-<])<-(?![-.])/g, '$1<--')
  } else if (family === 'state') {
    s = s.replace(/(^|[^-])->/g, '$1-->').replace(/=>/g, '-->')
  } else if (family === 'class') {
    s = s
      .replace(/<\|(?![-.])/g, '<|--')
      .replace(/(^|[^-.])->/g, '$1-->')
      .replace(/(^|[^.])\.>/g, '$1..>')
  } else if (family === 'sequence') {
    s = s.replace(/=>>?/g, '->>').replace(/(^|[^-<])>>/g, '$1->>')
  }
  return s
}

/** index of the first `:` that is not part of `:::` (what follows is message or label text), or -1 */
function labelColon(line: string): number {
  // a scan instead of a lookbehind regex: Safari < 16.4 cannot even parse one, and this module loads eagerly
  for (let i = 0; i < line.length; i++) if (line[i] === ':' && line[i - 1] !== ':' && line[i + 1] !== ':') return i
  return -1
}

const arrows: Rule = {
  id: 'arrows',
  propose(ctx) {
    if (!['flowchart', 'state', 'class', 'sequence'].includes(ctx.family)) return []
    const fix = (s: string) => (ctx.family === 'sequence' ? fixArrowSegment(s, ctx.family) : mapOutsideLabels(s, (seg) => fixArrowSegment(seg, ctx.family)))
    const out: Candidate[] = []
    for (const i of nearbyLines(ctx, 1)) {
      const line = ctx.lines[i]
      const colon = ctx.family === 'flowchart' ? -1 : labelColon(line)
      const fixed = colon === -1 ? fix(line) : fix(line.slice(0, colon)) + line.slice(colon)
      if (fixed !== line) out.push({ code: replaceLine(ctx.code, i, fixed), line: i + 1, msg: { key: 'fix.arrow' } })
    }
    return out
  },
}

const reservedEnd: Rule = {
  id: 'reserved-end',
  propose(ctx) {
    if (ctx.family !== 'flowchart') return []
    if (ctx.diag.foundToken !== 'end' && !/\bend\b/.test(ctx.lines[ctx.at])) return []
    const id = freshId(blankText(ctx.code, textMask(ctx.code, 'flowchart')), 'End')
    const next = renameFlowNode(ctx.code, 'end', id)
    if (next === ctx.code) return []
    return [{ code: next, line: ctx.at + 1, msg: id === 'End' ? { key: 'fix.reservedEnd' } : { key: 'fix.reservedEndTo', params: { to: id } } }]
  },
}

const STATEMENT = /^\s*(subgraph|style|classDef|class|click|linkStyle|direction)\b/
const SPACED = /^[\p{L}\p{N}_]+(?:\s+[\p{L}\p{N}_]+)+$/u
/** statements whose leading ids name nodes: `style My Node fill:…`, `class My Node,B hot`, `click My Node cb` */
const NODE_REFERENCE = /^\s*(?:style|class|click)\s+/

/** renames `phrase` where it stands as a whole id in a style/class/click statement */
function renameReference(line: string, blankLine: string, phrase: string, id: string): string {
  const start = blankLine.match(NODE_REFERENCE)?.[0].length
  if (start === undefined) return line
  const boundary = (c: string | undefined) => c === undefined || c === ',' || /\s/.test(c)
  let out = line
  for (let at = blankLine.lastIndexOf(phrase); at >= start; at = at > 0 ? blankLine.lastIndexOf(phrase, at - 1) : -1) {
    if (boundary(blankLine[at - 1]) && boundary(blankLine[at + phrase.length])) out = out.slice(0, at) + id + out.slice(at + phrase.length)
  }
  return out
}

const spacedIds: Rule = {
  id: 'spaced-ids',
  propose(ctx) {
    if (ctx.family !== 'flowchart') return []
    if (!ctx.diag.expected.includes('LINK') && !ctx.diag.expected.includes('START_LINK')) return []
    const code = blankText(ctx.code, textMask(ctx.code, 'flowchart'))
    const blank = splitLines(code)
    const head = header(ctx.code)?.line
    const statement = (i: number) => i !== head && !STATEMENT.test(blank[i])
    if (!statement(ctx.at)) return []
    const phrase = flowNodeIds(blank[ctx.at]).find((n) => SPACED.test(n.id))?.id
    if (!phrase) return []
    const id = freshId(code, phrase.replace(/\s+/g, '_'))
    // only whole node ids are renamed, never edge text or a longer name that contains the phrase
    let labelled = false
    const lines = ctx.lines.map((line, i) => {
      if (i === head) return line
      if (!statement(i)) return renameReference(line, blank[i], phrase, id)
      const hits = flowNodeIds(blank[i]).filter((n) => n.id === phrase)
      const parts = hits.map((n) => {
        const text = labelled || n.shaped ? id : `${id}["${phrase}"]`
        labelled = true
        return { ...n, text }
      })
      return parts.reduceRight((out, n) => out.slice(0, n.at) + n.text + out.slice(n.at + phrase.length), line)
    })
    return [{ code: lines.join('\n'), line: ctx.at + 1, msg: { key: 'fix.spacedId', params: { phrase, id } } }]
  },
}

// ── structural: unclosed things ─────────────────────────────────────────────

const unclosedBrackets: Rule = {
  id: 'unclosed',
  propose(ctx) {
    const out: Candidate[] = []
    for (const i of nearbyLines(ctx, 2)) {
      const fixed = closeOpenBrackets(ctx.lines[i])
      if (fixed && fixed !== ctx.lines[i]) out.push({ code: replaceLine(ctx.code, i, fixed), line: i + 1, msg: { key: 'fix.unclosed' } })
    }
    return out
  },
}

const END_OPENERS: Partial<Record<DiagramFamily, RegExp>> = {
  flowchart: /^\s*subgraph\b/,
  sequence: /^\s*(loop|alt|opt|par|par_over|rect|critical|break|box)\b/,
}
const END_LINE = /^\s*end\s*;?\s*(%%.*)?$/
/** `else` sits at its `alt`'s indentation without ending the block */
const CONTINUES = /^\s*(else|and|option)\b/
/** lines that end a `{` block without a closing `}` of their own: class members, ER attributes */
const BODY_STOPS: Partial<Record<DiagramFamily, RegExp>> = {
  class: /^\s*$|--|\.\.|^\s*(class|note|namespace)\b/,
  er: /[|}o][|o](?:--|\.\.)[|o][|{]|\{\s*$/,
}

const indentOf = (line: string) => line.match(/^\s*/)?.[0] ?? ''

/** lines opening a block that is still open before line `upTo`, innermost last; no opener means `{ … }` blocks */
function openBlocks(lines: string[], opener: RegExp | undefined, upTo = lines.length): number[] {
  const stack: number[] = []
  for (let i = 0; i < upTo; i++) {
    const line = lines[i]
    if (/^\s*%%/.test(line)) continue
    if (opener ? opener.test(line) : /\{\s*$/.test(line)) stack.push(i)
    else if (opener ? END_LINE.test(line) : /^\s*\}/.test(line)) stack.pop()
  }
  return stack
}

/**
 * Where the block opened at `open` ends: at the first `stop` line, or before the first later line
 * indented no deeper than the opener. Indentation only counts when the body is indented at all,
 * since flat LLM output would otherwise close every block right after its opener.
 */
function closeAt(lines: string[], open: number, stop?: RegExp): number {
  const indent = indentOf(lines[open]).length
  const body = lines.findIndex((l, i) => i > open && l.trim())
  const nested = body !== -1 && indentOf(lines[body]).length > indent
  let end = lines.length
  for (let i = open + 1; i < lines.length; i++) {
    const outdented = nested && lines[i].trim() && !CONTINUES.test(lines[i]) && indentOf(lines[i]).length <= indent
    if (outdented || stop?.test(lines[i])) {
      end = i
      break
    }
  }
  while (end > open + 1 && !lines[end - 1].trim()) end--
  return end
}

const missingEnd: Rule = {
  id: 'missing-end',
  propose(ctx) {
    const { diag, family, lines } = ctx
    const brace = diag.expected.includes('STRUCT_STOP') || diag.expected.includes('BLOCK_STOP')
    const closer = brace ? '}' : 'end'
    const msg = { key: 'fix.missingEnd', params: { closer } }
    // a class body or ER entity left open runs into the next block or relation
    if (!diag.atEnd && (family === 'class' || family === 'er')) {
      const open = openBlocks(lines, undefined, ctx.at).at(-1)
      const at = open === undefined ? -1 : closeAt(lines, open, BODY_STOPS[family])
      if (open === undefined || at > ctx.at) return []
      const next = [...lines]
      next.splice(at, 0, `${indentOf(lines[open])}}`)
      return [{ code: next.join('\n'), line: at + 1, msg: { key: 'fix.missingEnd', params: { closer: '}' } } }]
    }
    if (!diag.atEnd || !(brace || diag.expected.includes('end'))) return []
    const opener = brace ? undefined : END_OPENERS[family]
    const open = brace || opener ? openBlocks(lines, opener) : []
    if (!open.length) {
      const trimmed = ctx.code.replace(/\s+$/, '')
      return [{ code: `${trimmed}\n${closer}\n`, line: splitLines(trimmed).length + 1, msg }]
    }
    // close every open block in one go; later positions first, and at the same position the outer
    // closer goes in first so that the inner one ends up above it
    const closes = open.map((i) => ({ text: `${indentOf(lines[i])}${closer}`, at: closeAt(lines, i, brace ? BODY_STOPS[family] : undefined) }))
    const next = [...lines]
    for (const c of [...closes].sort((a, b) => b.at - a.at)) next.splice(c.at, 0, c.text)
    return [{ code: next.join('\n'), line: Math.min(...closes.map((c) => c.at)) + 1, msg }]
  },
}

// ── missing separators ─────────────────────────────────────────────────────

const SEQ_ARROW = /(<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\))/

const missingColon: Rule = {
  id: 'missing-colon',
  propose(ctx) {
    const { diag, family, lines, at } = ctx
    const out: Candidate[] = []
    const line = lines[at]
    if (family === 'sequence' && diag.expected.includes('TXT')) {
      const m = line.match(new RegExp(`^(\\s*\\S+?\\s*${SEQ_ARROW.source}\\s*[+-]?[^\\s:]+)(?:\\s+(.*))?$`))
      if (m) out.push({ code: replaceLine(ctx.code, at, `${m[1]}: ${m[3] ?? ''}`), line: at + 1, msg: { key: 'fix.seqColon' } })
    }
    if (family === 'er' && diag.expected.includes('COLON')) {
      out.push({ code: replaceLine(ctx.code, at, `${line.trimEnd()} : ""`), line: at + 1, msg: { key: 'fix.erLabel' } })
    }
    if ((family === 'gantt' || family === 'journey' || family === 'timeline') && diag.expected.includes('taskData')) {
      if (family === 'gantt') {
        const m = line.match(/^(\s*.+?)\s+((?:crit|done|active|milestone|after\s|\d{4}-\d{2}-\d{2}|[a-z]\w*\d*\s*,).*)$/)
        if (m) out.push({ code: replaceLine(ctx.code, at, `${m[1]} : ${m[2]}`), line: at + 1, msg: { key: 'fix.taskColon' } })
        else out.push({ code: replaceLine(ctx.code, at, `${line.trimEnd()} : 1d`), line: at + 1, msg: { key: 'fix.taskColon' } })
      } else if (family === 'journey') {
        out.push({ code: replaceLine(ctx.code, at, `${line.trimEnd()}: 3`), line: at + 1, msg: { key: 'fix.journeyScore' } })
      }
    }
    if (family === 'quadrant' && diag.foundToken === 'COLON') {
      const m = line.match(/^(\s*[^:]+:\s*)([\d.]+)\s*,\s*([\d.]+)\s*$/)
      if (m) out.push({ code: replaceLine(ctx.code, at, `${m[1]}[${m[2]}, ${m[3]}]`), line: at + 1, msg: { key: 'fix.quadrantPoint' } })
    }
    return out
  },
}

/** Langium parsers say exactly which punctuation they wanted: insert it */
const PUNCT = new Set([':', ',', ']', '}', ')', '[', '{', '('])

const insertExpected: Rule = {
  id: 'insert-expected',
  propose(ctx) {
    const { diag, lines, at } = ctx
    const want = diag.expected.length === 1 ? diag.expected[0] : null
    if (!want || !PUNCT.has(want) || diag.atEnd) return []
    const line = lines[at]
    const col = Math.min(diag.column, line.length)
    const before = line.slice(0, col).replace(/\s+$/, '')
    const after = line.slice(col)
    const glue = want === ':' || want === ',' ? `${want} ` : want
    return [{ code: replaceLine(ctx.code, at, `${before}${glue}${after.replace(/^\s+/, '')}`), line: at + 1, msg: { key: 'fix.insertToken', params: { token: want } } }]
  },
}

// ── small grammar slips ────────────────────────────────────────────────────

/** `;` ends a sequence statement even inside message text: `Hello; how are you?` */
const seqSemicolon: Rule = {
  id: 'seq-semicolon',
  propose(ctx) {
    if (ctx.family !== 'sequence') return []
    const out: Candidate[] = []
    for (const i of nearbyLines(ctx, 1)) {
      const line = ctx.lines[i]
      const colon = line.indexOf(':')
      if (colon === -1 || /^\s*%%/.test(line) || !line.includes(';', colon)) continue
      const text = line.slice(colon).replace(/(#\w+;)|;/g, (_, entity) => entity ?? '#59;')
      out.push({ code: replaceLine(ctx.code, i, line.slice(0, colon) + text), line: i + 1, msg: { key: 'fix.seqSemicolon' } })
    }
    return out
  },
}

/** `Note right Alice` → `Note right of Alice` */
const noteSide: Rule = {
  id: 'note-side',
  propose(ctx) {
    if (ctx.family !== 'sequence' && ctx.family !== 'state') return []
    const line = ctx.lines[ctx.at]
    const fixed = line.replace(/^(\s*note\s+(?:left|right))\s+(?!of\b)/i, '$1 of ')
    return fixed === line ? [] : [{ code: replaceLine(ctx.code, ctx.at, fixed), line: ctx.at + 1, msg: { key: 'fix.insertToken', params: { token: 'of' } } }]
  },
}

const GENERIC = /([\p{L}\p{N}_])<([\p{L}\p{N}_ ,~]+)>/u

/** class diagrams write generics as `Box~T~`; members inside `{ }` and label text keep `<T>` */
const classGenerics: Rule = {
  id: 'class-generics',
  propose(ctx) {
    if (ctx.family !== 'class') return []
    let depth = 0
    let first = -1
    const lines = ctx.lines.map((line, i) => {
      const inBody = depth > 0
      if (/\{\s*$/.test(line)) depth++
      else if (/^\s*\}/.test(line)) depth = Math.max(0, depth - 1)
      const colon = labelColon(line)
      let head = colon === -1 ? line : line.slice(0, colon)
      if (inBody || !GENERIC.test(head)) return line
      while (GENERIC.test(head)) head = head.replace(GENERIC, '$1~$2~')
      if (first === -1) first = i
      return head + (colon === -1 ? '' : line.slice(colon))
    })
    return first === -1 ? [] : [{ code: lines.join('\n'), line: first + 1, msg: { key: 'fix.classGeneric' } }]
  },
}

// ── keyword typos ──────────────────────────────────────────────────────────

const KEYWORDS: Partial<Record<DiagramFamily, string[]>> = {
  flowchart: ['subgraph', 'end', 'style', 'classDef', 'class', 'click', 'linkStyle', 'direction'],
  sequence: ['participant', 'actor', 'loop', 'alt', 'else', 'opt', 'par', 'and', 'rect', 'end', 'Note', 'activate', 'deactivate', 'autonumber', 'critical', 'break', 'box', 'create', 'destroy', 'title', 'option'],
  class: ['class', 'classDef', 'namespace', 'note', 'direction', 'style', 'cssClass', 'click', 'callback', 'link'],
  state: ['state', 'note', 'direction', 'classDef', 'class', 'style'],
  git: ['commit', 'branch', 'checkout', 'merge', 'cherry-pick', 'switch'],
  gantt: ['dateFormat', 'axisFormat', 'title', 'section', 'excludes', 'includes', 'todayMarker', 'tickInterval', 'weekday'],
  journey: ['title', 'section'],
  pie: ['title', 'showData'],
  timeline: ['title', 'section'],
  quadrant: ['title', 'x-axis', 'y-axis', 'quadrant-1', 'quadrant-2', 'quadrant-3', 'quadrant-4'],
  xy: ['title', 'x-axis', 'y-axis', 'bar', 'line'],
}

const keywordTypo: Rule = {
  id: 'keyword-typo',
  propose(ctx) {
    const words = KEYWORDS[ctx.family]
    if (!words) return []
    const out: Candidate[] = []
    for (const i of nearbyLines(ctx, 1)) {
      const m = ctx.lines[i].match(/^(\s*)([A-Za-z][\w-]*)/)
      if (!m) continue
      const guess = closestKeyword(m[2], words)
      if (!guess || (m[2].length <= 3 && guess.toLowerCase() !== m[2].toLowerCase())) continue
      out.push({
        code: replaceLine(ctx.code, i, ctx.lines[i].replace(m[2], guess)),
        line: i + 1,
        msg: { key: 'fix.keywordTypo', params: { from: m[2], to: guess } },
      })
    }
    return out
  },
}

// ── last resort ─────────────────────────────────────────────────────────────

const commentOut: Rule = {
  id: 'comment-out',
  propose(ctx) {
    const line = ctx.lines[ctx.at]
    if (!line.trim() || /^\s*%%/.test(line) || ctx.at === header(ctx.code)?.line) return []
    return [{ code: replaceLine(ctx.code, ctx.at, line.replace(/^(\s*)/, '$1%% ')), line: ctx.at + 1, msg: { key: 'fix.commentOut' }, lossy: true }]
  },
}

export const RULES: Rule[] = [
  stripFences,
  invisibleChars,
  typography,
  htmlEntities,
  foreignComments,
  diagramHeader,
  flowDirection,
  quoteLabels,
  subgraphTitle,
  reservedEnd,
  arrows,
  missingEnd,
  unclosedBrackets,
  missingColon,
  insertExpected,
  seqSemicolon,
  noteSide,
  classGenerics,
  keywordTypo,
  spacedIds,
]

export const LAST_RESORT: Rule[] = [commentOut]

export function contextFor(code: string, diag: Diagnostic): RuleContext {
  const lines = splitLines(code)
  return { code, diag, family: familyOf(code), lines, at: Math.min(Math.max(diag.line - 1, 0), lines.length - 1) }
}

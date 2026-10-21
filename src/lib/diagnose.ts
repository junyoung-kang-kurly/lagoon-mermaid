// Turns whatever mermaid.parse() throws into one normalized Diagnostic that points
// at a line/column of the *original* editor text.
//
// mermaid parses a cleaned copy of the code: CRLF normalized, frontmatter and
// %%{init}%% directives removed, every `%% comment` line deleted and leading blank
// lines trimmed. Parser line numbers refer to that copy, so we rebuild the same
// cleaning step with a line map.

export type DiagnosticKind = 'parse' | 'lexical' | 'unknown-diagram' | 'other'

export interface Diagnostic {
  kind: DiagnosticKind
  message: string
  /** 1-based line in the original text */
  line: number
  /** 0-based column in that line */
  column: number
  /** number of characters to highlight (>= 1) */
  length: number
  /** text of the offending token, '' at end of input or at a line break */
  found: string
  /** parser token name of the offending token ('EOF' at end of input) */
  foundToken?: string
  /** parser token names that would have been accepted */
  expected: string[]
  atEnd: boolean
}

interface LineMap {
  /** cleaned line index (0-based) → original line index (0-based) */
  toOriginal: number[]
  /** cleaned line index → original column of its first character */
  shift: number[]
  cleanedLines: string[]
}

/** mermaid's directiveRegex: a directive may span lines and its closing `}%%` is optional */
export const DIRECTIVE_RE = /%{2}{\s*(?:(\w+)\s*:|(\w+))\s*(?:(\w+)|((?:(?!}%{2}).|\r?\n)*))?\s*(?:}%{2})?/gi
const COMMENT_LINE_RE = /^\s*%%(?!\{).+$/
const WS = /\s/

/** mermaid's matchFrontMatter: length of a leading, possibly indented, `---` block plus the blank lines after it */
function frontmatterLength(text: string): number {
  let cursor = 0
  while (cursor < text.length && WS.test(text[cursor]) && text[cursor] !== '\n') cursor++
  if (!text.startsWith('---', cursor)) return 0
  const openingEnds: number[] = []
  for (let i = cursor + 3; i < text.length && WS.test(text[i]); i++) if (text[i] === '\n') openingEnds.push(i)
  if (!openingEnds.length) return 0
  const fence = `${text.slice(0, cursor)}---`
  const closingEnd = (i: number) => {
    if (text[i] !== '\n' || !text.startsWith(fence, i + 1)) return -1
    let last = -1
    for (let j = i + 1 + fence.length; j < text.length && WS.test(text[j]); j++) if (text[j] === '\n') last = j
    return last
  }
  let lastClosing = -1
  for (let i = openingEnds[0] + 1; i < text.length; i++) if (closingEnd(i) !== -1) lastClosing = i
  if (lastClosing === -1) return 0
  const openingEnd = openingEnds.filter((e) => e < lastClosing).at(-1) ?? openingEnds[0]
  for (let i = openingEnd + 1; i <= lastClosing; i++) {
    const end = closingEnd(i)
    if (end !== -1) return end + 1
  }
  return 0
}

export function buildLineMap(code: string): LineMap {
  const text = code.replace(/\r\n?/g, '\n')
  const keep = new Uint8Array(text.length).fill(1)
  const front = frontmatterLength(text)
  keep.fill(0, 0, front)
  for (const m of text.slice(front).matchAll(DIRECTIVE_RE)) keep.fill(0, front + m.index, front + m.index + m[0].length)

  // the kept characters, split into lines; a directive spanning lines joins its neighbours into one
  const rows: Array<{ text: string; orig: number; shift: number }> = []
  let row = { text: '', orig: -1, shift: 0 }
  let line = 0
  let lineStart = 0
  for (let i = 0; i <= text.length; i++) {
    const ch = text[i]
    if (i < text.length && !keep[i]) {
      if (ch === '\n') {
        line++
        lineStart = i + 1
      }
      continue
    }
    if (row.orig === -1) row = { text: '', orig: line, shift: i - lineStart }
    if (i < text.length && ch !== '\n') {
      row.text += ch
      continue
    }
    rows.push(row)
    row = { text: '', orig: -1, shift: 0 }
    line++
    lineStart = i + 1
  }

  // `^\s*%%...\n?` with the m flag also swallows the blank lines right before a comment
  const out: typeof rows = []
  for (const r of rows) {
    if (COMMENT_LINE_RE.test(r.text)) {
      while (out.length && out[out.length - 1].text.trim() === '') out.pop()
      continue
    }
    out.push(r)
  }
  while (out.length && out[0].text.trim() === '') out.shift()
  if (out.length) {
    const trimmed = out[0].text.trimStart()
    out[0] = { ...out[0], text: trimmed, shift: out[0].shift + out[0].text.length - trimmed.length }
  }
  return { toOriginal: out.map((r) => r.orig), shift: out.map((r) => r.shift), cleanedLines: out.map((r) => r.text) }
}

function toOriginalPosition(map: LineMap, cleanedLine0: number, column: number, originalLines: string[]) {
  if (!map.toOriginal.length) return { line: 1, column: 0 }
  const last = map.toOriginal.length - 1
  const clamped = Math.min(Math.max(cleanedLine0, 0), last)
  const origLine = map.toOriginal[clamped]
  const length = originalLines[origLine]?.length ?? 0
  const col = cleanedLine0 > last ? length : Math.min(column + map.shift[clamped], length)
  return { line: origLine + 1, column: Math.max(0, col) }
}

/** jison prints "<past>\n---^" excerpts; map the caret back to a cleaned-text offset */
function locateFromExcerpt(message: string, cleanedLines: string[]) {
  const rows = message.split('\n')
  const caretRow = rows.findIndex((r) => /^-*\^$/.test(r))
  if (caretRow < 1) return null
  const excerpt = rows[caretRow - 1]
  const caret = rows[caretRow].length - 1
  const pre = excerpt.slice(0, caret)
  const truncated = pre.startsWith('...')
  const past = truncated ? pre.slice(3) : pre
  const upcoming = excerpt.slice(caret).replace(/\.\.\.$/, '')

  const flat = cleanedLines.join('')
  const candidates: number[] = []
  if (!truncated) candidates.push(past.length)
  else {
    for (let p = past.length; p <= flat.length; p++) {
      if (flat.slice(p - past.length, p) === past && flat.slice(p).startsWith(upcoming.slice(0, 5))) candidates.push(p)
    }
  }
  if (!candidates.length) return null
  let offset = candidates[0]
  for (let i = 0; i < cleanedLines.length; i++) {
    if (offset <= cleanedLines[i].length && (offset < cleanedLines[i].length || i === cleanedLines.length - 1)) {
      return { line0: i, column: offset }
    }
    offset -= cleanedLines[i].length
  }
  return null
}

const stripQuotes = (s: string) => s.replace(/^'(.*)'$/, '$1')

// Langium joins one sentence per error: a lexer error is often followed by the parse
// errors it caused further on, so only the first one describes the reported position
const LANGIUM_ERROR = /(?:(Lexer|Parse) error )?(?:on )?line (\d+|\?), column (\d+|\?):?([\s\S]*?)(?=(?:Lexer|Parse) error on line|$)/

export function diagnose(code: string, error: unknown): Diagnostic {
  const err = error as { message?: string; name?: string; hash?: any } | undefined
  const message = String(err?.message ?? error ?? 'Unknown error')
  const originalLines = code.replace(/\r\n?/g, '\n').split('\n')
  const map = buildLineMap(code)

  const base = (pos: { line: number; column: number }, rest: Partial<Diagnostic>): Diagnostic => ({
    kind: 'other',
    message,
    line: pos.line,
    column: pos.column,
    length: 1,
    found: '',
    expected: [],
    atEnd: false,
    ...rest,
  })

  if (err?.name === 'UnknownDiagramError' || message.startsWith('No diagram type detected')) {
    const pos = toOriginalPosition(map, 0, 0, originalLines)
    const first = originalLines[pos.line - 1] ?? ''
    const word = first.trim().split(/\s+/)[0] ?? ''
    return base({ line: pos.line, column: first.length - first.trimStart().length }, {
      kind: 'unknown-diagram',
      found: word,
      length: Math.max(1, word.length),
    })
  }

  const hash = err?.hash
  if (hash && hash.loc && typeof hash.loc === 'object') {
    const loc = hash.loc
    const pos = toOriginalPosition(map, loc.last_line - 1, loc.last_column, originalLines)
    const token = hash.token === 1 || hash.token === 'EOF' ? 'EOF' : String(hash.token ?? '')
    const found = String(hash.text ?? '').replace(/\s+$/, '')
    const atEnd = token === 'EOF' || token === 'EOF_IN_STRUCT' || loc.last_line - 1 >= map.toOriginal.length
    const lineText = originalLines[pos.line - 1] ?? ''
    // class/state lexers skip the blank before a token on their own, so last_column can point at it
    if (!atEnd && found && !lineText.startsWith(found, pos.column)) {
      let col = pos.column
      while (col < lineText.length && WS.test(lineText[col])) col++
      if (lineText.startsWith(found, col)) pos.column = col
    }
    return base(pos, {
      kind: 'parse',
      found: atEnd ? '' : found,
      foundToken: token,
      expected: (hash.expected ?? []).map(stripQuotes),
      atEnd,
      length: atEnd ? 1 : Math.max(1, Math.min(found.length || 1, lineText.length - pos.column || 1)),
    })
  }

  if (hash && hash.token === null && /Lexical error/.test(message)) {
    const located = locateFromExcerpt(message, map.cleanedLines)
    const line0 = located?.line0 ?? (typeof hash.line === 'number' ? hash.line : 0)
    const pos = toOriginalPosition(map, line0, located?.column ?? 0, originalLines)
    const lineText = originalLines[pos.line - 1] ?? ''
    return base(pos, { kind: 'lexical', found: lineText.charAt(pos.column), length: 1 })
  }

  // Langium/chevrotain based diagrams (pie, gitGraph, packet, architecture, radar, …)
  const lm = message.match(LANGIUM_ERROR)
  if (lm) {
    const [, kind, lineNo, colNo, detail] = lm
    // chevrotain's EOF token has no position
    const line0 = lineNo === '?' ? map.toOriginal.length : Number(lineNo) - 1
    const pos = toOriginalPosition(map, line0, colNo === '?' ? 0 : Number(colNo) - 1, originalLines)
    const atEnd = line0 >= map.toOriginal.length
    let found: string
    let expected: string[] = []
    if (kind === 'Lexer') {
      const skipped = Number(detail.match(/skipped (\d+) character/)?.[1] ?? 1)
      found = (originalLines[pos.line - 1] ?? '').slice(pos.column, pos.column + skipped) || (detail.match(/->([\s\S])<-/)?.[1] ?? '')
    } else {
      const [want, got = ''] = detail.split(/but found:?\s*/)
      const quoted = got.match(/^`([\s\S]*)`|^'([\s\S]*)'/)
      found = quoted?.[1] ?? quoted?.[2] ?? ''
      const single = want.match(/Expecting token of type '([^']+)'/)?.[1]
      // "one of these possible Token sequences: 1. [A] 2. [B, C]" → the tokens each sequence starts with
      expected = single ? [single] : [...new Set(Array.from(want.matchAll(/\[\s*([^\],\s]+)/g), (m) => m[1]))]
    }
    const newline = found.includes('\n')
    if (newline) found = ''
    return base(pos, {
      kind: kind === 'Lexer' ? 'lexical' : 'parse',
      found,
      foundToken: newline ? 'NEWLINE' : atEnd ? 'EOF' : undefined,
      expected,
      atEnd,
      length: Math.max(1, found.length),
    })
  }

  const ln = message.match(/on line (\d+)/)
  const pos = toOriginalPosition(map, ln ? Number(ln[1]) - 1 : 0, 0, originalLines)
  return base(pos, {})
}

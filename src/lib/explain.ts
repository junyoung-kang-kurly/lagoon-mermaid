import type { Diagnostic } from './diagnose'
import { DIAGRAM_KEYWORDS, type DiagramFamily, SHAPES, closestKeyword, familyOf, header } from './fix/text'
import { type Lang, type MessageKey, translate } from './i18n'

export interface Explanation {
  title: string
  detail: string
  hint?: string
  /** human readable list of what the parser would have accepted */
  expected: string[]
}

const SYMBOLS: Record<string, string> = {
  SQS: '[', SQE: ']', PS: '(', PE: ')', DIAMOND_START: '{', DIAMOND_STOP: '}', DOUBLECIRCLEEND: ')))',
  STADIUMEND: '])', SUBROUTINEEND: ']]', CYLINDEREND: ')]', TRAPEND: '\\]', INVTRAPEND: '/]', TAGEND: '>',
  TAGSTART: '<', PIPE: '|', MINUS: '-', AMP: '&', SEMI: ';', COLON: ':', COMMA: ',', LINK: '-->', START_LINK: '--',
  STRUCT_STOP: '}', STRUCT_START: '{', BLOCK_STOP: '}', SQUARE_BRACES_END: ']', SQUARE_BRACES_START: '[', LINE: '--',
  DOTTED_LINE: '..', SOLID_ARROW: '->>', DOTTED_ARROW: '-->>', SOLID_OPEN_ARROW: '->', DOTTED_OPEN_ARROW: '-->',
  SOLID_CROSS: '-x', DOTTED_CROSS: '--x', STYLE_SEPARATOR: ':::', end: 'end', subgraph: 'subgraph', '-->': '-->',
  '-)': '-)', title: 'title', over: 'over', left_of: 'left of', right_of: 'right of',
}

/** the same token names mean different keywords per grammar: LINE is `--` in classDiagram but `line` in xychart */
const FAMILY_SYMBOLS: Partial<Record<DiagramFamily, Record<string, string>>> = {
  xy: { LINE: 'line', BAR: 'bar', X_AXIS: 'x-axis', Y_AXIS: 'y-axis' },
}

const WORDS: Record<string, MessageKey> = {
  NEWLINE: 'tok.newline', NL: 'tok.newline', SPACELINE: 'tok.newline', EOF: 'tok.eof', SPACE: 'tok.space',
  NODE_STRING: 'tok.nodeName', STR: 'tok.string', STRING: 'tok.string', TEXT: 'tok.text', UNICODE_TEXT: 'tok.text',
  TXT: 'tok.message', taskData: 'tok.taskData', ALPHA: 'tok.name', ID: 'tok.name', ACTOR: 'tok.name',
  ATTRIBUTE_WORD: 'tok.name', REFERENCE: 'tok.name', MEMBER: 'tok.member', DESCR: 'tok.description',
  STATE_DESCR: 'tok.description', EDGE_TEXT: 'tok.edgeText', NUM: 'tok.number', NUMBER: 'tok.number', INT: 'tok.number',
  NUMBER_PIE: 'tok.number', NUMBER_WITH_DECIMAL: 'tok.number',
}

const LABEL_BREAKERS = new Set(['PS', 'PE', 'SQS', 'SQE', 'DIAMOND_START', 'DIAMOND_STOP', 'STR', 'PIPE', 'TAGSTART', 'TAGEND'])

const CLOSERS = new Set([']', ')', '}', ')))', '])', ']]', ')]', '\\]', '/]', 'end'])

// mirrors KEYWORDS in fix/rules.ts; `end` is left out because `End` is a common node name
const KEYWORDS: Partial<Record<DiagramFamily, string[]>> = {
  flowchart: ['subgraph', 'style', 'classDef', 'class', 'click', 'linkStyle', 'direction'],
  sequence: ['participant', 'actor', 'loop', 'alt', 'else', 'opt', 'par', 'and', 'rect', 'Note', 'activate', 'deactivate', 'autonumber', 'critical', 'break', 'box', 'create', 'destroy', 'title', 'option'],
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

const BLOCK_OPENER: Partial<Record<DiagramFamily, RegExp>> = {
  flowchart: /^\s*subgraph\b/,
  sequence: /^\s*(loop|alt|opt|par|par_over|rect|critical|break|box)\b/,
}
const END_LINE = /^\s*end\s*;?\s*(%%.*)?$/
// sequenceDiagram reads `End`/`END` as the keyword too
const SEQ_END_LINE = new RegExp(END_LINE.source, 'i')
const endLine = (family: DiagramFamily) => (family === 'sequence' ? SEQ_END_LINE : END_LINE)
const DIRECTIONS = ['TD', 'TB', 'BT', 'LR', 'RL']
const SYMBOL_DIRECTIONS = ['BR', '<', '>', '^', 'v']
const SEQ_ARROW = /<<-->>|<<->>|-->>|->>|-->|->|--x|-x|--\)|-\)/
const ARROWISH = /[-=<>.~—–―‐‑→⇒]/
const ID_CHAR = /[\p{L}\p{N}_]/u

export function humanToken(lang: Lang, token: string, family: DiagramFamily = 'other'): string | null {
  const symbol = FAMILY_SYMBOLS[family]?.[token] ?? SYMBOLS[token]
  if (symbol) return `\`${symbol}\``
  if (WORDS[token]) return translate(lang, WORDS[token])
  if (token.length === 1 || /^[^\w\s]+$/.test(token)) return `\`${token}\``
  return null
}

function humanExpected(lang: Lang, expected: string[], family: DiagramFamily): string[] {
  const out: string[] = []
  for (const tok of expected) {
    const h = humanToken(lang, tok, family)
    if (h && !out.includes(h)) out.push(h)
  }
  return out.slice(0, 7)
}

function describeChar(lang: Lang, text: string): { name: string; kind: 'arrow' | 'invisible' | 'quote' | 'generic' } {
  const c = [...text][0] ?? ''
  const code = c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0') ?? ''
  if (/[—–―‐‑]/.test(c)) return { name: translate(lang, 'char.dash'), kind: 'arrow' }
  if (/[→⟶➔➜➝➞⇢⇒⟹↔⟷]/.test(c)) return { name: translate(lang, 'char.arrow', { c }), kind: 'arrow' }
  if (/[​-‍⁠﻿­]/.test(c)) return { name: translate(lang, 'char.invisible', { code }), kind: 'invisible' }
  if (/[\u00A0\u2000-\u200A\u202F\u3000]/.test(c)) return { name: translate(lang, 'char.space', { code }), kind: 'invisible' }
  if (/[“”„‟‘’‚‛]/.test(c)) return { name: translate(lang, 'char.quote', { c }), kind: 'quote' }
  if (text.length > 1) return { name: translate(lang, 'char.text', { c: text }), kind: 'generic' }
  return { name: translate(lang, 'char.generic', { c: c || ' ' }), kind: 'generic' }
}

/** closer still owed by the innermost unmatched opener on a line: A{hi → `}`, A -->|yes B → `|`, class A~T → `~` */
function owedCloser(line: string, family: DiagramFamily): string | null {
  const stack: string[] = []
  const pairs: Record<string, string> = { '[': ']', '(': ')', '{': '}' }
  for (let i = 0; i < line.length; ) {
    const ch = line[i]
    const top = stack[stack.length - 1]
    if (top === '"') {
      if (ch === '"') stack.pop()
      i++
      continue
    }
    if (line.startsWith('%%', i)) break
    if (ch === '"') {
      stack.push('"')
      i++
      continue
    }
    const toggle = (family === 'flowchart' && ch === '|') || (family === 'class' && ch === '~')
    if (toggle && (!top || top === ch)) {
      if (top === ch) stack.pop()
      else stack.push(ch)
      i++
      continue
    }
    const shape = family === 'flowchart' && !stack.length && i > 0 && ID_CHAR.test(line[i - 1]) ? SHAPES.find(([open]) => line.startsWith(open, i)) : undefined
    if (shape) {
      stack.push(shape[1])
      i += shape[0].length
      continue
    }
    if (top && line.startsWith(top, i)) {
      stack.pop()
      i += top.length
      continue
    }
    if (pairs[ch]) stack.push(pairs[ch])
    i++
  }
  return stack[stack.length - 1] ?? null
}

/** the arrow-like run at or before `col`: `Alice=>Bob` → `=>`, `Alice-Bob: hi` → `-` */
function badArrow(line: string, col: number): string | null {
  let end = Math.min(col, line.length - 1)
  while (end >= 0 && !ARROWISH.test(line[end])) end--
  if (end < 0) return null
  let start = end
  while (start > 0 && ARROWISH.test(line[start - 1])) start--
  while (end + 1 < line.length && ARROWISH.test(line[end + 1])) end++
  return line.slice(start, end + 1)
}

/** a block keyword is misspelled at the start of the error line (or right after the `pie` header) */
function keywordTypo(lines: string[], d: Diagnostic, family: DiagramFamily, headerLine: number | undefined) {
  const words = KEYWORDS[family]
  const text = lines[d.line - 1] ?? ''
  const m = text.match(d.line - 1 === headerLine ? /^(\s*\S+\s+)([A-Za-z][\w-]*)/ : /^(\s*)([A-Za-z][\w-]*)/)
  if (!words || !m) return null
  const word = m[2]
  const guess = closestKeyword(word, words)
  const caseOnly = guess?.toLowerCase() === word.toLowerCase()
  // short words and capitalized flowchart ids (`Style`, `Click`) are usually names, not typos
  if (!guess || (word.length <= 3 && !caseOnly) || (family === 'flowchart' && caseOnly)) return null
  const wordEnd = m[1].length + word.length
  const stoppedAtWord = !text.slice(wordEnd, d.column).trim()
  // the parser read the line as free text: a sequence actor waiting for an arrow, or a gantt/journey task
  const readAsText = (family === 'sequence' && d.expected.includes('SOLID_ARROW') && !SEQ_ARROW.test(text)) || (d.expected.includes('taskData') && looksLikeKeywordLine(word, guess, text.slice(wordEnd)))
  return stoppedAtWord || readAsText ? { word, guess, column: m[1].length } : null
}

const TASK_DATA = /\d{4}-\d{2}-\d{2}|\b\d+[dwhm]\b|\bafter\s|:\s*\d/

/**
 * A gantt/journey line the parser took as a task name is a keyword typo (`dateFormt YYYY-MM-DD`) only if it
 * is cased like the keyword and carries no schedule; `Sections review 2024-01-01, 3d` is a task missing its `:`.
 */
function looksLikeKeywordLine(word: string, guess: string, rest: string): boolean {
  const sameCase = (word[0] === word[0].toLowerCase()) === (guess[0] === guess[0].toLowerCase())
  return sameCase && !TASK_DATA.test(rest)
}

function openBlocks(lines: string[], upTo: number, family: DiagramFamily): number {
  const opener = BLOCK_OPENER[family]
  let depth = 0
  for (let i = 0; i < upTo; i++) {
    if (opener?.test(lines[i])) depth++
    else if (endLine(family).test(lines[i])) depth--
  }
  return depth
}

export function explain(lang: Lang, code: string, d: Diagnostic): Explanation {
  const tr = (key: MessageKey, params?: Record<string, string | number>) => translate(lang, key, params)
  if (!code.trim()) return { title: tr('explain.empty.title'), detail: tr('explain.unknown.hint'), expected: [] }

  const family = familyOf(code)
  const lines = code.replace(/\r\n?/g, '\n').split('\n')
  const lineText = lines[d.line - 1] ?? ''
  const where = tr('error.where', { line: d.line, col: d.column + 1 })
  const expected = humanExpected(lang, d.expected, family)
  // some parsers report a line break as a literal '\n', and Langium may flag EOF while later lines exist
  const found = /\n/.test(d.found) ? d.found.replace(/\s+$/, '') : d.found
  const meaningful = (l: string) => l.trim() !== '' && !/^\s*%%/.test(l)
  const atEnd = d.atEnd && !lines.slice(d.line).some(meaningful)
  const foundText = atEnd ? tr('explain.found.end') : found === '' ? tr('explain.found.newline') : `\`${found}\``
  const expectedHint = () =>
    expected.length === 1 ? tr('explain.generic.hintOne', { expected: expected[0] }) : expected.length ? tr('explain.generic.hint', { expected: expected.join(', ') }) : undefined

  if (d.kind === 'unknown-diagram' && d.found.startsWith('```')) {
    return { title: tr('explain.fence.title'), detail: tr('explain.fence.detail'), hint: tr('explain.fence.hint'), expected: [] }
  }
  if (d.kind === 'unknown-diagram') {
    const guess = closestKeyword(d.found, DIAGRAM_KEYWORDS)
    return {
      title: tr('explain.unknown.title'),
      detail: tr('explain.unknown.detail', { word: d.found }),
      hint: guess ? tr('explain.unknown.typo', { guess }) : tr('explain.unknown.hint'),
      expected: [],
    }
  }

  const head = header(code)
  // an unknown direction fails in the lexer, at the space after `graph`
  if (family === 'flowchart' && d.kind === 'lexical' && head && d.line - 1 === head.line) {
    const m = head.text.match(/^(flowchart|graph)\s+([^\s;]+)/)
    if (m && !DIRECTIONS.includes(m[2]) && !SYMBOL_DIRECTIONS.includes(m[2])) {
      const fix = `${m[1]} ${DIRECTIONS.includes(m[2].toUpperCase()) ? m[2].toUpperCase() : 'TD'}`
      return { title: tr('explain.direction.title', { dir: m[2] }), detail: tr('explain.direction.detail'), hint: tr('explain.direction.hint', { fix }), expected }
    }
  }

  const typo = keywordTypo(lines, d, family, head?.line)
  const typoExplanation = typo && {
    title: tr('explain.keyword.title', { word: typo.word }),
    detail: tr('explain.keyword.detail', { where: tr('error.where', { line: d.line, col: typo.column + 1 }), word: typo.word }),
    hint: tr('explain.unknown.typo', { guess: typo.guess }),
    expected,
  }

  if (d.kind === 'lexical') {
    if (typoExplanation) return typoExplanation
    // the character under the reported column is the one the lexer choked on, whatever `found` says
    const at = lineText.charAt(d.column)
    const text = found && (!at || found.startsWith(at)) ? found : at || found
    const ch = describeChar(lang, text)
    const pieLabel = family === 'pie' && d.line - 1 !== head?.line && at !== '"' && d.column === lineText.length - lineText.trimStart().length
    if (pieLabel) {
      const [label, value] = lineText.trim().split(/\s*:\s*/)
      const example = `"${label}" : ${value || 1}`
      return { title: tr('explain.lexical.title'), detail: tr('explain.lexical.detail', { where, char: ch.name }), hint: tr('explain.pieLabel.hint', { example }), expected }
    }
    const hintKey = (
      { arrow: 'explain.lexical.hintArrow', invisible: 'explain.lexical.hintInvisible', quote: 'explain.lexical.hintQuote', generic: 'explain.lexical.hintGeneric' } as const
    )[ch.kind]
    // a quote the lexer cannot start a string with is one that never closes
    const hint = at === '"' ? tr('explain.eof.hint', { closers: '`"`' }) : tr(hintKey)
    return { title: tr('explain.lexical.title'), detail: tr('explain.lexical.detail', { where, char: ch.name }), hint, expected }
  }

  if (d.kind === 'parse') {
    const tok = d.foundToken ?? ''
    const wantsLabelClose = d.expected.some((e) => ['SQE', 'PE', 'DIAMOND_STOP', 'TEXT', 'UNICODE_TEXT'].includes(e))

    if (family === 'flowchart' && LABEL_BREAKERS.has(tok) && wantsLabelClose && !atEnd) {
      // STR text comes without its quotes, so name the quote itself
      const quote = tok === 'STR'
      return {
        title: tr('explain.label.title', { char: quote ? '"' : found || SYMBOLS[tok] || tok }),
        detail: tr('explain.label.detail'),
        hint: tr(quote ? 'explain.label.hintQuote' : 'explain.label.hint'),
        expected,
      }
    }
    if (tok === 'end' || found.trim() === 'end') {
      if (endLine(family).test(lineText) && openBlocks(lines, d.line - 1, family) <= 0) {
        return { title: tr('explain.endUnmatched.title'), detail: tr('explain.endUnmatched.detail'), hint: tr('explain.endUnmatched.hint'), expected }
      }
      const node = family === 'flowchart'
      return {
        title: tr('explain.end.title'),
        detail: tr(node ? 'explain.end.detail' : 'explain.end.detailName'),
        hint: tr(node ? 'explain.end.hint' : 'explain.end.hintRename'),
        expected,
      }
    }
    if (typoExplanation) return typoExplanation
    if (family === 'sequence' && d.expected.includes('SOLID_ARROW')) {
      const arrow = badArrow(lineText, d.column)
      // `Alice-Bob: hi` reaches the message text without ever seeing a valid arrow
      if (tok === 'INVALID' || (tok === 'TXT' && arrow && !SEQ_ARROW.test(lineText))) {
        return { title: tr('explain.seqArrow.title'), detail: tr('explain.seqArrow.detail', { where, found: arrow ?? found }), hint: tr('explain.seqArrow.hint'), expected }
      }
    }
    if (family === 'sequence' && d.expected.length === 1 && d.expected[0] === 'TXT') {
      return { title: tr('explain.seqText.title'), detail: tr('explain.seqText.detail'), hint: tr('explain.seqText.hint'), expected }
    }
    if (family === 'er' && d.expected.includes('COLON')) {
      return { title: tr('explain.erLabel.title'), detail: tr('explain.erLabel.detail'), hint: tr('explain.erLabel.hint'), expected }
    }
    if (family === 'er' && d.expected.includes('ATTRIBUTE_WORD') && !atEnd) {
      return { title: tr('explain.erAttr.title'), detail: tr('explain.erAttr.detail'), hint: tr('explain.erAttr.hint'), expected }
    }
    if (d.expected.includes('taskData')) {
      const journey = family === 'journey'
      return {
        title: tr('explain.task.title'),
        detail: tr(journey ? 'explain.journeyTask.detail' : 'explain.task.detail'),
        hint: tr(journey ? 'explain.journeyTask.hint' : 'explain.task.hint'),
        expected,
      }
    }
    if (atEnd) {
      let last = d.line - 1
      while (last > 0 && !meaningful(lines[last] ?? '')) last--
      const owed = owedCloser(lines[last] ?? '', family)
      const fromExpected = [...new Set(d.expected.map((e) => SYMBOLS[e] ?? e).filter((s) => CLOSERS.has(s)))].slice(0, 3)
      const closers = owed ? [owed] : fromExpected
      if (!closers.length) return { title: tr('explain.eof.title'), detail: tr('explain.eof.incomplete', { where }), hint: expectedHint(), expected }
      return {
        title: tr('explain.eof.title'),
        detail: tr('explain.eof.detail'),
        hint: tr('explain.eof.hint', { closers: closers.map((c) => `\`${c}\``).join(' / ') }),
        expected,
      }
    }
    if (family === 'flowchart' && (d.expected.includes('LINK') || d.expected.includes('START_LINK'))) {
      return { title: tr('explain.link.title'), detail: tr('explain.link.detail', { where, found: foundText }), hint: tr('explain.link.hint'), expected }
    }
    if (d.expected.length === 1 && /^[^\w\s]+$/.test(d.expected[0])) {
      const want = d.expected[0]
      const detail = found === '' ? tr('explain.token.detailNewline', { where, want }) : tr('explain.token.detail', { where, want, found })
      return { title: tr('explain.token.title', { want }), detail, expected }
    }
    return { title: tr('explain.generic.title'), detail: tr('explain.generic.detail', { where, found: foundText }), hint: expectedHint(), expected }
  }

  return { title: tr('explain.other.title'), detail: d.message.split('\n')[0], expected }
}


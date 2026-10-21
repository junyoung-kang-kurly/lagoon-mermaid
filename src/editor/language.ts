import {
  type Completion,
  type CompletionContext,
  type CompletionResult,
  completeAnyWord,
  snippetCompletion,
} from '@codemirror/autocomplete'
import { HighlightStyle, LanguageSupport, StreamLanguage, type StringStream, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { DIAGRAM_KEYWORDS } from '../lib/fix/text'

interface State {
  frontmatter: 'pending' | 'inside' | 'done'
  directive: boolean
  header: boolean
  label: string | null
}

const OPENERS: Array<[string, string]> = [
  ['(((', ')))'], ['((', '))'], ['([', '])'], ['[[', ']]'], ['[(', ')]'], ['{{', '}}'],
  ['[/', '/]'], ['[\\', '\\]'], ['[', ']'], ['(', ')'], ['{', '}'], ['>', ']'],
]

const ER_LINK = /^[|}o][|o]?(?:--|\.\.)[|o{][|{]?/
const ARROW =
  /^(?:<<-->>|<<->>|<-->|<==>|<-\.->|x--x|o--o|-->>|->>|-->|---|-\.->|-\.-|==>|===|~~~|\.\.\|>|\.\.>|--\|>|<\|--|\*--|--\*|--o|o--|--x|-x|--\)|-\)|\.\.|--|->|==|=>)/
const KEYWORD =
  /^(?:subgraph|end|direction|classDef|class|style|linkStyle|click|call|href|participant|actor|as|loop|alt|else|opt|par_over|par|and|rect|critical|break|box|option|note|Note|over|left of|right of|activate|deactivate|autonumber|title|accTitle|accDescr|section|dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker|weekday|commit|branch|checkout|merge|cherry-pick|switch|state|namespace|x-axis|y-axis|quadrant-[1-4]|bar|columns|space|group|service|junction|in|showData|create|destroy|links?|callback|cssClass|requirement|element|satisfies|contains|traces|derives|refines|verifies|copies|risk|verifymethod|axis|curve|max|min|Person|System|System_Ext|Container|Component|Rel|Boundary)(?![\p{L}\p{N}_-])/u
const ID_CHAR = /[\p{L}\p{N}_]/u

function tokenLabel(stream: StringStream, state: State): string {
  const closer = state.label!
  if (stream.match(closer)) {
    state.label = null
    return 'bracket'
  }
  if (stream.match(/^"[^"]*"?/)) return 'string'
  while (!stream.eol() && !stream.match(closer, false)) {
    if (stream.peek() === '"') break
    stream.next()
  }
  return 'string'
}

const mermaidStream = StreamLanguage.define<State>({
  name: 'mermaid',
  startState: () => ({ frontmatter: 'pending', directive: false, header: false, label: null }),
  copyState: (s) => ({ ...s }),
  token(stream, state) {
    if (stream.sol() && state.frontmatter !== 'done') {
      if (state.frontmatter === 'pending') {
        state.frontmatter = stream.match(/^---\s*$/) ? 'inside' : 'done'
        if (state.frontmatter === 'inside') return 'meta'
      } else if (stream.match(/^---\s*$/)) {
        state.frontmatter = 'done'
        return 'meta'
      }
    }
    if (state.frontmatter === 'inside') {
      if (stream.match(/^\s*[\w-]+(?=\s*:)/)) return 'propertyName'
      if (stream.match(/^\s*:/)) return 'punctuation'
      stream.skipToEnd()
      return 'string'
    }
    if (state.directive) {
      if (stream.skipTo('}%%')) {
        stream.match('}%%')
        state.directive = false
      } else stream.skipToEnd()
      return 'meta'
    }
    if (stream.match('%%{')) {
      state.directive = true
      return 'meta'
    }
    if (stream.match(/^%%.*/)) return 'comment'
    if (state.label) {
      if (stream.eol()) return null
      return tokenLabel(stream, state)
    }
    if (stream.eatSpace()) return null

    if (!state.header && stream.match(/^[A-Za-z][\w-]*/)) {
      state.header = true
      return 'heading'
    }
    if (stream.match(/^"[^"]*"?/) || stream.match(/^`[^`]*`?/)) return 'string'
    if (stream.match(ER_LINK)) return 'operator'
    if (stream.match(/^\|[^|\n]*\|/)) return 'labelName'
    if (stream.match(ARROW)) return 'operator'

    const prev = stream.string.charAt(stream.pos - 1)
    if (prev && ID_CHAR.test(prev)) {
      const shape = OPENERS.find(([open]) => stream.match(open))
      if (shape) {
        state.label = shape[1]
        return 'bracket'
      }
    }
    if (stream.match(/^[[\](){}]/)) return 'bracket'
    if (stream.match(/^:::?/) || stream.match(/^[;&,]/)) return 'punctuation'
    if (stream.match(KEYWORD)) return 'keyword'
    if (stream.match(/^(?:TB|TD|BT|RL|LR)(?![\w])/)) return 'atom'
    if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return 'number'
    if (stream.match(/^-?\d+(?:\.\d+)?(?:%|px|d|w|h)?(?![\p{L}_])/u)) return 'number'
    if (stream.match(/^[\p{L}_][\p{L}\p{N}_-]*/u)) return 'variableName'
    stream.next()
    return null
  },
  languageData: { commentTokens: { line: '%%' } },
})

export const mermaidHighlight = HighlightStyle.define([
  { tag: t.heading, color: 'var(--syn-header)', fontWeight: '600' },
  { tag: t.keyword, color: 'var(--syn-keyword)' },
  { tag: t.operator, color: 'var(--syn-arrow)', fontWeight: '500' },
  { tag: t.string, color: 'var(--syn-string)' },
  { tag: t.labelName, color: 'var(--syn-edge)' },
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.number, color: 'var(--syn-number)' },
  { tag: t.atom, color: 'var(--syn-atom)', fontWeight: '500' },
  { tag: t.bracket, color: 'var(--syn-bracket)' },
  { tag: t.meta, color: 'var(--syn-meta)' },
  { tag: t.propertyName, color: 'var(--syn-keyword)' },
  { tag: t.punctuation, color: 'var(--syn-bracket)' },
  { tag: t.variableName, color: 'var(--syn-ident)' },
])

const HEADER_COMPLETIONS: Completion[] = [
  snippetCompletion('flowchart ${TD}\n    ${A}[${Start}] --> ${B}[${End}]', { label: 'flowchart', detail: 'Flowchart', type: 'keyword' }),
  snippetCompletion('sequenceDiagram\n    ${Alice}->>${Bob}: ${Hello}', { label: 'sequenceDiagram', detail: 'Sequence', type: 'keyword' }),
  snippetCompletion('classDiagram\n    class ${Animal} {\n        +${name}\n    }', { label: 'classDiagram', detail: 'Class', type: 'keyword' }),
  snippetCompletion('stateDiagram-v2\n    [*] --> ${Idle}', { label: 'stateDiagram-v2', detail: 'State', type: 'keyword' }),
  snippetCompletion('erDiagram\n    ${CUSTOMER} ||--o{ ${ORDER} : ${places}', { label: 'erDiagram', detail: 'ER', type: 'keyword' }),
  snippetCompletion('gantt\n    dateFormat YYYY-MM-DD\n    section ${Section}\n    ${Task} : ${2026-01-01}, ${3d}', { label: 'gantt', detail: 'Gantt', type: 'keyword' }),
  snippetCompletion('pie title ${Title}\n    "${A}" : ${40}\n    "${B}" : ${60}', { label: 'pie', detail: 'Pie', type: 'keyword' }),
  snippetCompletion('mindmap\n  root((${Topic}))\n    ${Idea}', { label: 'mindmap', detail: 'Mindmap', type: 'keyword' }),
  ...DIAGRAM_KEYWORDS.filter((k) => !['flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram-v2', 'erDiagram', 'gantt', 'pie', 'mindmap'].includes(k)).map(
    (label): Completion => ({ label, type: 'keyword', detail: 'diagram' }),
  ),
]

const BODY_COMPLETIONS: Completion[] = [
  snippetCompletion('subgraph ${title}\n    ${}\nend', { label: 'subgraph', detail: '… end', type: 'keyword' }),
  snippetCompletion('classDef ${name} fill:${#0f766e},stroke:${#2dd4bf},color:${#fff}', { label: 'classDef', type: 'keyword' }),
  snippetCompletion('class ${A} ${name}', { label: 'class', type: 'keyword' }),
  snippetCompletion('style ${A} fill:${#f9f},stroke:${#333}', { label: 'style', type: 'keyword' }),
  snippetCompletion('linkStyle ${0} stroke:${#2dd4bf},stroke-width:${2px}', { label: 'linkStyle', type: 'keyword' }),
  snippetCompletion('click ${A} href "${https://}" _blank', { label: 'click', type: 'keyword' }),
  snippetCompletion('direction ${LR}', { label: 'direction', type: 'keyword' }),
  snippetCompletion('participant ${A} as ${Alice}', { label: 'participant', type: 'keyword' }),
  snippetCompletion('actor ${U} as ${User}', { label: 'actor', type: 'keyword' }),
  snippetCompletion('loop ${Every minute}\n    ${}\nend', { label: 'loop', detail: '… end', type: 'keyword' }),
  snippetCompletion('alt ${success}\n    ${}\nelse ${failure}\n    \nend', { label: 'alt', detail: '… else … end', type: 'keyword' }),
  snippetCompletion('opt ${optional}\n    ${}\nend', { label: 'opt', detail: '… end', type: 'keyword' }),
  snippetCompletion('par ${task A}\n    ${}\nand ${task B}\n    \nend', { label: 'par', detail: '… and … end', type: 'keyword' }),
  snippetCompletion('Note right of ${A}: ${text}', { label: 'Note', type: 'keyword' }),
  snippetCompletion('rect rgb(${45, 212, 191, 0.1})\n    ${}\nend', { label: 'rect', type: 'keyword' }),
  { label: 'autonumber', type: 'keyword' },
  { label: 'activate', type: 'keyword' },
  { label: 'deactivate', type: 'keyword' },
  snippetCompletion('section ${Name}', { label: 'section', type: 'keyword' }),
  snippetCompletion('title ${Title}', { label: 'title', type: 'keyword' }),
  { label: 'end', type: 'keyword' },
  { label: '-->', type: 'operator', detail: 'arrow' },
  { label: '-.->', type: 'operator', detail: 'dotted' },
  { label: '==>', type: 'operator', detail: 'thick' },
  { label: '->>', type: 'operator', detail: 'message' },
  { label: '-->>', type: 'operator', detail: 'reply' },
]

function mermaidCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[\w-]+/)
  if (!word && !context.explicit) return null
  const before = context.state.doc.sliceString(0, word ? word.from : context.pos)
  const atHeader = !before.replace(/%%.*$/gm, '').trim()
  const lineStart = context.state.doc.lineAt(context.pos).from
  const onlyIndent = !context.state.doc.sliceString(lineStart, word ? word.from : context.pos).trim()
  if (!atHeader && !onlyIndent) return null
  return { from: word ? word.from : context.pos, options: atHeader ? HEADER_COMPLETIONS : BODY_COMPLETIONS, validFor: /^[\w-]*$/ }
}

export function mermaid() {
  return new LanguageSupport(mermaidStream, [
    syntaxHighlighting(mermaidHighlight),
    mermaidStream.data.of({ autocomplete: mermaidCompletions }),
    mermaidStream.data.of({ autocomplete: completeAnyWord }),
  ])
}

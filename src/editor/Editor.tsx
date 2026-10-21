import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput, indentUnit } from '@codemirror/language'
import { type Diagnostic as CmDiagnostic, lintGutter, setDiagnostics } from '@codemirror/lint'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
} from '@codemirror/view'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { mermaid } from './language'

export interface EditorProblem {
  line: number
  column: number
  length: number
  message: string
}

export interface EditorHandle {
  readonly view: EditorView
  /** shows the view inside `host`; returns the function that takes it out again */
  attach(host: HTMLElement): () => void
  /** replaces the whole document as one undoable change */
  replace(code: string): void
  focus(): void
  goTo(line: number, column?: number, length?: number): void
  flashLine(line: number): void
  getCode(): string
}

interface Options {
  initial: string
  placeholderText: string
  onChange(code: string): void
  onCursor(line: number, col: number): void
}

const setErrorLine = StateEffect.define<number | null>()
const setFlash = StateEffect.define<number | null>()

const lineDecorations = StateField.define<{ error: number | null; flash: number | null; deco: DecorationSet }>({
  create: () => ({ error: null, flash: null, deco: Decoration.none }),
  update(value, tr) {
    let { error, flash } = value
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) error = e.value
      if (e.is(setFlash)) flash = e.value
    }
    if (tr.docChanged && error !== null && error > tr.state.doc.lines) error = null
    if (error === value.error && flash === value.flash && !tr.docChanged) return value
    const ranges = []
    const doc = tr.state.doc
    if (error !== null && error >= 1 && error <= doc.lines) ranges.push(Decoration.line({ class: 'cm-line-error' }).range(doc.line(error).from))
    if (flash !== null && flash >= 1 && flash <= doc.lines && flash !== error)
      ranges.push(Decoration.line({ class: 'cm-flash' }).range(doc.line(flash).from))
    ranges.sort((a, b) => a.from - b.from)
    return { error, flash, deco: Decoration.set(ranges) }
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
})

const baseTheme = EditorView.theme({
  '&': { color: 'var(--text)' },
  '.cm-placeholder': { color: 'var(--muted)', fontStyle: 'italic' },
})

/**
 * The EditorView belongs to the caller, not to <Editor>: swapping the panes or crossing the
 * mobile breakpoint remounts <Editor>, and the view must keep its document and undo history.
 * It is never destroyed; it lives as long as the page, like App.
 */
export function useEditor(options: Options): EditorHandle {
  const latest = useRef(options)
  latest.current = options
  const handle = useRef<EditorHandle | null>(null)
  handle.current ??= createEditor(latest)
  return handle.current
}

function createEditor(options: { readonly current: Options }): EditorHandle {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    indentOnInput(),
    indentUnit.of('    '),
    bracketMatching(),
    closeBrackets(),
    autocompletion({ icons: false, activateOnTyping: true }),
    highlightSelectionMatches(),
    lintGutter(),
    lineDecorations,
    mermaid(),
    baseTheme,
    placeholder(options.current.placeholderText),
    EditorView.lineWrapping,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) options.current.onChange(u.state.doc.toString())
      if (u.selectionSet || u.docChanged) {
        const head = u.state.selection.main.head
        const line = u.state.doc.lineAt(head)
        options.current.onCursor(line.number, head - line.from + 1)
      }
    }),
  ]
  const view = new EditorView({ state: EditorState.create({ doc: options.current.initial, extensions }) })
  let scrollTop = 0
  const unflash = () => window.setTimeout(() => view.dispatch({ effects: setFlash.of(null) }), 1300)

  return {
    view,
    attach(host) {
      host.appendChild(view.dom)
      // a moved element loses its scroll offset; restored synchronously, so that StrictMode's
      // immediate detach/attach in dev reads it back correctly
      view.scrollDOM.scrollTop = scrollTop
      view.requestMeasure()
      return () => {
        scrollTop = view.scrollDOM.scrollTop
        view.dom.remove()
      }
    },
    replace(code) {
      if (view.state.doc.toString() === code) return
      view.dispatch({ changes: minimalChange(view.state.doc.toString(), code), userEvent: 'input.replace' })
    },
    focus() {
      view.focus()
    },
    goTo(line, column = 0, length = 0) {
      const doc = view.state.doc
      const l = doc.line(Math.min(Math.max(line, 1), doc.lines))
      const from = Math.min(l.from + column, l.to)
      const to = Math.min(from + length, l.to)
      view.dispatch({ selection: { anchor: from, head: to }, effects: [EditorView.scrollIntoView(from, { y: 'center' }), setFlash.of(l.number)] })
      view.focus()
      unflash()
    },
    flashLine(line) {
      view.dispatch({ effects: setFlash.of(line) })
      unflash()
    },
    getCode() {
      return view.state.doc.toString()
    },
  }
}

export function Editor({ editor, problem }: { editor: EditorHandle; problem: EditorProblem | null }) {
  const host = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => editor.attach(host.current!), [editor])

  useEffect(() => {
    const v = editor.view
    const doc = v.state.doc
    const diagnostics: CmDiagnostic[] = []
    if (problem && problem.line >= 1 && problem.line <= doc.lines) {
      const line = doc.line(problem.line)
      const from = Math.min(line.from + problem.column, line.to)
      const to = Math.min(from + Math.max(problem.length, 1), line.to)
      diagnostics.push({ from, to: Math.max(to, from), severity: 'error', message: problem.message })
    }
    v.dispatch(setDiagnostics(v.state, diagnostics))
    v.dispatch({ effects: setErrorLine.of(problem ? problem.line : null) })
  }, [editor, problem])

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />
}

/** one contiguous change keeps undo granular and the cursor where it was */
function minimalChange(a: string, b: string) {
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  return { from: start, to: endA, insert: b.slice(start, endB) }
}

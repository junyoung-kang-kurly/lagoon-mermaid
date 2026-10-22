// Completion popups must not hold on to a word that is already whole, or Enter accepts a no-op (flows#2)
import { type CompletionResult, type CompletionSource, CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@codemirror/state'
import { describe, expect, it } from 'vitest'
import { mermaid } from './language'

function complete(doc: string) {
  const state = EditorState.create({ doc, extensions: [mermaid()] })
  const pos = doc.length
  const [keywords, words] = state.languageDataAt<CompletionSource>('autocomplete', pos).map((source) => source(new CompletionContext(state, pos, false)) as CompletionResult | null)
  return { state, keywords, words }
}

const labels = (r: CompletionResult | null) => r?.options.map((o) => o.label) ?? []

/** whether the cached result keeps serving after typing `more`, as CodeMirror decides it */
function stillValid(r: CompletionResult, doc: string, more: string) {
  const state = EditorState.create({ doc: doc + more, extensions: [mermaid()] })
  const to = doc.length + more.length
  const v = r.validFor as (text: string, from: number, to: number, state: EditorState) => boolean
  return v(state.sliceDoc(r.from, to), r.from, to, state)
}

const SUBGRAPH = 'flowchart TD\n    subgraph one\n        A --> B\n    '

describe('autocomplete and Enter', () => {
  it('offers nothing for a typed-out `end`', () => {
    const { keywords, words } = complete(`${SUBGRAPH}end`)
    expect(keywords).toBeNull()
    expect(words).toBeNull()
  })

  it('drops a cached list once the word becomes `end`', () => {
    const doc = `${SUBGRAPH}en`
    const { keywords } = complete(doc)
    expect(labels(keywords)).toContain('end')
    expect(stillValid(keywords!, doc, 'd')).toBe(false)
  })

  it('does not offer another word for a keyword', () => {
    const doc = 'flowchart TD\n    subgraph Backend\n        A --> B\n    end'
    expect(complete(doc).words).toBeNull()
  })

  it('offers nothing for a node id that already exists', () => {
    const doc = 'flowchart TD\n    Start --> B\n    D --> Start'
    expect(complete(doc).words).toBeNull()
    const partial = complete('flowchart TD\n    Start --> B\n    D --> Sta')
    expect(labels(partial.words)).toContain('Start')
    expect(stillValid(partial.words!, 'flowchart TD\n    Start --> B\n    D --> Sta', 'rt')).toBe(false)
    expect(stillValid(partial.words!, 'flowchart TD\n    Start --> B\n    D --> Sta', 'r')).toBe(true)
  })

  it('still expands snippets, typed out or not', () => {
    expect(labels(complete('sequenceDiagram\n    loo').keywords)).toContain('loop')
    expect(labels(complete('sequenceDiagram\n    loop').keywords)).toContain('loop')
    expect(labels(complete('flowchart TD\n    A --> B\n    loop x\n    end\n    loop').keywords)).toContain('loop')
    expect(labels(complete('flow').keywords)).toContain('flowchart')
  })

  it('stops at a space', () => {
    const doc = 'flowchart TD\n    Start --> B\n    D --> Sta'
    expect(stillValid(complete(doc).words!, doc, ' ')).toBe(false)
  })
})

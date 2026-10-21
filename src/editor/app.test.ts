// App-level: the editor survives layout changes, and share links / dropped files load correctly
import { undo, undoDepth } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { StrictMode, act, createElement } from 'react'
import { type Root, createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { t } from '../lib/i18n'
import { DEFAULT_SETTINGS } from '../lib/mermaid'
import { encodeDoc } from '../lib/share'
import { loadDoc, loadHistory, saveDoc } from '../lib/storage'

vi.mock('../lib/mermaid', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/mermaid')>()),
  // jsdom has no layout engine; the app only needs some render result
  validate: async () => null,
  renderDiagram: async () => ({ svg: '<svg viewBox="0 0 10 10"></svg>', diagramType: 'flowchart', ms: 1 }),
}))

let wide = true
const breakpointListeners = new Set<() => void>()
const BREAKPOINT = '(min-width: 768px)'

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return query === BREAKPOINT && wide
    },
    addEventListener: (_: string, fn: () => void) => query === BREAKPOINT && breakpointListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => breakpointListeners.delete(fn),
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

let root: Root
let host: HTMLDivElement

async function mount() {
  host = document.body.appendChild(document.createElement('div'))
  root = createRoot(host)
  await act(async () => root.render(createElement(StrictMode, null, createElement(App))))
  await settle()
}

const settle = (ms = 10) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))

function editorView(): EditorView {
  const editors = document.querySelectorAll<HTMLElement>('.cm-editor')
  expect(editors).toHaveLength(1)
  expect(editors[0].isConnected).toBe(true)
  return EditorView.findFromDOM(editors[0])!
}

const type = (view: EditorView, text: string) => act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: text } }))

const START = 'flowchart TD\n    A --> B'

beforeEach(() => {
  localStorage.clear()
  wide = true
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('editor across layout changes', () => {
  beforeEach(() => saveDoc({ code: START, title: '', settings: DEFAULT_SETTINGS }))

  it('keeps the same view, document and undo history when the panes swap', async () => {
    const createState = vi.spyOn(EditorState, 'create')
    await mount()
    expect(createState).toHaveBeenCalledTimes(1) // StrictMode's second render pass builds no stray view
    createState.mockRestore()
    const view = editorView()
    type(view, '\n    B --> NEW')
    await act(async () => document.querySelector<HTMLButtonElement>(`button[aria-label="${t('cmd.layoutSwap')}"]`)!.click())

    expect(host.querySelectorAll('section')[1].contains(editorView().dom)).toBe(true) // the code pane really moved right
    expect(editorView().state.doc.toString()).toBe(`${START}\n    B --> NEW`)
    expect(editorView()).toBe(view)

    // the next keystroke used to write the page-load code back over the edit
    type(view, '!')
    await settle(350)
    expect(loadDoc()?.code).toBe(`${START}\n    B --> NEW!`)
    expect(undoDepth(view.state)).toBeGreaterThan(0)
    act(() => void undo(view))
    expect(view.state.doc.toString()).toBe(START)
  })

  it('keeps the same view across the 768px breakpoint and back', async () => {
    await mount()
    const view = editorView()
    type(view, '\n    B --> NEW')

    wide = false
    await act(async () => breakpointListeners.forEach((fn) => fn()))
    expect(host.querySelector('section')!.parentElement!.className).toContain('flex-1') // mobile tabs layout
    expect(editorView().state.doc.toString()).toBe(`${START}\n    B --> NEW`)
    expect(editorView()).toBe(view)

    wide = true
    await act(async () => breakpointListeners.forEach((fn) => fn()))
    expect(editorView()).toBe(view)
    type(view, '!')
    await settle(350)
    expect(loadDoc()?.code).toBe(`${START}\n    B --> NEW!`)
  })
})

describe('share links', () => {
  const DRAFT = 'flowchart TD\n    W1[MY UNSAVED WORK] --> W2[half typed'
  const SHARED = 'flowchart TD\n    S1[SHARED LINK NODE] --> S2'
  const hash = () => encodeDoc({ code: SHARED, title: 'shared', settings: { ...DEFAULT_SETTINGS, curve: 'step' } }, true)

  it('checkpoints the stored doc into history before a link replaces it on load', async () => {
    saveDoc({ code: DRAFT, title: 'mine', settings: DEFAULT_SETTINGS })
    window.history.replaceState(null, '', `/#${hash()}`)
    await mount()
    expect(editorView().state.doc.toString()).toBe(SHARED)
    // StrictMode runs the state initializer twice; the checkpoint is stored once
    expect(loadHistory().map((s) => [s.code, s.title])).toEqual([[DRAFT, 'mine']])
    expect(location.hash).toBe('')
  })

  it('loads a link pasted into an already open tab', async () => {
    saveDoc({ code: DRAFT, title: 'mine', settings: DEFAULT_SETTINGS })
    await mount()
    window.history.replaceState(null, '', `/#${hash()}`)
    await act(async () => void window.dispatchEvent(new HashChangeEvent('hashchange')))
    await settle(350)

    expect(editorView().state.doc.toString()).toBe(SHARED)
    expect(loadDoc()).toMatchObject({ code: SHARED, title: 'shared', settings: { curve: 'step' } })
    expect(loadHistory()[0]).toMatchObject({ code: DRAFT, title: 'mine' })
    expect(location.hash).toBe('')
  })
})

describe('opening files', () => {
  it('extracts the mermaid block from a CRLF Markdown file', async () => {
    await mount()
    const md = '# Notes\r\n\r\nSome text before.\r\n\r\n```mermaid\r\nflowchart TD\r\n    A[From CRLF md] --> B\r\n```\r\n\r\nMore prose\r\n'
    const drop = new Event('drop', { cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files: [new File([md], 'notes.md')] } })
    await act(async () => void window.dispatchEvent(drop))
    await settle(350)

    const expected = 'flowchart TD\n    A[From CRLF md] --> B'
    expect(editorView().state.doc.toString()).toBe(expected)
    expect(loadDoc()).toMatchObject({ code: expected, title: 'notes' })
  })
})

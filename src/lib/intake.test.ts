// App-level: share links and files the app cannot open are refused out loud, and leave the current diagram alone
import { EditorView } from '@codemirror/view'
import { StrictMode, act, createElement } from 'react'
import { type Root, createRoot } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { t } from './i18n'
import { DEFAULT_SETTINGS } from './mermaid'
import { loadDoc, saveDoc } from './storage'

vi.mock('./mermaid', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./mermaid')>()),
  validate: async () => null,
  renderDiagram: async () => ({ svg: '<svg viewBox="0 0 10 10"></svg>', diagramType: 'flowchart', ms: 1 }),
}))

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('matchMedia', (query: string) => ({ media: query, matches: true, addEventListener() {}, removeEventListener() {} }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

const MINE = 'flowchart TD\n    A[MY WORK] --> B'
let root: Root
let host: HTMLDivElement

async function mount() {
  host = document.body.appendChild(document.createElement('div'))
  root = createRoot(host)
  await act(async () => root.render(createElement(StrictMode, null, createElement(App))))
  await settle()
}
const settle = (ms = 10) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))
const code = () => EditorView.findFromDOM(document.querySelector<HTMLElement>('.cm-editor')!)!.state.doc.toString()
const toasts = () => [...document.querySelectorAll('[role=status]')].map((el) => el.textContent)

beforeEach(() => {
  localStorage.clear()
  saveDoc({ code: MINE, title: 'mine', settings: DEFAULT_SETTINGS })
  window.history.replaceState(null, '', '/')
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('broken share links', () => {
  it('says so once and clears the fragment when the page opens with a cut-off link', async () => {
    window.history.replaceState(null, '', '/#pako:eNpNjz1KxEAcxa_y59WzF5jC')
    await mount()
    expect(code()).toBe(MINE)
    expect(location.hash).toBe('')
    expect(toasts().filter((text) => text === t('share.broken'))).toHaveLength(1) // StrictMode runs the effect twice
  })

  it('says so when a damaged link is pasted into an open tab, and leaves other fragments alone', async () => {
    await mount()
    window.history.replaceState(null, '', '/#base64:%%%')
    await act(async () => void window.dispatchEvent(new HashChangeEvent('hashchange')))
    expect(location.hash).toBe('')
    expect(toasts()).toContain(t('share.broken'))
    expect(code()).toBe(MINE)

    window.history.replaceState(null, '', '/#notes')
    await act(async () => void window.dispatchEvent(new HashChangeEvent('hashchange')))
    expect(location.hash).toBe('#notes')
  })
})

describe('dropped files', () => {
  it('refuses an image instead of loading its bytes as code', async () => {
    await mount()
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d])], 'export.png', { type: 'image/png' })
    const drop = new Event('drop', { cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { types: ['Files'], files: [png] } })
    await act(async () => void window.dispatchEvent(drop))
    await settle(350)

    expect(code()).toBe(MINE)
    expect(loadDoc()).toMatchObject({ code: MINE, title: 'mine' })
    expect(toasts()).toContain(t('file.unsupported', { name: 'export.png' }))
  })
})

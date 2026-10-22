// The error card covers the bottom of the editor: scrolling and the last lines must stay above it (flows#1, layout#6)
import { EditorView } from '@codemirror/view'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeAll, expect, it } from 'vitest'
import { Editor, type EditorHandle, useEditor } from './Editor'

beforeAll(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
})

it('reserves the bottom inset for scrolling and padding', async () => {
  let editor: EditorHandle | null = null
  function Probe({ inset }: { inset?: number }) {
    editor = useEditor({ initial: 'flowchart TD\n    A --> B', placeholderText: '', onChange() {}, onCursor() {} })
    return createElement(Editor, { editor, problem: null, bottomInset: inset })
  }
  const root = createRoot(document.body.appendChild(document.createElement('div')))
  const margins = () => editor!.view.state.facet(EditorView.scrollMargins).map((f) => f(editor!.view)?.bottom ?? 0)
  const inset = () => editor!.view.dom.style.getPropertyValue('--editor-inset')

  await act(async () => root.render(createElement(Probe, { inset: 260 })))
  expect(inset()).toBe('260px')
  expect(Math.max(...margins())).toBeGreaterThanOrEqual(260)

  await act(async () => root.render(createElement(Probe, {})))
  expect(inset()).toBe('0px')
  expect(Math.max(0, ...margins())).toBe(0)
  await act(async () => root.unmount())
})

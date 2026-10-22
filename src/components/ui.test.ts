import { Fragment, act, createElement, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Modal, RichText } from './ui'

const html = (text: string) =>
  renderToStaticMarkup(createElement(RichText, { text }))
    .replace(/^<span class="prose-code">|<\/span>$/g, '')
    .replaceAll('<span></span>', '')

describe('RichText', () => {
  it('renders single-backtick spans as code', () => {
    expect(html('Use `-->` between `A` and `B`.')).toBe('<span>Use </span><code>--&gt;</code><span> between </span><code>A</code><span> and </span><code>B</code><span>.</span>')
    expect(html('`라벨`을 따옴표로 감싸세요')).toBe('<code>라벨</code><span>을 따옴표로 감싸세요</span>')
  })

  it('keeps longer backtick runs and unpaired backticks literal', () => {
    expect(html('Remove the ```mermaid fence```')).toBe('<span>Remove the ```mermaid fence```</span>')
    expect(html('``double`` and `x``')).toBe('<span>``double`` and `x``</span>')
    expect(html('```\n`a` then `')).toBe('<span>```\n</span><code>a</code><span> then `</span>')
    expect(html('plain text')).toBe('<span>plain text</span>')
    expect(html('')).toBe('')
  })

  it('uses no regex lookbehind, which Safari < 16.4 cannot parse', () => {
    expect(RichText.toString()).not.toMatch(/\(\?<[!=]/)
  })
})

describe('Modal focus', () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  // jsdom has no layout, so every element would look hidden to the focusable filter
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([new DOMRect()] as unknown as DOMRectList)

  const tab = (shiftKey = false) =>
    act(() => {
      const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true })
      document.activeElement?.dispatchEvent(e)
      return e.defaultPrevented
    })

  function mount(initialFocus?: ReturnType<typeof createRef<HTMLButtonElement>>) {
    const opener = document.body.appendChild(document.createElement('button'))
    opener.focus()
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    const render = (open: boolean) =>
      act(() =>
        root.render(
          createElement(Modal, {
            open,
            onClose() {},
            label: 'Palette',
            initialFocus,
            children: createElement(Fragment, null, createElement('button', null, 'one'), createElement('button', { ref: initialFocus }, 'two')),
          }),
        ),
      )
    return { opener, render }
  }

  it('focuses the first control, keeps Tab inside and returns focus to the opener', async () => {
    const { opener, render } = mount()
    await render(true)
    const dialog = document.querySelector('[role=dialog]')!
    const [one, two] = dialog.querySelectorAll('button')
    expect(dialog.getAttribute('aria-label')).toBe('Palette')
    expect(document.activeElement).toBe(one)
    two.focus()
    expect(await tab()).toBe(true)
    expect(document.activeElement).toBe(one)
    expect(await tab(true)).toBe(true)
    expect(document.activeElement).toBe(two)
    expect(await tab(true)).toBe(false) // from the last control backwards: the browser's own move stays inside
    await render(false)
    expect(document.activeElement).toBe(opener)
  })

  it('starts on initialFocus when given', async () => {
    const ref = createRef<HTMLButtonElement>()
    const { render } = mount(ref)
    await render(true)
    expect(document.activeElement).toBe(ref.current)
    expect(ref.current?.textContent).toBe('two')
    await render(false)
  })
})

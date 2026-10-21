import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RichText } from './ui'

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

import { describe, expect, it } from 'vitest'
import { standaloneSvg, svgSize } from './export'

// mermaid 12 keeps label markup HTML-style, e.g. an unclosed <br> inside foreignObject
const MERMAID_LIKE =
  '<svg id="lagoon-1" width="100%" style="max-width: 320px;" viewBox="0 0 320 120" xmlns="http://www.w3.org/2000/svg">' +
  '<g class="node"><foreignObject width="200" height="48"><div><span class="nodeLabel"><p>첫 줄<br>둘째 줄 &amp; 끝</p></span></div></foreignObject></g></svg>'

describe('standaloneSvg', () => {
  it('turns HTML-style label markup into well-formed XML', () => {
    const file = standaloneSvg(MERMAID_LIKE, '#ffffff')
    const doc = new DOMParser().parseFromString(file, 'image/svg+xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
    expect(file).toContain('둘째 줄')
    expect(file).toMatch(/<br\s*\/>/)
  })

  it('pins the pixel size to the viewBox', () => {
    expect(svgSize(MERMAID_LIKE)).toEqual({ width: 320, height: 120 })
    const file = standaloneSvg(MERMAID_LIKE)
    expect(file).toContain('width="320"')
    expect(file).toContain('height="120"')
    expect(file).not.toContain('max-width')
  })
})

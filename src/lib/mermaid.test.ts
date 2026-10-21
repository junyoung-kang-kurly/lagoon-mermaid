import mermaid from 'mermaid'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, buildConfig, plainTextConfig, renderDiagram } from './mermaid'
import { SAMPLES } from './samples'
import { decodeHash, encodeDoc } from './share'

const HOSTILE = {
  secure: [],
  securityLevel: 'loose',
  startOnLoad: true,
  suppressErrorRendering: false,
  maxTextSize: 100_000_000,
  maxEdges: 10_000_000,
  fontSize: 18,
  gantt: { barHeight: 30 },
}
const edges = (n: number) => 'flowchart TD\n' + Array.from({ length: n }, (_, i) => `  n${i} --> n${i + 1}`).join('\n')
const errorOf = (code: string) => mermaid.parse(code).then(() => null, (e: Error) => e.message.split('\n')[0])

describe('buildConfig: mermaid secure keys', () => {
  afterAll(() => mermaid.initialize(buildConfig(DEFAULT_SETTINGS, true)))

  it('drops them from the advanced JSON and pins mermaid defaults', () => {
    const cfg = buildConfig({ ...DEFAULT_SETTINGS, advanced: JSON.stringify(HOSTILE) }, true)
    expect(cfg).toMatchObject({ securityLevel: 'strict', startOnLoad: false, suppressErrorRendering: true, maxTextSize: 50_000, maxEdges: 500 })
    expect(cfg).not.toHaveProperty('secure')
    // everything else in the JSON still applies
    expect(cfg).toMatchObject({ fontSize: 18, gantt: { barHeight: 30 } })
    expect(cfg.themeCSS).toContain('word-break: keep-all')
  })

  it('a shared link cannot lift the edge limit', async () => {
    const code = edges(5_000)
    const hash = encodeDoc({ code, title: '', settings: { ...DEFAULT_SETTINGS, advanced: JSON.stringify(HOSTILE) } }, true)
    const shared = decodeHash('#' + hash)!
    expect(shared.code).toBe(code)
    mermaid.initialize(buildConfig(shared.settings, true))
    expect(mermaid.mermaidAPI.getSiteConfig()).toMatchObject({ maxTextSize: 50_000, maxEdges: 500, securityLevel: 'strict' })
    expect(await errorOf(code)).toMatch(/Edge limit exceeded/)
    expect(await errorOf(edges(100))).toBeNull()
  })
})

describe('plainTextConfig (PNG export fallback)', () => {
  beforeAll(() => {
    // enough geometry for mermaid to lay out in jsdom
    const proto = SVGElement.prototype as unknown as { getBBox(): DOMRect; getComputedTextLength(): number }
    proto.getBBox = () => new DOMRect(0, 0, 40, 16)
    proto.getComputedTextLength = () => 40
    HTMLCanvasElement.prototype.getContext = () => null // jsdom only warns that it has no canvas
  })

  it('switches off every foreignObject label source, keeping the rest of the config', () => {
    const config = buildConfig({ ...DEFAULT_SETTINGS, curve: 'step', advanced: '{"journey":{"taskMargin":40}}' }, true)
    const plain = plainTextConfig(config)
    expect(plain).toMatchObject({ htmlLabels: false, flowchart: { htmlLabels: false, curve: 'step' }, journey: { textPlacement: 'tspan', taskMargin: 40 } })
    expect(plain.themeVariables).toEqual(config.themeVariables)
  })

  it('renders every sample without <foreignObject>', async () => {
    const config = buildConfig(DEFAULT_SETTINGS, true)
    const journey = SAMPLES.find((s) => s.id === 'journey')!.code
    expect((await renderDiagram(journey, config)).svg).toContain('<foreignObject') // what Safari chokes on
    let rendered = 0
    for (const sample of SAMPLES) {
      const out = await renderDiagram(sample.code, plainTextConfig(config)).catch(() => null) // architecture needs real layout
      if (!out) continue
      expect(out.svg, sample.id).not.toContain('<foreignObject')
      rendered++
    }
    expect(rendered).toBeGreaterThanOrEqual(SAMPLES.length - 1)
  }, 60_000)
})

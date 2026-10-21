import { deflate, inflate } from 'pako'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type DiagramSettings } from './mermaid'
import { decodeHash, encodeDoc } from './share'

const CODE = 'flowchart LR\n  a["한글 💡"] --> b'
const roundTrip = (settings: Partial<DiagramSettings>) => decodeHash('#' + encodeDoc({ code: CODE, title: 't', settings: { ...DEFAULT_SETTINGS, ...settings } }, true))!
const pakoHash = (state: unknown) => '#pako:' + btoa(String.fromCharCode(...deflate(new TextEncoder().encode(JSON.stringify(state)))))

describe('share links: edge curve', () => {
  it('round-trips every curve', () => {
    for (const curve of ['basis', 'linear', 'step', 'cardinal'] as const) expect(roundTrip({ curve }).settings.curve).toBe(curve)
  })

  it('writes the curve where mermaid.live reads it, and only when it is not the default', () => {
    const config = (curve: DiagramSettings['curve']) => {
      const hash = encodeDoc({ code: CODE, title: '', settings: { ...DEFAULT_SETTINGS, curve } }, true)
      const bytes = Uint8Array.from(atob(hash.slice(5).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
      const state = JSON.parse(inflate(bytes, { toText: true }))
      return JSON.parse(state.mermaid)
    }
    expect(config('step').flowchart).toEqual({ curve: 'step' })
    expect(config('basis').flowchart).toBeUndefined()
  })

  it('keeps other flowchart keys in the advanced JSON and takes the curve out of it', () => {
    const d = roundTrip({ curve: 'linear', advanced: '{"flowchart":{"nodeSpacing":80}}' })
    expect(d.settings.curve).toBe('linear')
    expect(JSON.parse(d.settings.advanced)).toEqual({ flowchart: { nodeSpacing: 80 } })
    expect(roundTrip({ curve: 'step' }).settings.advanced).toBe('')
  })

  it('reads a mermaid.live flowchart.curve and leaves curves Lagoon has no button for in advanced', () => {
    expect(decodeHash(pakoHash({ code: CODE, mermaid: '{"flowchart":{"curve":"step"}}' }))!.settings).toMatchObject({ curve: 'step', advanced: '' })
    const other = decodeHash(pakoHash({ code: CODE, mermaid: '{"flowchart":{"curve":"monotoneX"}}' }))!.settings
    expect(other.curve).toBe('basis')
    expect(JSON.parse(other.advanced)).toEqual({ flowchart: { curve: 'monotoneX' } })
  })
})

describe('share links: inflated size cap', () => {
  it('rejects a small hash that inflates past the cap', () => {
    const code = 'flowchart TD\n' + '%% x\n'.repeat(4_000_000) // 20 MB of code from a ~47 KB hash
    const hash = encodeDoc({ code, title: '', settings: DEFAULT_SETTINGS }, true)
    expect(hash.length).toBeLessThan(60_000)
    const started = performance.now()
    expect(decodeHash('#' + hash)).toBeNull()
    expect(performance.now() - started).toBeLessThan(1_000)
  })

  it('still decodes large real diagrams', () => {
    const code = 'flowchart TD\n' + Array.from({ length: 20_000 }, (_, i) => `  n${i}["노드 ${i}"] --> n${i + 1}`).join('\n')
    expect(decodeHash('#' + encodeDoc({ code, title: '', settings: DEFAULT_SETTINGS }, true))?.code).toBe(code)
  })

  it('returns null for corrupt or truncated streams', () => {
    const hash = encodeDoc({ code: CODE, title: '', settings: DEFAULT_SETTINGS }, true)
    expect(decodeHash('#' + hash.slice(0, -8))).toBeNull()
    expect(decodeHash('#pako:AAAA')).toBeNull()
    expect(decodeHash('#' + hash)?.code).toBe(CODE)
  })
})

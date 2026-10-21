import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'
import { diagnose } from './diagnose'
import { explain } from './explain'
import { autoFix } from './fix/engine'
import { BROKEN_SAMPLE, SAMPLES, WELCOME } from './samples'

const validate = async (code: string) => {
  try {
    await mermaid.parse(code)
    return null
  } catch (e) {
    return diagnose(code, e)
  }
}

beforeAll(() => mermaid.initialize({ startOnLoad: false }))

describe('samples', () => {
  for (const s of SAMPLES) {
    it(`${s.id} parses`, async () => {
      const d = await validate(s.code)
      expect(d?.message ?? null).toBeNull()
    })
  }
  it('welcome diagrams parse', async () => {
    expect(await validate(WELCOME.ko)).toBeNull()
    expect(await validate(WELCOME.en)).toBeNull()
  })
  it('broken sample is fully repaired without dropping lines', async () => {
    const r = await autoFix(BROKEN_SAMPLE, validate)
    expect(r.ok).toBe(true)
    expect(r.steps.some((s) => s.lossy)).toBe(false)
    expect(r.steps.length).toBeGreaterThanOrEqual(5)
  })
})

describe('explain', () => {
  it('explains the parens-in-label mistake in Korean', async () => {
    const code = 'flowchart TD\n  A[Start (beta)] --> B'
    const e = explain('ko', code, (await validate(code))!)
    expect(e.title).toContain('(')
    expect(e.hint).toContain('"Start (beta)"')
  })
  it('explains the reserved end keyword', async () => {
    const code = 'flowchart TD\n  A --> end'
    expect(explain('en', code, (await validate(code))!).title).toContain('reserved')
  })
  it('names invisible characters', async () => {
    const code = 'flowchart TD\n  A --> B​'
    expect(explain('ko', code, (await validate(code))!).detail).toContain('U+200B')
  })
})

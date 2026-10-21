// Regressions the independent verification found after the review fixes landed.
import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'
import { diagnose } from './diagnose'
import { explain } from './explain'
import { autoFix } from './fix/engine'

let calls = 0
const validate = async (code: string) => {
  calls++
  try {
    await mermaid.parse(code)
    return null
  } catch (e) {
    return diagnose(code, e)
  }
}

beforeAll(() => mermaid.initialize({ startOnLoad: false }))

describe('spaced node ids', () => {
  it('renames the id in style, class and click statements too', async () => {
    const code = [
      'flowchart TD',
      '  My Node --> B',
      '  style My Node fill:#f00',
      '  classDef hot fill:#f80',
      '  class My Node,B hot',
      '  click My Node callback',
    ].join('\n')
    const r = await autoFix(code, validate)
    expect(r.ok).toBe(true)
    expect(r.steps.some((s) => s.lossy)).toBe(false)
    expect(r.code).toContain('My_Node["My Node"] --> B')
    expect(r.code).toContain('style My_Node fill:#f00')
    expect(r.code).toContain('class My_Node,B hot')
    expect(r.code).toContain('click My_Node callback')
    expect(r.code).toContain('classDef hot fill:#f80')
  })
})

describe('keyword typo explanation on task lines', () => {
  async function explained(code: string) {
    const d = await validate(code)
    expect(d).not.toBeNull()
    return explain('en', code, d!).title
  }

  it('treats a capitalized task name with a schedule as a task missing its colon', async () => {
    expect(await explained('gantt\n  dateFormat YYYY-MM-DD\n  section A\n  Sections review 2024-01-01, 3d')).toBe('Task details missing')
  })

  it('does not read a journey task as a misspelled `title`', async () => {
    expect(await explained('journey\n  title X\n  section A\n    Titles and slides')).not.toContain('Unknown keyword')
  })

  it('still catches a real keyword typo', async () => {
    expect(await explained('gantt\n  dateFormt YYYY-MM-DD\n  section A\n  Task : 2024-01-01, 3d')).toBe('Unknown keyword `dateFormt`')
  })
})

describe('background search', () => {
  const broken = 'flowchart TD\n' + Array.from({ length: 200 }, (_, i) => `  n${i} -> n${i + 1}`).join('\n')

  it('stops as soon as it is aborted', async () => {
    const search = new AbortController()
    calls = 0
    const pending = autoFix(broken, async (code) => {
      if (calls === 5) search.abort()
      return validate(code)
    }, { signal: search.signal })
    const r = await pending
    expect(r.ok).toBe(false)
    expect(calls).toBeLessThan(15)
  })

  it('does nothing when already aborted', async () => {
    const search = new AbortController()
    search.abort()
    const r = await autoFix(broken, validate, { signal: search.signal })
    expect(r.steps).toEqual([])
  })
})

// A label left open before a link: `A[Start --> B[End]` must close A, not quote A's label over B (flows#3)
import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'
import { diagnose } from './diagnose'
import { explain } from './explain'
import { autoFix } from './fix/engine'
import { translate } from './i18n'

const validate = async (code: string) => {
  try {
    await mermaid.parse(code)
    return null
  } catch (e) {
    return diagnose(code, e)
  }
}

beforeAll(() => mermaid.initialize({ startOnLoad: false }))

const UNCLOSED: Array<[string, string]> = [
  ['A[Start --> B[End]', 'A[Start] --> B[End]'],
  ['A[Start --> B[End] --> C', 'A[Start] --> B[End] --> C'],
  ['A(Start --> B(End)', 'A(Start) --> B(End)'],
  ['A{Start --> B{End}', 'A{Start} --> B{End}'],
  ['A[Start --> B(End)', 'A[Start] --> B(End)'],
  ['A[Start -.-> B[End]', 'A[Start] -.-> B[End]'],
  ['A[Start ==> B[End]', 'A[Start] ==> B[End]'],
  ['A[Start --- B[End]', 'A[Start] --- B[End]'],
  ['A[Start -->|go| B[End]', 'A[Start] -->|go| B[End]'],
]

describe('auto-fix closes the label instead of merging nodes', () => {
  for (const [broken, fixed] of UNCLOSED) {
    it(broken, async () => {
      const r = await autoFix(`flowchart TD\n    ${broken}`, validate)
      expect(r.ok).toBe(true)
      expect(r.code).toBe(`flowchart TD\n    ${fixed}`)
      expect(r.steps.map((s) => s.ruleId)).toEqual(['unclosed'])
    })
  }

  for (const [code, fixed] of [
    ['A[Start --> B[End]]', 'A["Start --> B[End]"]'],
    ['A[Start --> B(End)]', 'A["Start --> B(End)"]'],
    ['A[Start (beta)] --> B[End]', 'A["Start (beta)"] --> B[End]'],
  ]) {
    it(`still quotes a closed label: ${code}`, async () => {
      expect((await autoFix(`flowchart TD\n    ${code}`, validate)).code).toBe(`flowchart TD\n    ${fixed}`)
    })
  }
})

describe('explains it as an unclosed bracket', () => {
  for (const [broken, fixed] of UNCLOSED) {
    it(broken, async () => {
      const code = `flowchart TD\n    ${broken}`
      const d = (await validate(code))!
      const open = broken[1]
      for (const lang of ['ko', 'en'] as const) {
        const e = explain(lang, code, d)
        expect(e.title).toBe(translate(lang, 'explain.unclosed.title', { open }))
        expect(e.hint).toContain(fixed)
      }
      expect(await validate(`flowchart TD\n    ${fixed}`)).toBeNull()
    })
  }

  it('keeps the special-character explanation for a closed label', async () => {
    for (const code of ['flowchart TD\n    A[Start --> B[End]]', 'flowchart TD\n    A[Start (beta)] --> B[End]']) {
      expect(explain('en', code, (await validate(code))!).title).toMatch(/^Special character/)
    }
  })
})

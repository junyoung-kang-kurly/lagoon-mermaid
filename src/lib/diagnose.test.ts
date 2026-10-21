import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'
import { diagnose } from './diagnose'
import { autoFix } from './fix/engine'

const validate = async (code: string) => {
  try {
    await mermaid.parse(code)
    return null
  } catch (e) {
    return diagnose(code, e)
  }
}

beforeAll(() => mermaid.initialize({ startOnLoad: false }))

const at = (code: string, line: number, column: number) => code.split('\n')[line - 1].slice(column)

describe('line map (engine#14)', () => {
  it('skips a %%{init}%% directive that spans lines', async () => {
    const code = '%%{\n  init: { "theme": "dark" }\n}%%\nflowchart TD\n  A[x (y)] --> B'
    expect(await validate(code)).toMatchObject({ line: 5, column: 6 })
    const r = await autoFix(code, validate)
    expect(r.ok).toBe(true)
    expect(r.code).toContain('A["x (y)"]')
    expect(await validate('%%{\n init: {"theme":"dark"}\n}%%\npie\n  "Dogs" 386')).toMatchObject({ line: 5, found: '386' })
  })

  it('skips indented frontmatter', async () => {
    const code = '  ---\n  title: Hi\n  ---\nflowchart TD\n  A[x (y)] --> B'
    expect(await validate(code)).toMatchObject({ line: 5, column: 6 })
    expect((await autoFix(code, validate)).ok).toBe(true)
  })

  it('keeps columns right after a directive on the same line', async () => {
    const code = '%%{init: {"theme":"dark"}}%% flowchart TD\n  A --> B(x (y))'
    const d = await validate(code)
    expect(d?.line).toBe(2)
    expect(at(code, 2, d!.column)).toMatch(/^\(y/)
  })
})

describe('jison positions (engine#17)', () => {
  it('points at the offending token, not the blank before it', async () => {
    const state = 'stateDiagram-v2\n  A -> B : x'
    const s = await validate(state)
    expect(s?.found).toBe('-')
    expect(at(state, 2, s!.column)).toMatch(/^->/)
    const cls = 'classDiagram\n  class A\n  A -> B'
    const c = await validate(cls)
    expect(c).toMatchObject({ line: 3, found: 'B' })
    expect(at(cls, 3, c!.column)).toBe('B')
  })

  it('drops the whitespace a token swallowed after a line break', async () => {
    expect(await validate('flowchart TD\n  A --> end\n  B --> C')).toMatchObject({ found: 'end', length: 3 })
  })
})

describe('langium errors (explain#2)', () => {
  it('takes the lexer error\'s own character and skipped run', async () => {
    expect(await validate('pie\n  "Dogs" : abc')).toMatchObject({ kind: 'lexical', line: 2, column: 11, found: 'abc', expected: [], atEnd: false })
    expect(await validate('pie\n  Dogs : 3')).toMatchObject({ kind: 'lexical', line: 2, column: 2, found: 'Dogs' })
    expect(await validate('architecture-beta\n  service a(server[A]')).toMatchObject({ kind: 'lexical', column: 11, found: '(', expected: [] })
  })

  it('reports a line break as NEWLINE, not as a raw "\\n" or the end of the document', async () => {
    expect(await validate('pie\n  "Dogs"')).toMatchObject({ found: '', foundToken: 'NEWLINE', expected: [':'], atEnd: false })
    expect(await validate('packet-beta\n  0-15')).toMatchObject({ found: '', foundToken: 'NEWLINE', atEnd: false })
  })

  it("reads the `but found: '…'` form and its list of token sequences", async () => {
    expect(await validate('gitGraph\n  commit\n  branch\n  commit')).toMatchObject({
      kind: 'parse',
      line: 3,
      found: '',
      foundToken: 'NEWLINE',
      expected: ['REFERENCE', 'STRING'],
      atEnd: false,
    })
  })

  it('is at the end only when the parser ran out of input', async () => {
    expect(await validate('radar-beta\n  axis a, b\n  curve c{1,2')).toMatchObject({ atEnd: true, foundToken: 'EOF', expected: ['}'] })
  })
})

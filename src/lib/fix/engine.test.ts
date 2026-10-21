import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'
import { diagnose } from '../diagnose'
import { autoFix } from './engine'

const validate = async (code: string) => {
  try {
    await mermaid.parse(code)
    return null
  } catch (e) {
    return diagnose(code, e)
  }
}

beforeAll(() => mermaid.initialize({ startOnLoad: false }))

const cases: Array<{ name: string; code: string; expect?: string; contains?: string[] }> = [
  { name: 'parens in label', code: 'flowchart TD\n  A[Start (beta)] --> B{Is it ok?}', expect: 'flowchart TD\n  A["Start (beta)"] --> B{Is it ok?}' },
  { name: 'korean label with parens', code: 'flowchart TD\n  가[시작 (베타)] --> 나', expect: 'flowchart TD\n  가["시작 (베타)"] --> 나' },
  { name: 'diamond with parens', code: 'flowchart TD\n  A{Is it (ok)?} --> B', expect: 'flowchart TD\n  A{"Is it (ok)?"} --> B' },
  { name: 'edge label with parens', code: 'flowchart TD\n  A -->|go (now)| B', expect: 'flowchart TD\n  A -->|"go (now)"| B' },
  { name: 'quotes inside label', code: 'flowchart TD\n  A-->B[Label with "quotes"]', expect: 'flowchart TD\n  A-->B["Label with #quot;quotes#quot;"]' },
  { name: 'single arrow', code: 'flowchart TD\n  A --> B\n  B -> C', expect: 'flowchart TD\n  A --> B\n  B --> C' },
  { name: 'fat arrow', code: 'flowchart TD\n  A => B', expect: 'flowchart TD\n  A ==> B' },
  { name: 'dotted arrow', code: 'flowchart TD\n  A ..> B', expect: 'flowchart TD\n  A -.-> B' },
  { name: 'double arrow', code: 'flowchart TD\n  A <-> B', expect: 'flowchart TD\n  A <--> B' },
  { name: 'edge text with short arrow', code: 'flowchart TD\n  A -- yes -> B', expect: 'flowchart TD\n  A -- yes --> B' },
  { name: 'em dash arrow', code: 'flowchart TD\n  A —> B', expect: 'flowchart TD\n  A --> B' },
  { name: 'unicode arrow', code: 'flowchart TD\n  A → B', expect: 'flowchart TD\n  A --> B' },
  { name: 'html entity arrow', code: 'flowchart TD\n  A --&gt; B', expect: 'flowchart TD\n  A --> B' },
  { name: 'reserved end', code: 'flowchart TD\n  A --> end\n  end --> C', expect: 'flowchart TD\n  A --> End\n  End --> C' },
  { name: 'unclosed bracket', code: 'flowchart TD\n  A[hello --> B', expect: 'flowchart TD\n  A[hello] --> B' },
  { name: 'missing subgraph end', code: 'flowchart TD\n  subgraph one\n    A --> B\n', contains: ['end'] },
  { name: 'markdown fences', code: '```mermaid\nflowchart TD\n  A --> B\n```', expect: 'flowchart TD\n  A --> B' },
  { name: 'missing header', code: 'A --> B\nB --> C', expect: 'flowchart TD\nA --> B\nB --> C' },
  { name: 'header typo', code: 'flowchar TD\n  A --> B', expect: 'flowchart TD\n  A --> B' },
  { name: 'invalid direction', code: 'graph TOP\n  A --> B', expect: 'graph TD\n  A --> B' },
  { name: 'lowercase direction', code: 'graph lr\n  A --> B', expect: 'graph LR\n  A --> B' },
  { name: 'slash comments', code: 'flowchart TD\n  // comment\n  A --> B', expect: 'flowchart TD\n  %% comment\n  A --> B' },
  { name: 'zero width space', code: 'flowchart TD\n  A --> B​', expect: 'flowchart TD\n  A --> B' },
  { name: 'spaced node id', code: 'flowchart TD\n  My Node --> B\n  B --> My Node', contains: ['My_Node["My Node"]', 'B --> My_Node'] },
  { name: 'subgraph title with parens', code: 'flowchart TD\n  subgraph My Group (main)\n  A --> B\n  end', contains: ['subgraph My_Group_main["My Group (main)"]'] },
  { name: 'linkstyle case', code: 'flowchart TD\n  A --> B\n  linkstyle 0 stroke:red', contains: ['linkStyle 0'] },
  { name: 'frontmatter offset', code: '---\ntitle: Hi\n---\nflowchart TD\n  %% note\n  A[x (y)] --> B', contains: ['A["x (y)"]'] },
  { name: 'several problems at once', code: '```mermaid\nflowchart TD\n  A[Start (1)] -> B{OK?}\n  B -->|yes (y)| end\n```', contains: ['A["Start (1)"] --> B{OK?}', '|"yes (y)"| End'] },
  { name: 'sequence missing colon', code: 'sequenceDiagram\n  Alice ->> Bob hello', expect: 'sequenceDiagram\n  Alice ->> Bob: hello' },
  { name: 'sequence missing end', code: 'sequenceDiagram\n  loop every min\n    A->>B: hi\n', contains: ['end'] },
  { name: 'sequence typo', code: 'sequenceDiagram\n  participantt A\n  A->>A: hi', expect: 'sequenceDiagram\n  participant A\n  A->>A: hi' },
  { name: 'sequence unicode arrow', code: 'sequenceDiagram\n  A → B: hi', expect: 'sequenceDiagram\n  A ->> B: hi' },
  { name: 'er missing label', code: 'erDiagram\n  CUSTOMER ||--o{ ORDER', expect: 'erDiagram\n  CUSTOMER ||--o{ ORDER : ""' },
  { name: 'state short arrow', code: 'stateDiagram-v2\n  [*] -> A\n  A --> [*]', expect: 'stateDiagram-v2\n  [*] --> A\n  A --> [*]' },
  { name: 'class short arrow', code: 'classDiagram\n  A -> B', expect: 'classDiagram\n  A --> B' },
  { name: 'class inheritance arrow', code: 'classDiagram\n  Animal <| Dog', expect: 'classDiagram\n  Animal <|-- Dog' },
  { name: 'class unclosed body', code: 'classDiagram\n  class A {\n    +foo()\n', contains: ['}'] },
  { name: 'gantt missing colon', code: 'gantt\n  title A\n  dateFormat YYYY-MM-DD\n  section S\n  Task one 2024-01-01, 3d', contains: ['Task one : 2024-01-01, 3d'] },
  { name: 'pie missing colon', code: 'pie title Pets\n  "Dogs" 386\n  "Cats" : 85', expect: 'pie title Pets\n  "Dogs": 386\n  "Cats" : 85' },
  { name: 'gitGraph typo', code: 'gitGraph\n  commit\n  branchh dev', expect: 'gitGraph\n  commit\n  branch dev' },
  { name: 'xy unclosed list', code: 'xychart-beta\n  x-axis [a, b\n  bar [1, 2]', contains: ['x-axis [a, b]'] },
  { name: 'quadrant point', code: 'quadrantChart\n  title T\n  Point A: 0.3, 0.6', contains: ['Point A: [0.3, 0.6]'] },
]

describe('autoFix', () => {
  for (const c of cases) {
    it(c.name, async () => {
      const before = await validate(c.code)
      expect(before, 'case must start broken').not.toBeNull()
      const result = await autoFix(c.code, validate)
      expect(result.remaining, JSON.stringify(result.remaining?.message)).toBeNull()
      expect(result.ok).toBe(true)
      expect(result.steps.some((s) => s.lossy)).toBe(false)
      if (c.expect !== undefined) expect(result.code.trim()).toBe(c.expect.trim())
      for (const part of c.contains ?? []) expect(result.code).toContain(part)
    })
  }

  it('leaves valid diagrams alone', async () => {
    const code = 'flowchart TD\n  A --> B'
    const result = await autoFix(code, validate)
    expect(result).toMatchObject({ ok: true, code, steps: [] })
  })

  it('falls back to commenting out a line it cannot repair', async () => {
    const code = 'flowchart TD\n  A --> B\n  ??? !!! ###\n  B --> C'
    const result = await autoFix(code, validate)
    expect(result.ok).toBe(true)
    expect(result.steps.at(-1)?.lossy).toBe(true)
    expect(result.code).toContain('%% ??? !!! ###')
  })
})

describe('diagnose', () => {
  it('maps lines through frontmatter and comments', async () => {
    const code = '---\ntitle: Hi\n---\n\n%% a comment\nflowchart TD\n  %% another\n  A --> B\n  B[x (y)] --> C'
    const d = await validate(code)
    expect(d?.line).toBe(9)
    expect(code.split('\n')[d!.line - 1].slice(d!.column)).toMatch(/^\(/)
  })

  it('locates lexical errors on the right column', async () => {
    const code = 'flowchart TD\n  A —> B'
    const d = await validate(code)
    expect(d).toMatchObject({ kind: 'lexical', line: 2 })
    expect(code.split('\n')[1][d!.column]).toBe('—')
  })

  it('reports end-of-input errors', async () => {
    const d = await validate('flowchart TD\n  A[hello --> B')
    expect(d?.atEnd).toBe(true)
    expect(d?.expected).toContain('SQE')
  })

  it('reads langium errors', async () => {
    const d = await validate('pie title Pets\n  "Dogs" 386')
    expect(d).toMatchObject({ kind: 'parse', line: 2, column: 9, found: '386', expected: [':'] })
  })
})

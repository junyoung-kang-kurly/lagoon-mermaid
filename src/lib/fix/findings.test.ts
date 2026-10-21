// Regression tests for the auto-fix review findings (engine#0 … engine#16): every repair must parse,
// stay non-lossy unless content is really dropped, and keep the meaning of the diagram.
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

const F = (s: string) => `flowchart TD\n${s}`

/** repairs a broken diagram and checks that the result parses without a lossy step */
async function repair(code: string) {
  expect(await validate(code), 'case must start broken').not.toBeNull()
  const r = await autoFix(code, validate)
  expect(r.remaining?.message ?? null).toBeNull()
  expect(r.steps.filter((s) => s.lossy).map((s) => s.ruleId)).toEqual([])
  return r
}

const fixedCode = async (code: string) => (await repair(code)).code

describe('structure is closed where it belongs', () => {
  it('engine#0: an open ER entity is closed after its attributes, not on the opening line', async () => {
    const r = await repair('erDiagram\n  CUSTOMER {\n    string name\n    int age\n')
    expect(r.code).toBe('erDiagram\n  CUSTOMER {\n    string name\n    int age\n  }\n')
    const db: any = (await mermaid.mermaidAPI.getDiagramFromText(r.code)).db
    expect([...db.getEntities().keys()]).toEqual(['CUSTOMER'])
    expect(db.getEntities().get('CUSTOMER').attributes).toHaveLength(2)
  })

  it('engine#0: two open sibling entities are both closed', async () => {
    expect(await fixedCode('erDiagram\n  CUSTOMER {\n    string name\n  ORDER {\n    int id\n')).toBe(
      'erDiagram\n  CUSTOMER {\n    string name\n  }\n  ORDER {\n    int id\n  }\n',
    )
  })

  it('engine#3: every construct left open at the end of input is closed', async () => {
    expect(await fixedCode(F('  subgraph S\n    subgraph T\n      A --> B'))).toBe(F('  subgraph S\n    subgraph T\n      A --> B\n    end\n  end'))
    expect(await fixedCode('sequenceDiagram\n  loop x\n    alt y\n      A->>B: hi')).toBe('sequenceDiagram\n  loop x\n    alt y\n      A->>B: hi\n    end\n  end')
    expect(await fixedCode(F('  subgraph S\n    A[hello --> B'))).toBe(F('  subgraph S\n    A[hello] --> B\n  end'))
    expect(await fixedCode(F('  subgraph S\n    A["hello'))).toBe(F('  subgraph S\n    A["hello"]\n  end'))
  })

  it('engine#3: `else` at the indentation of its `alt` does not end the block', async () => {
    expect(await fixedCode('sequenceDiagram\n  alt ok\n    A->>B: yes\n  else no\n    A->>B: no')).toBe(
      'sequenceDiagram\n  alt ok\n    A->>B: yes\n  else no\n    A->>B: no\n  end',
    )
  })

  it('engine#8: a composite state closes before the next outdented line', async () => {
    expect(await fixedCode('stateDiagram-v2\n  state X {\n    A --> B\n  [*] --> X')).toBe('stateDiagram-v2\n  state X {\n    A --> B\n  }\n  [*] --> X')
    // without indentation there is no evidence, so the block runs to the end
    expect(await fixedCode('stateDiagram-v2\nstate X {\nA --> B\n[*] --> X')).toBe('stateDiagram-v2\nstate X {\nA --> B\n[*] --> X\n}')
  })

  it('engine#13: a class body left open is closed before the next class', async () => {
    expect(await fixedCode('classDiagram\n  class A {\n    +foo()\n  class B {\n    +bar()\n  }')).toBe(
      'classDiagram\n  class A {\n    +foo()\n  }\n  class B {\n    +bar()\n  }',
    )
  })
})

describe('reserved `end`', () => {
  it('engine#1: an `end;` subgraph terminator stays a terminator', async () => {
    const r = await repair(F('  subgraph S\n    A --> B\n  end;\n  B --> end'))
    expect(r.code).toBe(F('  subgraph S\n    A --> B\n  end;\n  B --> End'))
    expect(r.steps.map((s) => s.ruleId)).toEqual(['reserved-end'])
  })

  it('engine#5: frontmatter, accTitle, accDescr and edge text keep their words', async () => {
    expect(await fixedCode('---\ntitle: start to end\n---\nflowchart TD\n  A --> end')).toBe('---\ntitle: start to end\n---\nflowchart TD\n  A --> End')
    expect(await fixedCode(F('  A -- send to end user --> B\n  B --> end'))).toBe(F('  A -- send to end user --> B\n  B --> End'))
    expect(await fixedCode(F('  accTitle: the end\n  A --> end'))).toBe(F('  accTitle: the end\n  A --> End'))
    expect(await fixedCode(F('  accDescr {\n    the end of it\n  }\n  A --> end'))).toBe(F('  accDescr {\n    the end of it\n  }\n  A --> End'))
    expect(await fixedCode(F('  A["the end"] --> end\n  back-end --> end'))).toBe(F('  A["the end"] --> End\n  back-end --> End'))
  })

  it('engine#5: the new name never merges with an existing node', async () => {
    const r = await repair(F('  A --> end\n  B --> End'))
    expect(r.code).toBe(F('  A --> End_\n  B --> End'))
    expect(r.steps[0].msg).toEqual({ key: 'fix.reservedEndTo', params: { to: 'End_' } })
  })

  it('engine#5: style, class and classDef references are renamed with the node', async () => {
    expect(await fixedCode(F('  A --> end\n  style end fill:#f00\n  classDef end stroke:#0f0\n  class A end'))).toBe(
      F('  A --> End\n  style End fill:#f00\n  classDef End stroke:#0f0\n  class A End'),
    )
  })

  it('engine#11: a subgraph titled "Back end" keeps its edges', async () => {
    expect(await fixedCode(F('  subgraph Back end\n    A --> B\n  end'))).toBe(F('  subgraph Back_end["Back end"]\n    A --> B\n  end'))
    expect(await fixedCode(F('  subgraph Front end\n    UI --> API\n  end\n  subgraph Back end\n    API --> DB\n  end'))).toBe(
      F('  subgraph Front_end["Front end"]\n    UI --> API\n  end\n  subgraph Back_end["Back end"]\n    API --> DB\n  end'),
    )
  })
})

describe('labels and ids', () => {
  const LABELS = [
    '  A[User (browser)] --> B[Load balancer (nginx)]', '  B --> C[API (v1)]', '  C --> D[Auth (JWT)]',
    '  C --> E[Orders (REST)]', '  C --> F[Search (Elastic)]', '  D --> G[(Users DB (PG))]', '  E --> H[(Orders DB (PG))]',
    '  F --> I[(Index (ES))]', '  E --> J[Queue (Kafka)]', '  J --> K[Worker (Go)]', '  K --> L[Email (SES)]',
    '  K --> M[SMS (Twilio)]', '  K --> N[Push (FCM)]',
  ]

  it('engine#2: a dozen labels with parentheses are quoted in one step', async () => {
    const r = await repair(F(LABELS.join('\n')))
    expect(r.steps.map((s) => s.ruleId)).toEqual(['quote-labels'])
    expect(r.code).toContain('K --> N["Push (FCM)"]')
    expect(r.code).toContain('D --> G[("Users DB (PG)")]')
  })

  it('engine#2: long diagrams get enough steps for one fix per line', async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `  N${i} -> N${i + 1}`)
    const r = await repair(F(lines.join('\n')))
    expect(r.steps).toHaveLength(30)
  })

  it('engine#4: spaced ids are renamed as whole node ids only', async () => {
    expect(await fixedCode('---\ntitle: My Node overview\n---\nflowchart TD\n  My Node --> B')).toBe(
      '---\ntitle: My Node overview\n---\nflowchart TD\n  My_Node["My Node"] --> B',
    )
    expect(await fixedCode(F('  My Node --> B\n  Not My Node --> C'))).toBe(F('  My_Node["My Node"] --> B\n  Not_My_Node["Not My Node"] --> C'))
    expect(await fixedCode(F('  A -- via My Node --> B\n  My Node --> C'))).toBe(F('  A -- via My Node --> B\n  My_Node["My Node"] --> C'))
  })

  it('engine#10: path and e-mail labels are quoted instead of commented out', async () => {
    expect(await fixedCode(F('  A[/api/users/:id] --> B'))).toBe(F('  A["/api/users/:id"] --> B'))
    expect(await fixedCode(F('  A --> B[/usr/local/bin]'))).toBe(F('  A --> B["/usr/local/bin"]'))
    expect(await fixedCode(F('  A[user@example.com] --> B'))).toBe(F('  A["user@example.com"] --> B'))
  })

  it('engine#13: mindmap labels are quoted too', async () => {
    expect(await fixedCode('mindmap\n  root((Root))\n    A[Item (detail)]')).toBe('mindmap\n  root((Root))\n    A["Item (detail)"]')
  })

  it('engine#16: a label made of two quoted parts keeps all its quotes', async () => {
    expect(await fixedCode(F('  A["a" and "b"] --> B'))).toBe(F('  A["#quot;a#quot; and #quot;b#quot;"] --> B'))
    expect(await fixedCode(F('  A["say "hi" now"] --> B'))).toBe(F('  A["say #quot;hi#quot; now"] --> B'))
  })
})

describe('text is not rewritten', () => {
  it('engine#6: typography leaves quoted labels, markdown strings and comments alone', async () => {
    expect(await fixedCode(F('  A["Price → Tax"] —> B'))).toBe(F('  A["Price → Tax"] --> B'))
    expect(await fixedCode(F('  A["比率：50%"] —> B'))).toBe(F('  A["比率：50%"] --> B'))
    expect(await fixedCode(F('  %% A → B means go\n  A —> B'))).toBe(F('  %% A → B means go\n  A --> B'))
    expect(await fixedCode(F('  A["`\n# Heading\ntext`"] --> B\n  // c'))).toBe(F('  A["`\n# Heading\ntext`"] --> B\n  %% c'))
  })

  it('engine#6: fixing only the arrow is enough when the label has curly quotes', async () => {
    expect(await fixedCode(F('  A[He said “hi”] —> B'))).toBe(F('  A[He said “hi”] --> B'))
    expect(await fixedCode(F('  A -- yes —> B'))).toBe(F('  A -- yes --> B'))
    expect(await fixedCode('sequenceDiagram\n  A → B： hi → there')).toBe('sequenceDiagram\n  A ->> B: hi → there')
    expect(await fixedCode('pie\n  “Dogs” : 386')).toBe('pie\n  "Dogs" : 386')
  })

  it('engine#7: arrow fixes stop at the message or label text', async () => {
    expect(await fixedCode('sequenceDiagram\n  Alice => Bob: map => reduce')).toBe('sequenceDiagram\n  Alice ->> Bob: map => reduce')
    expect(await fixedCode('sequenceDiagram\n  Alice >> Bob: shift a >> 2')).toBe('sequenceDiagram\n  Alice ->> Bob: shift a >> 2')
    expect(await fixedCode('classDiagram\n  A -> B : uses -> x')).toBe('classDiagram\n  A --> B : uses -> x')
    expect(await fixedCode('stateDiagram-v2\n  A -> B : on x -> y')).toBe('stateDiagram-v2\n  A --> B : on x -> y')
  })

  it('engine#7: a valid bidirectional dotted link next to the error is left alone', async () => {
    expect(await fixedCode(F('  A <-.-> B\n  B -> C'))).toBe(F('  A <-.-> B\n  B --> C'))
  })
})

describe('headers', () => {
  it('engine#9: header typos that mermaid detects by prefix are fixed', async () => {
    expect(await fixedCode('graphTD\n  A --> B')).toBe('graph TD\n  A --> B')
    expect(await fixedCode('flowchartTD\n  A --> B')).toBe('flowchart TD\n  A --> B')
    expect(await fixedCode('stateDiagramv2\n  [*] --> A')).toBe('stateDiagram-v2\n  [*] --> A')
    expect(await fixedCode('sequenceDiagramm\n  A->>B: hi')).toBe('sequenceDiagram\n  A->>B: hi')
    expect(await fixedCode('classDiagramm\n  A <|-- B')).toBe('classDiagram\n  A <|-- B')
  })

  it('engine#9: less common diagram types are not "corrected" into others', async () => {
    expect(await fixedCode('flowchart-elk TD\n  A --> B[x (y)]')).toBe('flowchart-elk TD\n  A --> B["x (y)"]')
  })

  it('engine#12: a missing header goes below the frontmatter', async () => {
    expect(await fixedCode('---\ntitle: X\n---\nA --> B')).toBe('---\ntitle: X\n---\nflowchart TD\nA --> B')
    expect(await fixedCode('---\ntitle: flowchart\n---\nA --> B')).toBe('---\ntitle: flowchart\n---\nflowchart TD\nA --> B')
  })
})

describe('small grammar slips', () => {
  it('engine#13: `;` in sequence message text is escaped', async () => {
    expect(await fixedCode('sequenceDiagram\n  Alice->>Bob: Hello; how are you?\n  Bob-->>Alice: fine; thanks')).toBe(
      'sequenceDiagram\n  Alice->>Bob: Hello#59; how are you?\n  Bob-->>Alice: fine#59; thanks',
    )
    expect(await fixedCode('sequenceDiagram\n  Note over A: x; y')).toBe('sequenceDiagram\n  Note over A: x#59; y')
    expect(await fixedCode('sequenceDiagram\n  A->>B: say #quot;hi#quot;; ok')).toBe('sequenceDiagram\n  A->>B: say #quot;hi#quot;#59; ok')
  })

  it('engine#13: `Note right X` gets its `of`', async () => {
    expect(await fixedCode('sequenceDiagram\n  Alice->>Bob: hi\n  Note right Alice: thinking')).toBe('sequenceDiagram\n  Alice->>Bob: hi\n  Note right of Alice: thinking')
  })

  it('engine#13: class generics use `~T~`', async () => {
    expect(await fixedCode('classDiagram\n  class Box<T>\n  Box<T> <|-- IntBox')).toBe('classDiagram\n  class Box~T~\n  Box~T~ <|-- IntBox')
    // member text inside a class body stays as written
    expect(await fixedCode('classDiagram\n  class A {\n    +List<int> items\n  }\n  A <|-- B<T>')).toBe(
      'classDiagram\n  class A {\n    +List<int> items\n  }\n  A <|-- B~T~',
    )
  })
})

describe('markdown fences', () => {
  it('engine#15: extra fenced diagrams are kept as comments and the step is flagged lossy', async () => {
    const code = '```mermaid\nflowchart TD\n  A --> B\n```\n\n```mermaid\nsequenceDiagram\n  A->>B: hi\n```'
    const r = await autoFix(code, validate)
    expect(r.ok).toBe(true)
    expect(r.steps.map((s) => [s.ruleId, s.lossy])).toEqual([['fences', true]])
    expect(r.code).toBe('flowchart TD\n  A --> B\n\n%% sequenceDiagram\n%%   A->>B: hi')
  })

  it('engine#15: a single fenced diagram is not lossy, and other languages are skipped', async () => {
    expect(await fixedCode('```js\nconsole.log(1)\n```\n```mermaid\nflowchart TD\n  A --> B\n```')).toBe('flowchart TD\n  A --> B')
  })
})

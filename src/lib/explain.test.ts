import mermaid from 'mermaid'
import { beforeAll, describe, expect, it } from 'vitest'
import { type Diagnostic, diagnose } from './diagnose'
import { explain, humanToken } from './explain'
import explainSource from './explain.ts?raw'
import { DICTS, type Lang, translate } from './i18n'

const validate = async (code: string) => {
  try {
    await mermaid.parse(code)
    return null
  } catch (e) {
    return diagnose(code, e)
  }
}

const explainBoth = async (code: string) => {
  const d = await validate(code)
  expect(d, 'case must be broken').not.toBeNull()
  return { ko: explain('ko', code, d!), en: explain('en', code, d!) }
}

const parses = async (code: string) => expect((await validate(code))?.message ?? null).toBeNull()

const text = (e: { title: string; detail: string; hint?: string }) => `${e.title}\n${e.detail}\n${e.hint ?? ''}`

beforeAll(() => mermaid.initialize({ startOnLoad: false }))

describe('sequence arrows (explain#0)', () => {
  for (const [code, arrow] of [
    ['sequenceDiagram\n  Alice=>Bob: hi', '=>'],
    ['sequenceDiagram\n  A > B: hi', '>'],
    ['sequenceDiagram\n  A —>> B: hi', '—>>'],
    ['sequenceDiagram\n  Alice-Bob: hi', '-'],
  ]) {
    it(`blames the arrow in ${JSON.stringify(code)}`, async () => {
      const { ko, en } = await explainBoth(code)
      expect(ko.title).toBe('메시지 화살표 모양이 올바르지 않아요')
      expect(ko.detail).toContain(`\`${arrow}\`은(는) sequenceDiagram 화살표가 아니에요`)
      expect(ko.hint).toContain('`->>`')
      expect(en.title).toBe('Invalid message arrow')
      expect(en.detail).toContain(`\`${arrow}\` at line 2`)
      expect(text(ko)).not.toContain('`:`이 필요')
      expect(text(en)).not.toContain('Missing `:`')
    })
  }

  it('still explains a genuinely missing colon', async () => {
    for (const code of ['sequenceDiagram\n  Alice->>Bob hello', 'sequenceDiagram\n  Alice->>+Bob hello']) {
      const { ko, en } = await explainBoth(code)
      expect(ko.title).toBe('메시지 앞에 `:`이 필요해요')
      expect(en.title).toBe('Missing `:` before the message')
    }
  })

  it('the arrow in the hint parses', () => parses('sequenceDiagram\n  Alice->>Bob: hi'))
})

describe('end of document (explain#1)', () => {
  for (const [code, closer, fixed] of [
    ['flowchart TD\n  A{hello', '}', 'flowchart TD\n  A{hello}'],
    ['flowchart TD\n  A[hello --> B', ']', 'flowchart TD\n  A[hello] --> B'],
    ['flowchart TD\n  A -->|yes B', '|', 'flowchart TD\n  A -->|yes| B'],
    ['flowchart TD\n  A["hello] --> B', '"', 'flowchart TD\n  A["hello"] --> B'],
    ['flowchart TD\n  A[(hello', ')]', 'flowchart TD\n  A[(hello)]'],
    ['flowchart TD\n  A[hello\n', ']', 'flowchart TD\n  A[hello]\n'],
    ['classDiagram\n  class A~T', '~', 'classDiagram\n  class A~T~'],
    ['classDiagram\n  class A {\n    +foo()\n', '}', 'classDiagram\n  class A {\n    +foo()\n  }\n'],
    ['flowchart TD\n  subgraph one\n    A --> B\n', 'end', 'flowchart TD\n  subgraph one\n    A --> B\n  end\n'],
    ['erDiagram\n  CUSTOMER {\n    string name\n', '}', 'erDiagram\n  CUSTOMER {\n    string name\n  }\n'],
  ]) {
    it(`asks for ${closer} in ${JSON.stringify(code)}`, async () => {
      const { ko, en } = await explainBoth(code)
      expect(ko.hint).toBe(`\`${closer}\`로 닫아 주세요.`)
      expect(en.hint).toBe(`Close it with \`${closer}\`.`)
      await parses(fixed)
    })
  }

  for (const code of ['flowchart TD\n  A -->', 'flowchart TD\n  A --> B\n  click A', '%%{init: {"theme":"dark"}}%%\nflowchart TD\n  A -->']) {
    it(`does not claim something is open in ${JSON.stringify(code)}`, async () => {
      const { ko, en } = await explainBoth(code)
      expect(ko.detail).toMatch(/^\d+번째 줄, \d+번째 칸에서 문장이 완성되기 전에 문서가 끝났어요\.$/)
      expect(en.detail).toMatch(/^The document ended at line \d+, column \d+ before the statement was complete\.$/)
      expect(ko.hint).toMatch(/^여기에는 .+ 올 수 있어요\.$/)
      expect(en.hint).toMatch(/^Allowed here: .+\.$/)
    })
  }
})

describe('line breaks from Langium (explain#2, explain.ts side)', () => {
  const base: Diagnostic = { kind: 'parse', message: '', line: 2, column: 8, length: 1, found: '', expected: [], atEnd: false }

  it('never puts a raw newline inside a code span', async () => {
    for (const code of ['pie\n  "Dogs" : abc', 'pie\n  "Dogs"', 'packet-beta\n  0-15', 'pie\n  "Dogs" :']) {
      const { ko, en } = await explainBoth(code)
      for (const field of [ko.title, ko.detail, ko.hint, en.title, en.detail, en.hint]) expect(field ?? '').not.toContain('\n')
    }
  })

  it('names the character under the lexer error', async () => {
    const { ko, en } = await explainBoth('pie\n  "Dogs" : abc')
    expect(ko.detail).toMatch(/`a(bc)?`/)
    expect(en.detail).toMatch(/`a(bc)?`/)
  })

  it('renders the old literal "\\n" shape as a line break', () => {
    const d = { ...base, found: '\n', expected: [':'] }
    expect(explain('ko', 'pie\n  "Dogs"', d).detail).toBe('2번째 줄, 9번째 칸에서 `:` 기호를 기대했는데 줄바꿈이 나왔어요.')
    expect(explain('en', 'pie\n  "Dogs"', d).detail).toBe('At line 2, column 9 the parser expected `:` but found a line break.')
  })

  it('renders the new empty NEWLINE shape the same way', () => {
    const d = { ...base, found: '', foundToken: 'NEWLINE', expected: [':'] }
    expect(explain('ko', 'pie\n  "Dogs"', d).detail).toContain('줄바꿈이 나왔어요')
    expect(explain('en', 'pie\n  "Dogs"', d).detail).toContain('found a line break')
  })

  it('does not say the document ended when later lines follow', async () => {
    const code = 'gitGraph\n  commit\n  branch\n  commit'
    const old = { ...base, line: 3, found: '', foundToken: 'EOF', atEnd: true }
    const fresh = { ...base, line: 3, found: '', foundToken: 'NEWLINE', expected: ['REFERENCE', 'STRING'] }
    for (const d of [old, fresh, (await validate(code))!]) {
      const ko = explain('ko', code, d)
      const en = explain('en', code, d)
      expect(ko.title).toBe('문법 오류')
      expect(ko.detail).toContain('줄바꿈에서 해석이 멈췄어요')
      expect(en.detail).toContain('a line break')
      expect(text(ko)).not.toContain('문서가 끝났')
      expect(text(en)).not.toContain('ended')
    }
    expect(explain('ko', code, fresh).hint).toBe('여기에는 이름, "문자열" 중 하나가 올 수 있어요.')
    expect(explain('en', code, fresh).hint).toBe('Allowed here: name, "string".')
  })

  it('quotes an unquoted pie label', async () => {
    const { ko, en } = await explainBoth('pie\n  Dogs : 3')
    expect(ko.hint).toBe('pie 라벨은 큰따옴표로 감싸세요: `"Dogs" : 3`')
    expect(en.hint).toBe('Wrap pie labels in double quotes: `"Dogs" : 3`')
    await parses('pie\n  "Dogs" : 3')
  })

  it('asks to close an unterminated pie string', async () => {
    const { ko, en } = await explainBoth('pie\n  "Dogs : 3')
    expect(ko.detail).toContain('`"')
    expect(ko.detail).not.toContain('`:`')
    expect(ko.hint).toBe('`"`로 닫아 주세요.')
    expect(en.hint).toBe('Close it with `"`.')
  })
})

describe('token names (explain#3)', () => {
  it('reads xychart keywords as keywords', async () => {
    const { ko, en } = await explainBoth('xychart-beta\n  bars [1, 2]')
    for (const e of [ko, en]) {
      expect(e.expected).toEqual(expect.arrayContaining(['`title`', '`x-axis`', '`y-axis`', '`line`', '`bar`']))
      expect(e.expected).not.toContain('`--`')
    }
    await parses('xychart-beta\n  bar [1, 2]')
  })

  it('keeps `--` for classDiagram lines', async () => {
    const { en } = await explainBoth('classDiagram\n  A <| B')
    expect(en.hint).toBe('Allowed here: `--`, `..`.')
  })

  it('lists note placements', async () => {
    const { ko, en } = await explainBoth('sequenceDiagram\n  Note A: hi')
    expect(ko.hint).toBe('여기에는 `over`, `left of`, `right of` 중 하나가 올 수 있어요.')
    expect(en.hint).toBe('Allowed here: `over`, `left of`, `right of`.')
    await parses('sequenceDiagram\n  Note right of A: hi')
  })

  it('explains ER attributes', async () => {
    const { ko, en } = await explainBoth('erDiagram\n  CUSTOMER {\n    name\n  }')
    expect(ko.detail).toBe('엔터티 속성은 `타입 이름` 형식이에요.')
    expect(ko.hint).toBe('예: `string name`')
    expect(en.detail).toBe('Entity attributes are written as `type name`.')
    expect(en.hint).toBe('e.g. `string name`')
    await parses('erDiagram\n  CUSTOMER {\n    string name\n  }')
  })

  it('asks for a number', async () => {
    for (const code of ['pie\n  "Dogs" :', 'xychart-beta\n  bar [1, 2,]']) {
      const { ko, en } = await explainBoth(code)
      expect(ko.hint).toBe('여기에는 숫자가 와야 해요.')
      expect(en.hint).toBe('Expected here: number.')
    }
  })

  it('maps tokens per family', () => {
    expect(humanToken('en', 'LINE', 'xy')).toBe('`line`')
    expect(humanToken('en', 'LINE', 'class')).toBe('`--`')
    expect(humanToken('en', 'X_AXIS', 'xy')).toBe('`x-axis`')
    expect(humanToken('en', 'BLOCK_STOP')).toBe('`}`')
    expect(humanToken('ko', 'REFERENCE')).toBe('이름')
    expect(humanToken('ko', 'NUMBER_PIE')).toBe('숫자')
    expect(humanToken('en', 'left_of')).toBe('`left of`')
  })
})

describe('flowchart direction (explain#4)', () => {
  for (const [code, dir, fix] of [
    ['graph TOP\n  A --> B', 'TOP', 'graph TD'],
    ['graph lr\n  A --> B', 'lr', 'graph LR'],
    ['flowchart SIDEWAYS\n  A --> B', 'SIDEWAYS', 'flowchart TD'],
  ]) {
    it(`explains ${dir}`, async () => {
      const { ko, en } = await explainBoth(code)
      expect(ko.title).toBe(`지원하지 않는 방향이에요: \`${dir}\``)
      expect(ko.hint).toBe(`예: \`${fix}\``)
      expect(en.title).toBe(`Unsupported direction \`${dir}\``)
      expect(en.detail).toBe('The direction after `graph`/`flowchart` must be `TD`, `TB`, `BT`, `LR` or `RL`.')
      expect(en.hint).toBe(`e.g. \`${fix}\``)
      await parses(code.replace(/^\S+ \S+/, fix))
    })
  }

  it('leaves valid directions alone when the header line has another error', async () => {
    expect((await explainBoth('graph TD; A-->B[x (y)]')).en.title).toBe('Special character `(` inside a label')
    for (const dir of ['BR', '<', '>', '^', 'v']) await parses(`graph ${dir}\n  A --> B`)
  })
})

describe('stray end (explain#5)', () => {
  for (const code of [
    'flowchart TD\n  A --> B\n  end',
    'sequenceDiagram\n  A->>B: hi\n  end',
    'flowchart TD\n  subgraph one\n    A --> B\n  end\n  end',
    'sequenceDiagram\n  loop x\n    A->>B: hi\n  end\n  end %% extra',
    'sequenceDiagram\n  A->>B: hi\n  END',
  ]) {
    it(`calls it unmatched in ${JSON.stringify(code)}`, async () => {
      const { ko, en } = await explainBoth(code)
      expect(ko.title).toBe('짝이 없는 `end`가 있어요')
      expect(ko.hint).toBe('남는 `end` 줄을 지우거나 위에 블록 시작 줄을 추가하세요.')
      expect(en.title).toBe('Unmatched `end`')
      expect(en.detail).toContain('no open block')
      expect(text(ko) + text(en)).not.toContain('done["end"]')
    })
  }

  it('keeps the reserved-word explanation for an `end` node', async () => {
    const { ko, en } = await explainBoth('flowchart TD\n  A --> end')
    expect(ko.title).toBe('`end`는 예약어예요')
    expect(en.hint).toContain('done["end"]')
  })

  it('does not suggest a flowchart label in sequence diagrams', async () => {
    const { ko, en } = await explainBoth('sequenceDiagram\n  A->>end: hi')
    expect(ko.hint).toBe('`finish`, `done`처럼 다른 이름으로 바꾸세요.')
    expect(en.hint).toBe('Rename it, e.g. `finish` or `done`.')
    expect(en.detail).not.toContain('node')
    await parses('sequenceDiagram\n  A->>finish: hi')
    await parses('sequenceDiagram\n  A->>done: hi')
  })
})

describe('quotes inside labels (explain#6)', () => {
  it('names the quote and suggests #quot;', async () => {
    const { ko, en } = await explainBoth('flowchart TD\n  A[say "hi"] --> B')
    expect(ko.title).toBe('라벨 안에 특수문자 `"`가 있어요')
    expect(ko.hint).toBe('라벨 안의 큰따옴표는 `#quot;`로 쓰세요: `A["say #quot;hi#quot;"]`')
    expect(en.title).toBe('Special character `"` inside a label')
    expect(en.hint).toBe('Write inner quotes as `#quot;`: `A["say #quot;hi#quot;"]`')
    await parses('flowchart TD\n  A["say #quot;hi#quot;"] --> B')
  })
})

describe('task lines (explain#7)', () => {
  it('teaches the journey format', async () => {
    const { ko, en } = await explainBoth('journey\n  title X\n  section A\n    Make tea')
    expect(ko.detail).toBe('journey의 작업은 `작업 이름: 점수(1~5): 참여자` 형식이에요.')
    expect(ko.hint).toBe('예: `차 끓이기: 5: 나`')
    expect(en.detail).toBe('Journey tasks look like `Task: score (1-5): actors`.')
    expect(en.hint).toBe('e.g. `Make tea: 5: Me`')
    await parses('journey\n  title X\n  section A\n    Make tea: 5: Me')
  })

  it('keeps the gantt format for gantt', async () => {
    const { ko, en } = await explainBoth('gantt\n  dateFormat YYYY-MM-DD\n  section A\n  Task one 2024-01-01, 3d')
    expect(ko.detail).toBe('작업 이름 뒤에 `:`과 일정이 필요해요.')
    expect(ko.hint).toBe('예: `디자인 : 2024-01-01, 3d`')
    expect(en.hint).toBe('e.g. `Design : 2024-01-01, 3d`')
  })
})

describe('Korean particles and wording (explain#8)', () => {
  const ko = (key: string, params?: Record<string, string>) => translate('ko', key, params)

  it('uses the right particle after `:` and other code spans', () => {
    expect(ko('explain.seqText.title')).toBe('메시지 앞에 `:`이 필요해요')
    expect(ko('explain.task.detail')).toBe('작업 이름 뒤에 `:`과 일정이 필요해요.')
    expect(ko('fix.seqColon')).toBe('메시지 앞에 빠진 `:`을 넣었어요')
    expect(ko('fix.taskColon')).toBe('작업 이름과 일정 사이에 `:`을 넣었어요')
    expect(ko('fix.insertToken', { token: ':' })).toBe('빠져 있던 `:` 기호를 넣었어요')
    expect(ko('explain.token.title', { want: ':' })).toBe('여기에는 `:` 기호가 와야 해요')
    expect(ko('fix.headerMissing', { type: 'flowchart TD' })).toBe('첫 줄에 빠져 있던 다이어그램 선언 `flowchart TD` 줄을 추가했어요')
    expect(ko('fix.spacedId', { phrase: '시작 지점', id: '시작_지점' })).toBe('공백이 든 노드 이름을 id로 바꾸고 원래 이름은 라벨로 남겼어요: `시작 지점` → `시작_지점`')
    expect(ko('fix.direction', { from: 'TOP', to: 'TD' })).toBe('방향을 `TOP` → `TD`로 고쳤어요')
    expect(ko('fix.direction', { from: 'left', to: 'LR' })).toBe('방향을 `left` → `LR`로 고쳤어요')
    expect(ko('explain.unknown.typo', { guess: 'flowchart' })).toBe('혹시 `flowchart` 말인가요?')
    expect(ko('explain.eof.hint', { closers: '`end`' })).toBe('`end`로 닫아 주세요.')
    expect(ko('explain.lexical.hintQuote')).toBe('둥근 따옴표 대신 키보드의 `"`를 써 주세요.')
    expect(ko('explain.lexical.hintArrow')).toBe('화살표는 키보드 하이픈으로 `-->`처럼 써야 해요.')
  })

  it('never separates a particle from the code span before it', () => {
    for (const value of Object.values(DICTS.ko)) expect(value).not.toMatch(/` (을|를|이|가|은|는|로|으로|와|과|처럼)(\s|[.,]|$)/)
  })

  it('picks 이/가 for the substituted word', () => {
    expect(ko('explain.generic.hintOne', { expected: '숫자' })).toBe('여기에는 숫자가 와야 해요.')
    expect(ko('explain.generic.hintOne', { expected: '문서 끝' })).toBe('여기에는 문서 끝이 와야 해요.')
    expect(ko('explain.generic.hintOne', { expected: '"문자열"' })).toBe('여기에는 "문자열"이 와야 해요.')
    expect(ko('explain.generic.hintOne', { expected: '`?`' })).toBe('여기에는 `?`이(가) 와야 해요.')
    expect(ko('explain.token.detail', { where: 'X', want: ':', found: '386' })).toBe('X에서 `:` 기호를 기대했는데 `386`이 나왔어요.')
    expect(ko('explain.token.detail', { where: 'X', want: ':', found: '"Dest"' })).toBe('X에서 `:` 기호를 기대했는데 `"Dest"`이(가) 나왔어요.')
  })

  it('uses one item instead of "one of" for a single option', async () => {
    const { ko: k, en } = await explainBoth('flowchart TD\n  A --> B\n  classDef')
    expect(k.hint).toBe('여기에는 공백이 와야 해요.')
    expect(en.hint).toBe('Expected here: space.')
  })

  it('does not repeat 문자 after a character name', async () => {
    const { ko: k, en } = await explainBoth('flowchart TD\n  A --> B​')
    expect(k.detail).toBe('2번째 줄, 10번째 칸에 쓸 수 없는 보이지 않는 문자(U+200B)가 있어요.')
    expect(en.detail).toBe('The invisible character (U+200B) at line 2, column 10 is not allowed in this syntax.')
    const dash = await explainBoth('flowchart TD\n  A —> B')
    expect(dash.ko.detail).toBe('2번째 줄, 5번째 칸에 쓸 수 없는 긴 대시(—)가 있어요.')
    expect(dash.en.detail).toBe('The long dash (—) at line 2, column 5 is not allowed in this syntax.')
  })
})

describe('keyword typos (explain#9)', () => {
  for (const [code, word, guess, fixed] of [
    ['gantt\n  dateFormt YYYY-MM-DD\n  section A\n  Task : 2024-01-01, 3d', 'dateFormt', 'dateFormat', 'gantt\n  dateFormat YYYY-MM-DD\n  section A\n  Task : 2024-01-01, 3d'],
    ['gitGraph\n  comit', 'comit', 'commit', 'gitGraph\n  commit'],
    ['pie titel Pets\n  "Dogs" : 3', 'titel', 'title', 'pie title Pets\n  "Dogs" : 3'],
    ['sequenceDiagram\n  participnt A\n  A->>B: hi', 'participnt', 'participant', 'sequenceDiagram\n  participant A\n  A->>B: hi'],
    ['flowchart TD\n  A --> B\n  stlye A fill:#f00', 'stlye', 'style', 'flowchart TD\n  A --> B\n  style A fill:#f00'],
  ]) {
    it(`spots ${word}`, async () => {
      const { ko, en } = await explainBoth(code)
      expect(ko.title).toBe(`알 수 없는 키워드 \`${word}\``)
      expect(ko.hint).toBe(`혹시 \`${guess}\` 말인가요?`)
      expect(en.title).toBe(`Unknown keyword \`${word}\``)
      expect(en.hint).toBe(`Did you mean \`${guess}\`?`)
      await parses(fixed)
    })
  }

  it('leaves capitalized flowchart ids and label errors alone', async () => {
    expect((await explainBoth('flowchart TD\n  Style Node --> B')).en.title).toBe('Invalid link')
    expect((await explainBoth('flowchart TD\n  Click --> B[x (y)]')).en.title).toBe('Special character `(` inside a label')
  })
})

describe('messages', () => {
  it('every key explain.ts references exists in both languages', () => {
    const keys = new Set(explainSource.match(/'(?:explain|char|tok|error)\.[\w.]+'/g)?.map((k) => k.slice(1, -1)))
    expect(keys.size).toBeGreaterThan(40)
    for (const lang of ['ko', 'en'] as Lang[]) {
      const missing = [...keys].filter((k) => !(k in DICTS[lang]))
      expect(missing, lang).toEqual([])
    }
  })

  it('ko and en have the same keys', () => {
    expect(Object.keys(DICTS.en).sort()).toEqual(Object.keys(DICTS.ko).sort())
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Snapshot, loadHistory, pushHistory } from './storage'

const codes = () => loadHistory().map((s) => s.code)
const at = (ms: number) => vi.setSystemTime(1_000_000 + ms)

describe('pushHistory', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    at(0)
  })
  afterEach(() => vi.useRealTimers())

  it('keeps a manual save when the next autosave comes within the window', () => {
    pushHistory({ code: 'flowchart TD\n A', title: '' }, true) // Cmd+S
    at(10_000)
    pushHistory({ code: 'flowchart TD\n A --> B', title: '' })
    expect(codes()).toEqual(['flowchart TD\n A --> B', 'flowchart TD\n A'])
  })

  it('keeps the checkpoint taken before a new document replaces a broken draft', () => {
    pushHistory({ code: 'graph TD\n BROKEN WORK [', title: '' }, true)
    at(3_000)
    pushHistory({ code: 'flowchart TD\n    A[Start] --> B[End]\n', title: '' })
    expect(codes()).toContain('graph TD\n BROKEN WORK [')
  })

  it('collapses autosaves of one burst of edits into a single entry', () => {
    pushHistory({ code: 'flowchart TD\n A', title: 'x' })
    at(30_000)
    pushHistory({ code: 'flowchart TD\n A --> B', title: 'x' })
    at(60_000)
    pushHistory({ code: 'flowchart TD\n A --> C', title: 'x' })
    expect(loadHistory()).toMatchObject([{ code: 'flowchart TD\n A --> C', ts: 1_000_000, auto: true }])
  })

  it('anchors the window to the start of the burst, so a long session keeps several entries', () => {
    for (let i = 0; i < 20; i++) {
      at(i * 60_000)
      pushHistory({ code: `flowchart TD\n A --> B${i}`, title: 'x' })
    }
    expect(codes()).toHaveLength(10)
    expect(codes()[0]).toBe('flowchart TD\n A --> B19')
  })

  it('does not collapse across a title change', () => {
    pushHistory({ code: 'flowchart TD\n A', title: 'one' })
    at(1_000)
    pushHistory({ code: 'flowchart TD\n A --> B', title: 'two' })
    expect(codes()).toHaveLength(2)
  })

  it('stores repeated manual saves of unchanged code once', () => {
    for (let i = 0; i < 3; i++) pushHistory({ code: 'flowchart TD\n A', title: '' }, true)
    expect(codes()).toEqual(['flowchart TD\n A'])
  })

  it('turns an autosaved entry into a manual one instead of duplicating it', () => {
    pushHistory({ code: 'flowchart TD\n A', title: '' })
    at(1_000)
    pushHistory({ code: 'flowchart TD\n A', title: 'named' }, true)
    expect(loadHistory()).toMatchObject([{ code: 'flowchart TD\n A', title: 'named', auto: false }])
    at(2_000)
    pushHistory({ code: 'flowchart TD\n A --> B', title: 'named' })
    expect(codes()).toEqual(['flowchart TD\n A --> B', 'flowchart TD\n A'])
  })

  it('never collapses entries saved before autosave entries were flagged', () => {
    const legacy: Snapshot = { id: 'old', ts: 1_000_000, title: '', code: 'flowchart TD\n A' }
    localStorage.setItem('lagoon:history', JSON.stringify([legacy]))
    at(1_000)
    pushHistory({ code: 'flowchart TD\n A --> B', title: '' })
    expect(codes()).toEqual(['flowchart TD\n A --> B', 'flowchart TD\n A'])
  })

  it('skips an autosave of the latest code and of empty code', () => {
    pushHistory({ code: 'flowchart TD\n A', title: '' })
    pushHistory({ code: 'flowchart TD\n A', title: '' })
    pushHistory({ code: '  \n', title: '' }, true)
    expect(codes()).toEqual(['flowchart TD\n A'])
  })
})

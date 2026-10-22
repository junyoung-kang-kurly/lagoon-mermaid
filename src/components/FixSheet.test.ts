import { describe, expect, it } from 'vitest'
import { formatLines } from './FixSheet'

describe('formatLines', () => {
  it('collapses consecutive line numbers into ranges', () => {
    expect(formatLines([5])).toEqual({ shown: '5', full: '5', more: 0 })
    expect(formatLines([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toEqual({ shown: '2–15', full: '2–15', more: 0 })
    expect(formatLines([2, 3, 5, 7, 8, 9])).toEqual({ shown: '2–3, 5, 7–9', full: '2–3, 5, 7–9', more: 0 })
  })

  it('shows only the first ranges and counts the lines left out', () => {
    expect(formatLines([2, 4, 6, 8, 10, 11, 12, 20])).toEqual({ shown: '2, 4, 6, 8', full: '2, 4, 6, 8, 10–12, 20', more: 4 })
    expect(formatLines([1, 3, 5, 7, 9], 2)).toEqual({ shown: '1, 3', full: '1, 3, 5, 7, 9', more: 3 })
  })
})

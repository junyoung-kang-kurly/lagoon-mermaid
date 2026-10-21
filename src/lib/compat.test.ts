/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DICTS } from './i18n'

const SRC = join(__dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    if (e.isDirectory()) return sources(path)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : []
  })
}

describe('compatibility guards', () => {
  it('uses no regex lookbehind (Safari < 16.4 fails to parse the whole bundle)', () => {
    const offenders = sources(SRC).filter((f) => /\(\?<[=!]/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })

  it('has ko and en text for every fix message a rule can emit', () => {
    const rules = readFileSync(join(SRC, 'lib/fix/rules.ts'), 'utf8')
    const keys = [...new Set([...rules.matchAll(/key: '([\w.]+)'/g)].map((m) => m[1]))]
    expect(keys.length).toBeGreaterThan(10)
    for (const lang of ['ko', 'en'] as const) {
      const missing = keys.filter((k) => !(k in DICTS[lang]))
      expect(missing, lang).toEqual([])
    }
  })
})

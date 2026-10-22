import type { MermaidConfig } from 'mermaid'
import { useEffect, useRef, useState } from 'react'
import { type Diagnostic, diagnose } from '../lib/diagnose'
import { type FixResult, autoFix } from '../lib/fix/engine'
import { renderDiagram, validate } from '../lib/mermaid'

export type RenderStatus = 'loading' | 'rendering' | 'ok' | 'error' | 'empty'

export interface FixState {
  state: 'idle' | 'searching' | 'ready' | 'none'
  result?: FixResult
  /** the code the result was computed for — stale once the user edits */
  forCode?: string
}

export interface DiagramState {
  status: RenderStatus
  /** last successfully rendered SVG; kept while the code is broken */
  svg: string | null
  svgCode: string | null
  diagramType: string | null
  ms: number | null
  error: Diagnostic | null
  /** the code `error` was found in; lags behind the editor until the next validation */
  errorFor: string | null
  bind?: (el: Element) => void
  renderCount: number
}

const INITIAL: DiagramState = { status: 'loading', svg: null, svgCode: null, diagramType: null, ms: null, error: null, errorFor: null, renderCount: 0 }

export function useDiagram(code: string, config: MermaidConfig) {
  const [state, setState] = useState<DiagramState>(INITIAL)
  const [fix, setFix] = useState<FixState>({ state: 'idle' })
  const seq = useRef(0)
  const first = useRef(true)
  const configKey = JSON.stringify(config)

  useEffect(() => {
    const mine = ++seq.current
    const delay = first.current ? 0 : 160
    first.current = false
    const timer = window.setTimeout(async () => {
      if (!code.trim()) {
        setState((s) => ({ ...s, status: 'empty', error: null, svg: null, svgCode: null }))
        setFix({ state: 'idle' })
        return
      }
      const slow = window.setTimeout(() => seq.current === mine && setState((s) => (s.status === 'loading' ? s : { ...s, status: 'rendering' })), 140)
      try {
        const diag = await validate(code)
        if (mine !== seq.current) return
        if (diag) {
          setState((s) => ({ ...s, status: 'error', error: diag, errorFor: code }))
          return
        }
        const out = await renderDiagram(code, config)
        if (mine !== seq.current) return
        setFix({ state: 'idle' })
        setState((s) => ({
          status: 'ok',
          svg: out.svg,
          svgCode: code,
          diagramType: out.diagramType,
          ms: out.ms,
          error: null,
          errorFor: null,
          bind: out.bindFunctions,
          renderCount: s.renderCount + 1,
        }))
      } catch (error) {
        if (mine !== seq.current) return
        setState((s) => ({ ...s, status: 'error', error: diagnose(code, error), errorFor: code }))
      } finally {
        window.clearTimeout(slow)
      }
    }, delay)
    return () => window.clearTimeout(timer)
    // config is captured through its serialized key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, configKey])

  // look for a verified repair in the background whenever the code is broken
  useEffect(() => {
    if (state.status !== 'error' || !state.error) return
    if (fix.forCode === code && fix.state !== 'idle') return
    const search = new AbortController()
    const timer = window.setTimeout(async () => {
      setFix({ state: 'searching', forCode: code })
      const result = await autoFix(code, validate, { signal: search.signal })
      if (search.signal.aborted) return
      const useful = result.steps.length > 0
      setFix({ state: useful ? 'ready' : 'none', result: useful ? result : undefined, forCode: code })
    }, 400)
    return () => {
      search.abort()
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.error, code])

  const currentFix: FixState = fix.forCode === code ? fix : { state: state.status === 'error' ? 'searching' : 'idle' }
  return { ...state, fix: currentFix }
}

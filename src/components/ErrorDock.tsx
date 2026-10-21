import { ChevronDown, CornerDownRight, Eye, Lightbulb, Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { FixState } from '../hooks/useDiagram'
import type { Diagnostic } from '../lib/diagnose'
import { explain } from '../lib/explain'
import { t, useLang } from '../lib/i18n'
import { Button, Kbd, RichText, cx } from './ui'

interface Props {
  code: string
  error: Diagnostic
  fix: FixState
  onGoto(): void
  onApplyFix(): void
  onPreviewFix(): void
}

export function ErrorDock({ code, error, fix, onGoto, onApplyFix, onPreviewFix }: Props) {
  const lang = useLang()
  const [collapsed, setCollapsed] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const info = useMemo(() => explain(lang, code, error), [lang, code, error])
  const lineText = code.replace(/\r\n?/g, '\n').split('\n')[error.line - 1] ?? ''
  const start = Math.min(error.column, lineText.length)
  const end = Math.min(start + Math.max(error.length, 1), lineText.length)
  const steps = fix.result?.steps.length ?? 0
  const partial = fix.state === 'ready' && !fix.result?.ok

  return (
    <div className="pointer-events-auto mx-3 mb-3 animate-rise overflow-hidden rounded-2xl border border-danger/25 bg-surface-2/95 shadow-float backdrop-blur-md">
      <div className="flex items-start gap-3 px-4 pt-3.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
          <TriangleAlert className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <RichText className="text-[14px] font-semibold text-text" text={info.title} />
            <button onClick={onGoto} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-accent">
              <CornerDownRight className="size-3" />
              {t('error.where', { line: error.line, col: error.column + 1 })}
            </button>
          </div>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="-mr-1 rounded-md p-1 text-muted hover:bg-surface-3 hover:text-text"
          aria-label="toggle"
        >
          <ChevronDown className={cx('size-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-2.5 px-4 pb-1 pl-[52px] pt-2">
          {lineText.trim() && (
            <button
              onClick={onGoto}
              className="block w-full overflow-x-auto rounded-lg border border-line bg-surface px-3 py-2 text-left font-mono text-[12px] leading-relaxed text-text-2 hover:border-line-strong"
            >
              <span className="mr-3 select-none text-muted/70">{error.line}</span>
              <span className="whitespace-pre">{lineText.slice(0, start)}</span>
              <span className="whitespace-pre rounded-[3px] bg-danger/20 text-danger underline decoration-danger decoration-wavy underline-offset-[3px]">
                {lineText.slice(start, end) || ' '}
              </span>
              <span className="whitespace-pre">{lineText.slice(end)}</span>
            </button>
          )}
          <RichText className="block text-[13px] leading-relaxed text-text-2" text={info.detail} />
          {info.hint && (
            <div className="flex gap-2 text-[13px] leading-relaxed text-text-2">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warn" />
              <RichText text={info.hint} />
            </div>
          )}
          <button onClick={() => setShowRaw((v) => !v)} className="text-[11.5px] text-muted hover:text-text-2">
            {t('error.raw')} {showRaw ? '▴' : '▾'}
          </button>
          {showRaw && (
            <pre className="max-h-40 overflow-auto rounded-lg border border-line bg-surface p-2.5 font-mono text-[11px] leading-relaxed text-muted">
              {error.message}
            </pre>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line bg-surface/50 px-4 py-2.5 pl-[52px]">
        {fix.state === 'searching' && (
          <span className="flex items-center gap-2 text-[12.5px] text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            {t('error.fixing')}
          </span>
        )}
        {fix.state === 'ready' && (
          <>
            <Button variant="primary" onClick={onApplyFix} icon={<Sparkles className="size-3.5" />} className="pulse-ring">
              {t('error.fixCta')}
              <span className="rounded bg-black/15 px-1.5 text-[11px] font-semibold">{t('error.fixCount', { n: steps })}</span>
            </Button>
            <Button variant="ghost" onClick={onPreviewFix} icon={<Eye className="size-3.5" />}>
              {t('error.review')}
            </Button>
            <span className="ml-auto hidden items-center gap-1 text-[11.5px] text-muted sm:flex">
              {partial ? <span className="text-warn">{t('error.partial')}</span> : <span>{t('fix.verified')}</span>}
              <Kbd className="ml-1">⌘</Kbd>
              <Kbd>.</Kbd>
            </span>
          </>
        )}
        {fix.state === 'none' && <span className="text-[12.5px] text-muted">{t('error.noFix')}</span>}
      </div>
    </div>
  )
}

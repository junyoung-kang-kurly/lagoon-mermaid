import { CheckCircle2, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'
import type { FixResult, FixStep } from '../lib/fix/engine'
import { translate, t, useLang } from '../lib/i18n'
import { DiffView } from './DiffView'
import { Button, Kbd, Modal, RichText, cx } from './ui'

interface StepGroup {
  msg: FixStep['msg']
  lossy?: boolean
  lines: number[]
}

/** one row per kind of change: "quoted labels — lines 2, 3, 4" */
function groupSteps(steps: FixStep[]): StepGroup[] {
  const groups: StepGroup[] = []
  for (const s of steps) {
    const key = JSON.stringify(s.msg)
    const found = groups.find((g) => JSON.stringify(g.msg) === key && !!g.lossy === !!s.lossy)
    if (found) {
      if (s.line && !found.lines.includes(s.line)) found.lines.push(s.line)
    } else groups.push({ msg: s.msg, lossy: s.lossy, lines: s.line ? [s.line] : [] })
  }
  groups.forEach((g) => g.lines.sort((a, b) => a - b))
  return groups
}

interface Props {
  open: boolean
  before: string
  result: FixResult | undefined
  onApply(): void
  onClose(): void
}

export function FixSheet({ open, before, result, onApply, onClose }: Props) {
  const lang = useLang()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onApply()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onApply])

  if (!result) return null
  return (
    <Modal open={open} onClose={onClose} className="max-w-3xl" labelledBy="fix-title">
      <div className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-accent text-accent-ink shadow-soft">
          <Sparkles className="size-4.5" />
        </span>
        <div className="min-w-0">
          <h2 id="fix-title" className="text-[16px] font-semibold">
            {t('fix.title')}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{t('fix.subtitle')}</p>
        </div>
        <span
          className={cx(
            'ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium',
            result.ok ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn',
          )}
        >
          {result.ok ? <ShieldCheck className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
          {result.ok ? t('fix.verified') : t('fix.stillBroken')}
        </span>
      </div>

      <div className="space-y-4 px-6 py-5">
        <ol className="space-y-1.5">
          {groupSteps(result.steps).map((s, i) => (
            <li
              key={i}
              className={cx(
                'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-[13px] animate-rise',
                s.lossy ? 'border-warn/30 bg-warn/5' : 'border-line bg-surface',
              )}
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <span
                className={cx(
                  'mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  s.lossy ? 'bg-warn/15 text-warn' : 'bg-accent-soft text-accent',
                )}
              >
                {s.lossy ? '!' : <CheckCircle2 className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <RichText className="leading-relaxed text-text" text={translate(lang, s.msg.key, s.msg.params)} />
                {s.lossy && <div className="mt-1 text-[12px] text-warn">{t('fix.lossyWarn')}</div>}
              </div>
              {s.lines.length > 0 && <span className="shrink-0 font-mono text-[11px] text-muted">{t('fix.line', { line: s.lines.join(', ') })}</span>}
            </li>
          ))}
        </ol>
        <DiffView before={before} after={result.code} />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3.5">
        <Button variant="ghost" onClick={onClose}>
          {t('fix.cancel')}
        </Button>
        <Button variant="primary" onClick={onApply} icon={<Sparkles className="size-3.5" />}>
          {t('fix.applyAll')}
          <span className="ml-1 flex items-center gap-0.5 opacity-70">
            <Kbd className="border-black/10 bg-black/10 text-current">⌘</Kbd>
            <Kbd className="border-black/10 bg-black/10 text-current">↵</Kbd>
          </span>
        </Button>
      </div>
    </Modal>
  )
}

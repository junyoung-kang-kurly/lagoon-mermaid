import type { MermaidConfig } from 'mermaid'
import { FlaskConical, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { t, useLang } from '../lib/i18n'
import { renderDiagram } from '../lib/mermaid'
import { BROKEN_SAMPLE, SAMPLES, type Sample } from '../lib/samples'
import { Modal } from './ui'

const cache = new Map<string, string>()

function useThumbnails(open: boolean, config: MermaidConfig) {
  const key = JSON.stringify(config)
  const [, force] = useState(0)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      for (const s of SAMPLES) {
        if (cancelled) return
        const k = `${key}:${s.id}`
        if (cache.has(k)) continue
        try {
          const { svg } = await renderDiagram(s.code, config)
          cache.set(k, svg)
        } catch {
          cache.set(k, '')
        }
        if (!cancelled) force((n) => n + 1)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key])
  return (id: string) => cache.get(`${key}:${id}`)
}

interface Props {
  open: boolean
  config: MermaidConfig
  onClose(): void
  onPick(code: string, name: string): void
}

export function TemplatesDialog({ open, config, onClose, onPick }: Props) {
  useLang()
  const [query, setQuery] = useState('')
  const thumb = useThumbnails(open, config)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? SAMPLES.filter((s) => s.name.toLowerCase().includes(q) || s.id.includes(q) || s.code.toLowerCase().includes(q)) : SAMPLES
  }, [query])

  return (
    <Modal open={open} onClose={onClose} className="max-w-5xl" labelledBy="tpl-title">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h2 id="tpl-title" className="text-[16px] font-semibold">
            {t('templates.title')}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{t('templates.subtitle')}</p>
        </div>
        <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-[13px] focus-within:border-accent sm:w-64">
          <Search className="size-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('templates.search')}
            className="w-full bg-transparent outline-none placeholder:text-muted"
          />
        </label>
      </div>
      <div className="max-h-[68vh] overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {!query && (
            <button
              onClick={() => onPick(BROKEN_SAMPLE, 'broken')}
              className="group relative col-span-2 flex flex-col justify-between overflow-hidden rounded-xl p-[1px] text-left sm:col-span-1"
            >
              <span className="bg-gradient-accent absolute inset-0 opacity-70 transition-opacity group-hover:opacity-100" />
              <span className="relative flex h-full flex-col gap-3 rounded-[11px] bg-surface-2 p-4">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <FlaskConical className="size-4.5" />
                </span>
                <span>
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                    {t('templates.broken')}
                    <Sparkles className="size-3.5 text-accent" />
                  </span>
                  <span className="mt-1 block text-[12px] leading-relaxed text-muted">{t('templates.brokenDesc')}</span>
                </span>
              </span>
            </button>
          )}
          {list.map((s, i) => (
            <TemplateCard key={s.id} sample={s} svg={thumb(s.id)} index={i} onPick={() => onPick(s.code, s.name)} />
          ))}
        </div>
        {list.length === 0 && <div className="py-10 text-center text-[13px] text-muted">{t('templates.empty')}</div>}
      </div>
    </Modal>
  )
}

function TemplateCard({ sample, svg, index, onPick }: { sample: Sample; svg: string | undefined; index: number; onPick(): void }) {
  return (
    <button
      onClick={onPick}
      className="group flex animate-rise flex-col overflow-hidden rounded-xl border border-line bg-surface text-left transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-soft"
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      <div aria-hidden="true" className="canvas-grid relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-line p-3">
        {svg === undefined ? (
          <div className="shimmer absolute inset-3 rounded-lg" />
        ) : svg ? (
          // isolate: mermaid's sankey links use mix-blend-mode, which would blend with the dark grid behind the thumbnail
          <div
            className="pointer-events-none isolate flex h-full w-full items-center justify-center [&_svg]:h-auto [&_svg]:max-h-full [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <span className="font-mono text-[11px] text-muted">{sample.id}</span>
        )}
      </div>
      {/* phones stack the badge under a name that may wrap; wider cards give the name priority over the badge */}
      <div className="flex flex-col items-start gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span className="max-w-full text-[13px] font-medium sm:shrink-0 sm:truncate">{sample.name}</span>
        <span className="min-w-0 max-w-full truncate rounded bg-surface-3 px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-muted">{sample.category}</span>
      </div>
    </button>
  )
}

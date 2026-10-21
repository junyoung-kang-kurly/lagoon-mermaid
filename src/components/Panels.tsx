import { Bookmark, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { type Lang, t, useLang } from '../lib/i18n'
import { DEFAULT_SETTINGS, type DiagramSettings, type MermaidTheme, parseAdvanced } from '../lib/mermaid'
import type { Snapshot } from '../lib/storage'
import { Button, Segmented, cx } from './ui'

const THEMES: Array<{ id: MermaidTheme; swatch: string[] }> = [
  { id: 'auto', swatch: ['#2dd4bf', '#0d1116'] },
  { id: 'default', swatch: ['#ECECFF', '#9370DB'] },
  { id: 'neutral', swatch: ['#f4f4f4', '#666'] },
  { id: 'dark', swatch: ['#1f2020', '#ccc'] },
  { id: 'forest', swatch: ['#cde498', '#13540c'] },
  { id: 'base', swatch: ['#fff4dd', '#f4b400'] },
]

export function SettingsPanel({ value, onChange }: { value: DiagramSettings; onChange(v: DiagramSettings): void }) {
  useLang()
  const [draft, setDraft] = useState(value.advanced)
  useEffect(() => setDraft(value.advanced), [value.advanced])
  const invalid = parseAdvanced(draft) === null
  const set = <K extends keyof DiagramSettings>(k: K, v: DiagramSettings[K]) => onChange({ ...value, [k]: v })

  return (
    <div className="w-full space-y-4 p-2.5 sm:w-[320px]">
      <div className="text-[13px] font-semibold">{t('settings.title')}</div>
      <Field label={t('settings.theme')}>
        <div className="grid grid-cols-3 gap-1.5">
          {THEMES.map((th) => (
            <button
              key={th.id}
              onClick={() => set('theme', th.id)}
              className={cx(
                'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[12px] transition-colors',
                value.theme === th.id ? 'border-accent bg-accent-soft text-text' : 'border-line text-text-2 hover:border-line-strong',
              )}
            >
              <span className="flex -space-x-1">
                {th.swatch.map((c) => (
                  <span key={c} className="size-3 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </span>
              {th.id === 'auto' ? 'Lagoon' : th.id}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t('settings.look')}>
        <Segmented
          value={value.look}
          onChange={(v) => set('look', v)}
          options={[
            { value: 'classic', label: t('settings.look.classic') },
            { value: 'handDrawn', label: t('settings.look.handDrawn') },
          ]}
        />
      </Field>
      <Field label={t('settings.layout')}>
        <Segmented
          value={value.layout}
          onChange={(v) => set('layout', v)}
          options={[
            { value: 'dagre', label: t('settings.layout.dagre') },
            { value: 'elk', label: t('settings.layout.elk') },
          ]}
        />
      </Field>
      <Field label={t('settings.curve')}>
        <Segmented
          value={value.curve}
          onChange={(v) => set('curve', v)}
          options={[
            { value: 'basis', label: 'basis' },
            { value: 'linear', label: 'linear' },
            { value: 'step', label: 'step' },
            { value: 'cardinal', label: 'cardinal' },
          ]}
        />
      </Field>
      <Field label={t('settings.advanced')}>
        <textarea
          value={draft}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value)
            if (parseAdvanced(e.target.value) !== null) set('advanced', e.target.value)
          }}
          placeholder={'{\n  "themeVariables": { "primaryColor": "#2dd4bf" }\n}'}
          className={cx(
            'h-28 w-full resize-y rounded-lg border bg-surface p-2.5 font-mono text-[11.5px] leading-relaxed outline-none placeholder:text-muted/60',
            invalid ? 'border-danger' : 'border-line focus:border-accent',
          )}
        />
        {invalid && <div className="mt-1 text-[11.5px] text-danger">{t('settings.invalidJson')}</div>}
      </Field>
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => onChange({ ...DEFAULT_SETTINGS })}>
          {t('settings.reset')}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  )
}

function ago(lang: Lang, ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
  if (s < 60) return rtf.format(-s, 'second')
  if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute')
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour')
  return rtf.format(-Math.round(s / 86400), 'day')
}

export function HistoryPanel({
  items,
  onRestore,
  onSave,
  onClear,
}: {
  items: Snapshot[]
  onRestore(s: Snapshot): void
  onSave(): void
  onClear(): void
}) {
  const lang = useLang()
  return (
    <div className="w-full sm:w-[340px]">
      <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
        <span className="text-[13px] font-semibold">{t('history.title')}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" icon={<Bookmark className="size-3.5" />} onClick={onSave}>
            {t('history.saveNow')}
          </Button>
          {items.length > 0 && (
            <Button size="sm" variant="danger" onClick={onClear} aria-label={t('history.clear')}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {items.length === 0 && <div className="px-3 py-8 text-center text-[12.5px] leading-relaxed text-muted">{t('history.empty')}</div>}
        {items.map((s) => {
          const lines = s.code.split('\n').filter((l) => l.trim() && !l.trim().startsWith('%%'))
          return (
            <button
              key={s.id}
              onClick={() => onRestore(s)}
              className="group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-3"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent/70" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12.5px] font-medium">{s.title || t('app.untitled')}</span>
                  <span className="shrink-0 text-[11px] text-muted">{ago(lang, s.ts)}</span>
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">
                  {lines[0]?.trim()} · {lines.length} lines
                </span>
              </span>
              <span className="hidden self-center text-[11.5px] font-medium text-accent group-hover:inline">{t('history.restore')}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

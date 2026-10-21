import { CornerDownLeft, Search } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { t, useLang } from '../lib/i18n'
import { Kbd, Modal, cx } from './ui'

export interface Command {
  id: string
  label: string
  group: string
  icon: ReactNode
  shortcut?: string[]
  disabled?: boolean
  run(): void
}

function score(label: string, query: string): number {
  const l = label.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return 1
  if (l.includes(q)) return 100 - l.indexOf(q)
  let i = 0
  for (const ch of l) if (ch === q[i]) i++
  return i === q.length ? 10 : 0
}

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose(): void; commands: Command[] }) {
  useLang()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  const results = useMemo(
    () =>
      commands
        .filter((c) => !c.disabled)
        .map((c) => ({ c, s: score(`${c.label} ${c.group}`, query) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((r) => r.c),
    [commands, query],
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])
  useEffect(() => setActive(0), [query])
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = (c: Command | undefined) => {
    if (!c) return
    onClose()
    window.setTimeout(() => c.run(), 0)
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(results[active])
            }
          }}
          placeholder={t('palette.placeholder')}
          className="h-13 w-full bg-transparent text-[14.5px] outline-none placeholder:text-muted"
        />
        <Kbd>esc</Kbd>
      </div>
      <div ref={list} className="max-h-[52vh] overflow-y-auto p-1.5">
        {results.length === 0 && <div className="px-3 py-8 text-center text-[13px] text-muted">{t('palette.empty')}</div>}
        {results.map((c, i) => (
          <button
            key={c.id}
            data-index={i}
            onMouseMove={() => setActive(i)}
            onClick={() => run(c)}
            className={cx(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13.5px]',
              i === active ? 'bg-accent-soft text-text' : 'text-text-2',
            )}
          >
            <span className={cx('flex size-4 items-center justify-center', i === active ? 'text-accent' : 'text-muted')}>{c.icon}</span>
            <span className="flex-1">{c.label}</span>
            <span className="text-[11.5px] text-muted">{c.group}</span>
            {c.shortcut && (
              <span className="flex gap-0.5">
                {c.shortcut.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            )}
            {i === active && <CornerDownLeft className="size-3.5 text-muted" />}
          </button>
        ))}
      </div>
    </Modal>
  )
}

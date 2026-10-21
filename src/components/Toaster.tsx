import { CheckCircle2, CircleAlert, Sparkles } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { cx } from './ui'

type Kind = 'ok' | 'error' | 'magic'
interface ToastItem {
  id: number
  text: string
  kind: Kind
}

let items: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function toast(text: string, kind: Kind = 'ok') {
  const id = nextId++
  items = [...items.slice(-2), { id, text, kind }]
  emit()
  window.setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, 2600)
}

const ICONS: Record<Kind, typeof CheckCircle2> = { ok: CheckCircle2, error: CircleAlert, magic: Sparkles }

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => items,
  )
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[90] flex flex-col items-center gap-2 px-4">
      {list.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex animate-rise items-center gap-2 rounded-full border border-line-strong bg-surface-2/95 py-2 pl-3 pr-4 text-[13px] text-text shadow-float backdrop-blur"
          >
            <Icon className={cx('size-4', t.kind === 'error' ? 'text-danger' : 'text-accent')} />
            {t.text}
          </div>
        )
      })}
    </div>,
    document.body,
  )
}

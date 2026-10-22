import { type ButtonHTMLAttributes, type ReactNode, type RefObject, forwardRef, useEffect, useEffectEvent, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ')

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger' | 'outline'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-accent text-accent-ink font-semibold shadow-[0_6px_20px_-6px_color-mix(in_srgb,var(--accent)_70%,transparent)] hover:brightness-110 active:brightness-95',
  ghost: 'text-text-2 hover:text-text hover:bg-surface-3',
  subtle: 'bg-surface-3 text-text hover:bg-line',
  outline: 'border border-line-strong text-text hover:bg-surface-3',
  danger: 'text-danger hover:bg-danger-soft',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'md', icon, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cx(
        'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg transition-[background,color,filter,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  shortcut?: string
  active?: boolean
  tooltipSide?: 'bottom' | 'top' | 'left'
}

/** shifts a shown tooltip sideways so it stays inside the viewport and any pane that clips it */
function keepInside(tip: HTMLElement | null) {
  if (!tip) return
  tip.style.transform = ''
  const r = tip.getBoundingClientRect()
  let left = 4
  let right = innerWidth - 4
  for (let p = tip.parentElement; p; p = p.parentElement) {
    if (getComputedStyle(p).overflowX === 'visible') continue
    const box = p.getBoundingClientRect()
    left = Math.max(left, box.left + 4)
    right = Math.min(right, box.right - 4)
  }
  const dx = r.right > right ? right - r.right : r.left < left ? left - r.left : 0
  if (dx) tip.style.transform = `translateX(${dx}px)`
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, active, tooltipSide = 'bottom', className, children, ...rest },
  ref,
) {
  const tip = useRef<HTMLSpanElement>(null)
  return (
    <span className="group/tip relative inline-flex" onPointerEnter={() => keepInside(tip.current)} onFocus={() => keepInside(tip.current)}>
      <button
        ref={ref}
        aria-label={label}
        className={cx(
          'peer inline-flex size-8 items-center justify-center rounded-lg text-text-2 transition-colors hover:bg-surface-3 hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40',
          active && 'bg-surface-3 text-text',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
      <span
        ref={tip}
        role="tooltip"
        className={cx(
          'pointer-events-none absolute z-50 hidden items-center gap-1.5 whitespace-nowrap rounded-md border border-line-strong bg-surface-2 px-2 py-1 text-[11.5px] text-text shadow-soft',
          // an active trigger has its popover open right where the tooltip would show
          !active && 'group-hover/tip:flex peer-focus-visible:flex',
          tooltipSide === 'bottom' && 'left-1/2 top-full mt-1.5 -translate-x-1/2',
          tooltipSide === 'top' && 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
          tooltipSide === 'left' && 'right-full top-1/2 mr-1.5 -translate-y-1/2',
        )}
      >
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </span>
    </span>
  )
})

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-line-strong bg-surface-3 px-1 font-sans text-[10.5px] font-medium text-muted',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)

/** Tab and Shift+Tab wrap around inside `root` instead of reaching the page behind it */
function trapTab(e: KeyboardEvent, root: HTMLElement) {
  const items = focusables(root)
  const active = document.activeElement
  const inside = active !== root && root.contains(active)
  if (!items.length) return e.preventDefault()
  if (inside && active !== (e.shiftKey ? items[0] : items.at(-1))) return
  e.preventDefault()
  ;(e.shiftKey ? items.at(-1) : items[0])?.focus()
}

/** Moves focus into the dialog on open (initialFocus, else its first control), keeps Tab inside, and hands focus back to the opener on close */
export function Modal({
  open,
  onClose,
  children,
  className,
  labelledBy,
  label,
  initialFocus,
}: {
  open: boolean
  onClose(): void
  children: ReactNode
  className?: string
  labelledBy?: string
  label?: string
  initialFocus?: RefObject<HTMLElement | null>
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
    } else if (e.key === 'Tab' && dialog.current) trapTab(e, dialog.current)
  })
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handle, true)
    return () => window.removeEventListener('keydown', handle, true)
  }, [open])
  useEffect(() => {
    if (!open || !dialog.current) return
    const opener = document.activeElement as HTMLElement | null
    ;(initialFocus?.current ?? focusables(dialog.current)[0] ?? dialog.current).focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [open, initialFocus])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 pt-[8vh] sm:p-6 sm:pt-[10vh]">
      <div className="fixed inset-0 animate-fade bg-black/45 backdrop-blur-[3px]" onClick={onClose} />
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        tabIndex={-1}
        className={cx('relative w-full animate-rise rounded-2xl border border-line-strong bg-surface-2 shadow-float outline-none', className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Dropdown anchored to its trigger; closes on outside click and Escape */
export function Popover({
  trigger,
  children,
  align = 'end',
  className,
  open: controlled,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle(): void }) => ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'start' | 'end'
  className?: string
  open?: boolean
  onOpenChange?(open: boolean): void
}) {
  const [inner, setInner] = useState(false)
  const open = controlled ?? inner
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInner(v))
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // the trigger renders first in the box; focus inside the closing panel would otherwise drop to <body>
      if (box.current?.contains(document.activeElement)) box.current.querySelector<HTMLElement>(FOCUSABLE)?.focus()
      setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  })
  return (
    <div ref={box} className="relative">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open && (
        <div
          className={cx(
            'absolute top-full z-[70] mt-2 flex max-h-[calc(100dvh-4.5rem)] animate-pop flex-col overflow-y-auto overscroll-contain rounded-xl border border-line-strong bg-surface-2 p-1.5 shadow-float',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            className,
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  hint,
  onClick,
  disabled,
}: {
  icon?: ReactNode
  children: ReactNode
  hint?: ReactNode
  onClick?(): void
  disabled?: boolean
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-text transition-colors hover:bg-surface-3 disabled:opacity-40"
    >
      <span className="flex size-4 items-center justify-center text-muted">{icon}</span>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11.5px] text-muted">{hint}</span>}
    </button>
  )
}

export const MenuSeparator = () => <div className="my-1 h-px bg-line" />

/** renders `inline code` spans inside plain explanation text; longer backtick runs (```) stay literal */
export function RichText({ text, className }: { text: string; className?: string }) {
  // a tokenizer, not a lookbehind regex: Safari < 16.4 cannot parse one, and this module loads eagerly
  const runs = text.split(/(`+)/) // odd indices are backtick runs, even ones the text between them
  const parts: ReactNode[] = []
  let plain = ''
  for (let i = 0; i < runs.length; i++) {
    if (runs[i] === '`' && runs[i + 2] === '`') {
      if (plain) parts.push(<span key={parts.length}>{plain}</span>)
      parts.push(<code key={parts.length}>{runs[i + 1]}</code>)
      plain = ''
      i += 2
    } else plain += runs[i]
  }
  if (plain) parts.push(<span key={parts.length}>{plain}</span>)
  return <span className={cx('prose-code', className)}>{parts}</span>
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  disabled,
}: {
  value: T
  options: Array<{ value: T; label: ReactNode }>
  onChange(v: T): void
  className?: string
  disabled?: boolean
}) {
  return (
    <div className={cx('inline-flex rounded-lg border border-line bg-surface-3/60 p-0.5', disabled && 'pointer-events-none opacity-50', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-7 rounded-md px-2.5 text-[12.5px] transition-all',
            value === o.value ? 'bg-surface-2 font-medium text-text shadow-soft' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

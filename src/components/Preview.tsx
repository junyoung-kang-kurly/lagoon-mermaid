import { History, Maximize, Minimize, Minus, MousePointerClick, Plus, ScanSearch, Sparkles, TriangleAlert } from 'lucide-react'
import { type CSSProperties, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { RenderStatus } from '../hooks/useDiagram'
import { usePanZoom } from '../hooks/usePanZoom'
import { svgSize } from '../lib/export'
import { t, useLang } from '../lib/i18n'
import { MOD } from '../lib/platform'
import { Logo } from './Logo'
import { Button, IconButton, cx } from './ui'

export interface PreviewHandle {
  fit(): void
  zoomIn(): void
  zoomOut(): void
  actual(): void
}

export interface NodeTarget {
  /** mermaid's internal id for the node, when it can be recovered */
  id?: string
  text?: string
  element: Element
}

interface Props {
  svg: string | null
  status: RenderStatus
  hasError: boolean
  diagramType: string | null
  ms: number | null
  renderCount: number
  bind?: (el: Element) => void
  grid: boolean
  /** the diagram's own background, for a diagram theme lighter or darker than the app */
  canvasBackground?: string
  fixReady: boolean
  onFix(): void
  onNodeClick(target: NodeTarget): void
}

const NODE_SELECTOR =
  'g.node, g.actor, rect.actor, g.actor-man, g.classGroup, g[id^="entity-"], g.statediagram-state, g.mindmap-node, g.section, g.task, rect.task, g.pieCircle, g.commit-bullets, g.kanban-item, g[id*="-entity-"], text.actor'

const clean = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim() || undefined

function nodeFromTarget(target: Element | null, host: HTMLElement): NodeTarget | null {
  if (!target || !host.contains(target)) return null
  const el = target.closest(NODE_SELECTOR) ?? target.closest('g[id]')
  if (!el || el === host) return null
  // a sequence participant is a box (or stick figure) named by its alias, beside its label
  const actor = el.matches('g.actor-man') ? el : el.matches('rect.actor, text.actor') ? el.parentElement : null
  if (actor) {
    const name = actor.getAttribute('name') ?? actor.querySelector('[name]')?.getAttribute('name')
    return { id: name ?? undefined, text: clean(actor.querySelector('text.actor')?.textContent), element: actor }
  }
  const rawId = el.getAttribute('id') ?? ''
  const id = rawId
    .replace(/^lagoon-\d+-/, '')
    .match(/^(?:flowchart|classId|state|entity)-(.+?)-\d+$/)?.[1]
  return { id, text: clean(el.textContent), element: el }
}

/** grid dots that read on `color`: the light theme's on a light canvas, the dark theme's on a dark one */
function dotFor(color: string) {
  const n = parseInt(color.replace('#', '').slice(0, 6), 16)
  const light = ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 128
  return light ? 'rgba(15, 23, 42, 0.09)' : 'rgba(255, 255, 255, 0.07)'
}

export const Preview = forwardRef<PreviewHandle, Props>(function Preview(
  { svg, status, hasError, diagramType, ms, renderCount, bind, grid, canvasBackground, fixReady, onFix, onNodeClick },
  ref,
) {
  useLang()
  const host = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const size = useMemo(() => (svg ? svgSize(svg) : null), [svg])
  const [fullscreen, setFullscreen] = useState(false)
  const clickRef = useRef(onNodeClick)
  clickRef.current = onNodeClick

  const pz = usePanZoom(size, (target) => {
    if (!host.current) return
    const node = nodeFromTarget(target, host.current)
    if (!node) return
    node.element.classList.add('lagoon-hit')
    window.setTimeout(() => node.element.classList.remove('lagoon-hit'), 900)
    clickRef.current(node)
  })

  useImperativeHandle(ref, () => ({
    fit: () => pz.fit(true),
    zoomIn: () => pz.zoomBy(1.25, undefined, undefined, true),
    zoomOut: () => pz.zoomBy(0.8, undefined, undefined, true),
    actual: () => pz.actualSize(),
  }))

  const lastType = useRef<string | null>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    el.innerHTML = svg ?? ''
    const node = el.querySelector('svg')
    if (node && size) {
      node.setAttribute('width', String(size.width))
      node.setAttribute('height', String(size.height))
      node.style.maxWidth = 'none'
    }
    if (node && bind) bind(node)
    if (svg && (!pz.wasTouched() || lastType.current !== diagramType)) pz.fit(lastType.current !== null && lastType.current !== diagramType)
    lastType.current = diagramType
    // re-run only when a new SVG arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg, renderCount])

  const { fit } = pz
  useEffect(() => {
    const onChange = () => {
      setFullscreen(document.fullscreenElement === frame.current)
      // the frame changed size under a camera the user may have moved
      requestAnimationFrame(() => fit(true))
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [fit])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void frame.current?.requestFullscreen?.()
  }

  const stale = hasError && !!svg
  const zoomPct = Math.round(pz.view.k * 100)
  // only behind a diagram: the empty and error messages are drawn in the app's colors
  const paint = svg ? canvasBackground : undefined

  return (
    <div
      ref={frame}
      className={cx('@container relative h-full min-h-0 overflow-hidden', grid ? 'canvas-grid' : 'canvas-plain')}
      style={paint ? ({ '--canvas': paint, '--dot': dotFor(paint) } as CSSProperties) : undefined}
    >
      <div ref={pz.ref} className="absolute inset-0 cursor-grab touch-none select-none">
        <div
          className={cx('absolute left-0 top-0 origin-top-left will-change-transform', pz.animating && 'transition-transform duration-300 ease-out')}
          style={{ transform: `translate3d(${pz.view.x}px, ${pz.view.y}px, 0) scale(${pz.view.k})` }}
        >
          <div
            ref={host}
            className={cx(
              'diagram-host clickable transition-[opacity,filter] duration-300',
              stale && 'opacity-30 grayscale-[0.7] saturate-50',
            )}
          />
        </div>
      </div>

      {status === 'loading' && !svg && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-36 w-64 overflow-hidden rounded-2xl border border-line bg-surface/60">
              <div className="shimmer h-full w-full" />
            </div>
            <span className="text-[12.5px] text-muted">{t('status.loading')}</span>
          </div>
        </div>
      )}

      {hasError && !svg && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="flex max-w-xs animate-rise flex-col items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-danger-soft text-danger">
              <TriangleAlert className="size-5" />
            </span>
            <div className="text-[15px] font-semibold">{t('preview.broken.title')}</div>
            <div className="text-[13px] leading-relaxed text-muted">{t('preview.broken.body')}</div>
            {fixReady && (
              <Button data-no-pan variant="primary" icon={<Sparkles className="size-3.5" />} onClick={onFix} className="mt-1">
                {t('error.fixCta')}
              </Button>
            )}
          </div>
        </div>
      )}

      {status === 'empty' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
          <div className="flex max-w-xs flex-col items-center gap-3 animate-rise">
            <Logo className="size-11 opacity-90" />
            <div className="text-[15px] font-semibold">{t('preview.empty.title')}</div>
            <div className="text-[13px] leading-relaxed text-muted">{t('preview.empty.body')}</div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
        {diagramType && svg && (
          <span className="rounded-md border border-line bg-surface/80 px-2 py-1 font-mono text-[11px] text-text-2 backdrop-blur">
            {diagramType}
            {ms !== null && !stale && <span className="ml-1.5 text-muted">· {ms < 1 ? '<1' : Math.round(ms)}ms</span>}
          </span>
        )}
        {stale && (
          <span className="flex animate-pop items-center gap-1.5 rounded-md border border-danger/30 bg-danger-soft px-2 py-1 text-[11.5px] font-medium text-danger backdrop-blur">
            <History className="size-3.5" />
            {t('preview.lastGood')}
          </span>
        )}
      </div>

      {/* the hint gives way to the zoom bar: cut short, then hidden in a narrow pane */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-end gap-3">
        <div className="mr-auto hidden min-w-0 items-center gap-1.5 text-[11.5px] text-muted @lg:flex">
          <MousePointerClick className="size-3.5 shrink-0" />
          <span className="truncate">
            {t('preview.clickToSource')} · {t('preview.hint', { mod: MOD })}
          </span>
        </div>

        <div
          data-no-pan
          className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-xl border border-line-strong bg-surface-2/90 p-1 shadow-soft backdrop-blur"
        >
          <IconButton label={t('preview.zoomOut')} shortcut="−" tooltipSide="top" onClick={() => pz.zoomBy(0.8, undefined, undefined, true)}>
            <Minus className="size-4" />
          </IconButton>
          <button
            onClick={() => pz.actualSize()}
            className="h-8 min-w-[52px] rounded-lg px-1.5 font-mono text-[11.5px] tabular-nums text-text-2 hover:bg-surface-3 hover:text-text"
            aria-label={t('preview.zoomLevel', { pct: zoomPct })}
          >
            {zoomPct}%
          </button>
          <IconButton label={t('preview.zoomIn')} shortcut="+" tooltipSide="top" onClick={() => pz.zoomBy(1.25, undefined, undefined, true)}>
            <Plus className="size-4" />
          </IconButton>
          <div className="mx-0.5 h-5 w-px bg-line" />
          <IconButton label={t('preview.fit')} shortcut="0" tooltipSide="top" onClick={() => pz.fit(true)}>
            <ScanSearch className="size-4" />
          </IconButton>
          <IconButton label={fullscreen ? t('preview.exitFullscreen') : t('preview.fullscreen')} tooltipSide="top" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
          </IconButton>
        </div>
      </div>
    </div>
  )
})

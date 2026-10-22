import { useCallback, useEffect, useRef, useState } from 'react'

export interface View {
  x: number
  y: number
  k: number
}

const MIN = 0.08
const MAX = 10
const clamp = (v: number, min = MIN) => Math.min(MAX, Math.max(min, v))

type Size = { width: number; height: number }

/** the scale that shows all of `content` in `el` with some room around it; a very wide diagram goes below MIN */
function fitScale(el: HTMLElement, content: Size) {
  const pad = Math.min(56, el.clientWidth * 0.08)
  return Math.max(0.01, Math.min((el.clientWidth - pad * 2) / content.width, (el.clientHeight - pad * 2) / content.height, 1.75))
}

/**
 * Figma-style canvas: drag or two-finger scroll to pan, pinch / ⌘+scroll / mouse
 * wheel notches to zoom around the cursor. Reports clicks that were not drags.
 */
export function usePanZoom(content: Size | null, onClick?: (target: Element) => void) {
  const ref = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 })
  const viewRef = useRef(view)
  viewRef.current = view
  const touched = useRef(false)
  const [animating, setAnimating] = useState(false)
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  const apply = useCallback((next: View, animate = false) => {
    setAnimating(animate)
    setView(next)
  }, [])

  const fit = useCallback(
    (animate = true) => {
      const el = ref.current
      if (!el || !content) return
      const k = fitScale(el, content)
      apply({ k, x: (el.clientWidth - content.width * k) / 2, y: (el.clientHeight - content.height * k) / 2 }, animate)
      touched.current = false
    },
    [content, apply],
  )

  // zooming out always reaches the fitted view, however small that is
  const floor = useCallback(() => (ref.current && content ? Math.min(MIN, fitScale(ref.current, content)) : MIN), [content])

  const zoomBy = useCallback(
    (factor: number, cx?: number, cy?: number, animate = false) => {
      const el = ref.current
      if (!el) return
      const v = viewRef.current
      const px = cx ?? el.clientWidth / 2
      const py = cy ?? el.clientHeight / 2
      const k = clamp(v.k * factor, floor())
      const ratio = k / v.k
      apply({ k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio }, animate)
      touched.current = true
    },
    [apply, floor],
  )

  const actualSize = useCallback(() => {
    const el = ref.current
    if (!el || !content) return
    apply({ k: 1, x: (el.clientWidth - content.width) / 2, y: Math.max(24, (el.clientHeight - content.height) / 2) }, true)
    touched.current = true
  }, [content, apply])

  // refit while the user has not taken control of the camera
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (!touched.current) fit(false)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const mouseNotch = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY))
      if (e.ctrlKey || e.metaKey || mouseNotch) {
        const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
        zoomBy(Math.exp(-delta * (e.ctrlKey && !mouseNotch ? 0.012 : 0.0022)), cx, cy)
      } else {
        const v = viewRef.current
        apply({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
        touched.current = true
      }
    }
    const pointers = new Map<number, { x: number; y: number }>()
    // pointer capture retargets later events to the container, so remember what was pressed
    let start: { x: number; y: number; moved: boolean; target: Element } | null = null
    let pinch: { dist: number; k: number } | null = null

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      if ((e.target as HTMLElement).closest('[data-no-pan]')) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture(e.pointerId)
      if (pointers.size === 1) start = { x: e.clientX, y: e.clientY, moved: false, target: e.target as Element }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), k: viewRef.current.k }
      }
    }
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const rect = el.getBoundingClientRect()
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        const target = clamp((pinch.k * dist) / pinch.dist, floor())
        zoomBy(target / viewRef.current.k, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top)
        if (start) start.moved = true
        return
      }
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 4) {
        start.moved = true
        el.style.cursor = 'grabbing'
      }
      if (start?.moved) {
        const v = viewRef.current
        apply({ ...v, x: v.x + dx, y: v.y + dy })
        touched.current = true
      }
    }
    const onUp = (e: PointerEvent) => {
      const clicked = start && !start.moved && pointers.size === 1 ? start.target : null
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinch = null
      el.style.cursor = ''
      if (clicked) clickRef.current?.(clicked)
      if (pointers.size === 0) start = null
    }
    const onDouble = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-no-pan]')) return
      fit(true)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('dblclick', onDouble)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('dblclick', onDouble)
    }
  }, [apply, zoomBy, fit, floor])

  return { ref, view, animating, fit, zoomBy, actualSize, wasTouched: () => touched.current }
}

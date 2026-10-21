import type { Mermaid, MermaidConfig } from 'mermaid'
import { type Diagnostic, diagnose } from './diagnose'

export type MermaidTheme = 'auto' | 'default' | 'neutral' | 'dark' | 'forest' | 'base'

export interface DiagramSettings {
  theme: MermaidTheme
  look: 'classic' | 'handDrawn'
  layout: 'dagre' | 'elk'
  curve: 'basis' | 'linear' | 'step' | 'cardinal'
  /** extra mermaid config as JSON text, merged last */
  advanced: string
}

export const DEFAULT_SETTINGS: DiagramSettings = { theme: 'auto', look: 'classic', layout: 'dagre', curve: 'basis', advanced: '' }

// System fonts only: exported PNGs are rasterized from an <img>, which cannot load web
// fonts, so measuring labels with a web font would clip text in exports.
export const DIAGRAM_FONT =
  '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Segoe UI", "Malgun Gothic", "Noto Sans KR", Roboto, sans-serif'

let loading: Promise<Mermaid> | null = null
let elkRegistered = false
let initKey = ''
let renderSeq = 0

export function loadMermaid(): Promise<Mermaid> {
  loading ??= import('mermaid').then((m) => m.default)
  return loading
}

const PALETTE = ['#2dd4bf', '#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#fb923c', '#c084fc', '#22d3ee', '#f87171', '#a3e635']
const PALETTE_LIGHT = ['#14b8a6', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316', '#a855f7', '#06b6d4', '#ef4444', '#84cc16']

function seriesColors(colors: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  colors.forEach((c, i) => {
    out[`pie${i + 1}`] = c
    out[`cScale${i}`] = c
    if (i < 8) out[`git${i}`] = c
  })
  return out
}

/** The signature "Lagoon" look used by the default theme, tuned for both app modes */
export function lagoonThemeVariables(dark: boolean): Record<string, unknown> {
  return dark
    ? {
        darkMode: true,
        background: '#0a0d11',
        fontFamily: DIAGRAM_FONT,
        primaryColor: '#0f2a2c',
        primaryTextColor: '#e8eef4',
        primaryBorderColor: '#2dd4bf',
        secondaryColor: '#14233a',
        secondaryTextColor: '#e8eef4',
        secondaryBorderColor: '#38bdf8',
        tertiaryColor: '#151b23',
        tertiaryTextColor: '#e8eef4',
        tertiaryBorderColor: '#2f3a48',
        lineColor: '#7b8a9c',
        textColor: '#e8eef4',
        titleColor: '#e8eef4',
        edgeLabelBackground: '#18202a',
        clusterBkg: '#0e1620',
        clusterBorder: '#2a3a4a',
        noteBkgColor: '#2a2410',
        noteTextColor: '#fde68a',
        noteBorderColor: '#a16207',
        actorBkg: '#0f2a2c',
        actorBorder: '#2dd4bf',
        actorTextColor: '#e8eef4',
        actorLineColor: '#3d4b5c',
        signalColor: '#aab6c4',
        signalTextColor: '#e8eef4',
        labelBoxBkgColor: '#0f2a2c',
        labelBoxBorderColor: '#2dd4bf',
        labelTextColor: '#e8eef4',
        loopTextColor: '#e8eef4',
        activationBkgColor: '#14323a',
        activationBorderColor: '#2dd4bf',
        sectionBkgColor: '#0f2a2c',
        altSectionBkgColor: '#121922',
        taskBkgColor: '#115e59',
        taskBorderColor: '#2dd4bf',
        taskTextColor: '#e8eef4',
        taskTextLightColor: '#e8eef4',
        activeTaskBkgColor: '#0369a1',
        activeTaskBorderColor: '#38bdf8',
        doneTaskBkgColor: '#2f3a48',
        doneTaskBorderColor: '#6f7d8e',
        critBkgColor: '#7f1d1d',
        critBorderColor: '#f87171',
        gridColor: '#2a3441',
        excludeBkgColor: '#121820',
        todayLineColor: '#f472b6',
        pieStrokeColor: '#0a0d11',
        pieOuterStrokeColor: '#2a3441',
        pieTitleTextColor: '#e8eef4',
        pieSectionTextColor: '#04211f',
        pieLegendTextColor: '#aab6c4',
        quadrant1Fill: '#0f2a2c',
        quadrant2Fill: '#14233a',
        quadrant3Fill: '#151b23',
        quadrant4Fill: '#1f1a2e',
        quadrantPointFill: '#2dd4bf',
        ...seriesColors(PALETTE),
      }
    : {
        darkMode: false,
        background: '#ffffff',
        fontFamily: DIAGRAM_FONT,
        primaryColor: '#e6faf6',
        primaryTextColor: '#0e1726',
        primaryBorderColor: '#0d9488',
        secondaryColor: '#e8f3fd',
        secondaryTextColor: '#0e1726',
        secondaryBorderColor: '#0284c7',
        tertiaryColor: '#f5f7fa',
        tertiaryTextColor: '#0e1726',
        tertiaryBorderColor: '#cfd6de',
        lineColor: '#7b8a9b',
        textColor: '#0e1726',
        titleColor: '#0e1726',
        edgeLabelBackground: '#ffffff',
        clusterBkg: '#f4f9fd',
        clusterBorder: '#c9d8e6',
        noteBkgColor: '#fff8e1',
        noteTextColor: '#713f12',
        noteBorderColor: '#f59e0b',
        actorBkg: '#e6faf6',
        actorBorder: '#0d9488',
        actorTextColor: '#0e1726',
        actorLineColor: '#b6c2cf',
        signalColor: '#354253',
        signalTextColor: '#0e1726',
        labelBoxBkgColor: '#e6faf6',
        labelBoxBorderColor: '#0d9488',
        activationBkgColor: '#ccf5ee',
        activationBorderColor: '#0d9488',
        sectionBkgColor: '#e6faf6',
        altSectionBkgColor: '#f8fafc',
        taskBkgColor: '#5eead4',
        taskBorderColor: '#0d9488',
        taskTextColor: '#042f2e',
        activeTaskBkgColor: '#7dd3fc',
        activeTaskBorderColor: '#0284c7',
        doneTaskBkgColor: '#e2e8f0',
        doneTaskBorderColor: '#94a3b8',
        critBkgColor: '#fecaca',
        critBorderColor: '#dc2626',
        gridColor: '#e3e7ec',
        excludeBkgColor: '#f3f5f8',
        todayLineColor: '#db2777',
        pieStrokeColor: '#ffffff',
        pieOuterStrokeColor: '#e3e7ec',
        pieSectionTextColor: '#ffffff',
        quadrant1Fill: '#e6faf6',
        quadrant2Fill: '#e8f3fd',
        quadrant3Fill: '#f5f7fa',
        quadrant4Fill: '#f3effe',
        quadrantPointFill: '#0d9488',
        ...seriesColors(PALETTE_LIGHT),
      }
}

/** theme handed to mermaid; the Lagoon look is built on "base" */
export function resolveTheme(settings: DiagramSettings): Exclude<MermaidTheme, 'auto'> {
  return settings.theme === 'auto' ? 'base' : settings.theme
}

export function isDarkDiagram(settings: DiagramSettings, appDark: boolean): boolean {
  return settings.theme === 'dark' || (settings.theme === 'auto' && appDark)
}

export function parseAdvanced(text: string): MermaidConfig | null {
  if (!text.trim()) return {}
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

// Wrap Korean (and other CJK) labels between words instead of mid-word ("플/러그인").
// It lives in themeCSS so it is embedded in the SVG: label boxes are measured with it
// and exported files keep the same line breaks.
const WRAP_CSS = '.nodeLabel, .edgeLabel, .cluster-label, .label, foreignObject div { word-break: keep-all; overflow-wrap: anywhere; }'

// mermaid's own `secure` list. It strips these from in-code directives but trusts initialize(),
// and the advanced JSON arrives in shared links, so they are dropped here and pinned below.
const SECURE_KEYS = new Set(['secure', 'securityLevel', 'startOnLoad', 'maxTextSize', 'suppressErrorRendering', 'maxEdges'])

export function buildConfig(settings: DiagramSettings, appDark: boolean, overrides: MermaidConfig = {}): MermaidConfig {
  const { flowchart: advancedFlowchart, themeVariables: advancedVars, themeCSS: advancedCSS, ...parsed } = parseAdvanced(settings.advanced) ?? {}
  const advanced = Object.fromEntries(Object.entries(parsed).filter(([key]) => !SECURE_KEYS.has(key)))
  const { flowchart: overrideFlowchart, ...rest } = overrides
  const themeVariables = settings.theme === 'auto' ? { ...lagoonThemeVariables(appDark), ...advancedVars } : advancedVars
  return {
    theme: resolveTheme(settings),
    ...(themeVariables ? { themeVariables } : {}),
    look: settings.look,
    layout: settings.layout,
    fontFamily: DIAGRAM_FONT,
    ...advanced,
    ...rest,
    themeCSS: [WRAP_CSS, advancedCSS].filter(Boolean).join('\n'),
    flowchart: { curve: settings.curve, ...advancedFlowchart, ...overrideFlowchart },
    // shared links carry config, so these stay fixed no matter what the JSON says;
    // the two limits are mermaid's defaults and keep a link from freezing the tab in layout
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    maxTextSize: 50_000,
    maxEdges: 500,
  }
}

/** Same diagram without <foreignObject>, which taints the canvas in Safari: the PNG export fallback */
export function plainTextConfig(config: MermaidConfig): MermaidConfig {
  return {
    ...config,
    htmlLabels: false,
    flowchart: { ...config.flowchart, htmlLabels: false },
    // journey ignores htmlLabels; its own default places text in a foreignObject
    journey: { ...config.journey, textPlacement: 'tspan' },
  }
}

async function ready(config: MermaidConfig): Promise<Mermaid> {
  const mermaid = await loadMermaid()
  if (config.layout === 'elk' && !elkRegistered) {
    const elk = await import('@mermaid-js/layout-elk')
    mermaid.registerLayoutLoaders(elk.default)
    elkRegistered = true
  }
  const key = JSON.stringify(config)
  if (key !== initKey) {
    mermaid.initialize(config)
    initKey = key
  }
  return mermaid
}

/** null when the code parses; a located, normalized diagnostic otherwise */
export async function validate(code: string): Promise<Diagnostic | null> {
  const mermaid = await loadMermaid()
  try {
    await mermaid.parse(code)
    return null
  } catch (error) {
    return diagnose(code, error)
  }
}

export interface RenderOutput {
  svg: string
  diagramType: string
  bindFunctions?: (element: Element) => void
  ms: number
}

export async function renderDiagram(code: string, config: MermaidConfig): Promise<RenderOutput> {
  const mermaid = await ready(config)
  const id = `lagoon-${++renderSeq}`
  const started = performance.now()
  try {
    const { svg, diagramType, bindFunctions } = await mermaid.render(id, code)
    return { svg: repairLayout(svg), diagramType, bindFunctions, ms: performance.now() - started }
  } finally {
    // mermaid leaves a temporary container behind when rendering throws
    document.getElementById(`d${id}`)?.remove()
    document.getElementById(id)?.remove()
  }
}

// on curved edges mermaid's own (correct) labels can sit ~17px from the line, so only edges that
// touch a subgraph — the buggy case — are considered, and those are off by 18px and more
const LABEL_SNAP_PX = 10

function toRoot(el: SVGGraphicsElement, x: number, y: number) {
  const m = el.getCTM()
  if (!m) return null
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
}

/**
 * mermaid clips edges that start or end on a subgraph at the cluster border, but leaves
 * the label where the unclipped edge would have run — it ends up floating off the line.
 * Move such a label onto the path's midpoint when it is off its own drawn path.
 */
function snapEdgeLabels(svg: SVGSVGElement): boolean {
  // cluster ids are `${svgId}-${subgraph}`, edge ids `L_${from}_${to}_${n}`
  const prefix = `${svg.id}-`
  const clusters = [...svg.querySelectorAll('g.cluster[id]')].map((g) => (g.id.startsWith(prefix) ? g.id.slice(prefix.length) : g.id))
  const touchesCluster = (edgeId: string) => {
    const ends = edgeId.replace(/_\d+$/, '')
    return clusters.some((c) => ends.startsWith(`L_${c}_`) || ends.endsWith(`_${c}`))
  }
  if (!clusters.length) return false
  let changed = false
  for (const label of svg.querySelectorAll<SVGGElement>('g.edgeLabel')) {
    const id = label.querySelector('[data-id]')?.getAttribute('data-id')
    if (!id || !label.textContent?.trim() || !touchesCluster(id)) continue
    const path = svg.querySelector<SVGPathElement>(`path[data-id="${CSS.escape(id)}"]`)
    const total = path?.getTotalLength() ?? 0
    if (!path || !total) continue
    const box = label.getBBox()
    const center = toRoot(label, box.x + box.width / 2, box.y + box.height / 2)
    if (!center || !box.width) continue
    let nearest = Infinity
    for (let i = 0; i <= 64; i++) {
      const p = path.getPointAtLength((total * i) / 64)
      const q = toRoot(path, p.x, p.y)
      if (q) nearest = Math.min(nearest, Math.hypot(q.x - center.x, q.y - center.y))
    }
    if (nearest <= LABEL_SNAP_PX) continue
    const mid = path.getPointAtLength(total / 2)
    const target = toRoot(path, mid.x, mid.y)
    const parent = (label.parentNode as SVGGraphicsElement | null)?.getCTM()
    const translate = label.getAttribute('transform')?.match(/translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)\s*\)/)
    if (!target || !parent || !translate || !parent.a || !parent.d) continue
    const x = Number(translate[1]) + (target.x - center.x) / parent.a
    const y = Number(translate[2]) + (target.y - center.y) / parent.d
    label.setAttribute('transform', `translate(${x.toFixed(2)}, ${y.toFixed(2)})`)
    changed = true
  }
  return changed
}

/** Geometry fixes need real layout, so the SVG is mounted off-screen for a moment */
function repairLayout(svg: string): string {
  if (!svg.includes('edgeLabel') || !svg.includes('cluster')) return svg
  const host = document.createElement('div')
  // a definite width: mermaid SVGs are width=100%, and a zero-width host collapses their scale to 0
  host.style.cssText = 'position:absolute;left:-100000px;top:0;width:8192px;visibility:hidden;pointer-events:none'
  host.innerHTML = svg
  document.body.appendChild(host)
  try {
    const el = host.querySelector('svg')
    return el && snapEdgeLabels(el) ? new XMLSerializer().serializeToString(el) : svg
  } catch {
    return svg
  } finally {
    host.remove()
  }
}

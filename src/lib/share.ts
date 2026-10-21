import { Inflate, deflate } from 'pako'
import { DEFAULT_SETTINGS, type DiagramSettings, type MermaidTheme } from './mermaid'

/** Same shape mermaid.live keeps in its `#pako:` hash, plus our title */
interface SerializedState {
  code: string
  mermaid: string
  autoSync?: boolean
  updateDiagram?: boolean
  rough?: boolean
  panZoom?: boolean
  title?: string
  /** our own theme choice; mermaid.live ignores unknown fields */
  lagoonTheme?: MermaidTheme
}

export interface SharedDoc {
  code: string
  title?: string
  settings: DiagramSettings
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64(text: string): Uint8Array {
  const normalized = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized + '='.repeat((4 - (normalized.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

const THEMES: MermaidTheme[] = ['default', 'neutral', 'dark', 'forest', 'base']
const CURVES: DiagramSettings['curve'][] = ['basis', 'linear', 'step', 'cardinal']

/** far above any diagram mermaid will render; a few KB of hash must not expand into megabytes */
const MAX_INFLATED_BYTES = 2 * 1024 * 1024

class CappedInflate extends Inflate {
  size = 0
  onData(chunk: Uint8Array<ArrayBuffer>) {
    this.size += chunk.length
    if (this.size > MAX_INFLATED_BYTES) throw new RangeError('shared diagram too large')
    super.onData(chunk)
  }
}

function inflateCapped(bytes: Uint8Array): Uint8Array {
  const inflator = new CappedInflate()
  inflator.push(bytes, true)
  if (inflator.err) throw new Error(inflator.msg)
  return inflator.result
}

export function encodeDoc(doc: SharedDoc, appDark: boolean): string {
  const resolvedTheme = doc.settings.theme === 'auto' ? (appDark ? 'dark' : 'default') : doc.settings.theme
  let extra: Record<string, unknown> = {}
  try {
    extra = doc.settings.advanced.trim() ? JSON.parse(doc.settings.advanced) : {}
  } catch {
    extra = {}
  }
  const config: Record<string, unknown> = { theme: resolvedTheme, ...extra }
  if (doc.settings.look !== 'classic') config.look = doc.settings.look
  if (doc.settings.layout !== 'dagre') config.layout = doc.settings.layout
  // same precedence as buildConfig: a curve in the advanced JSON wins over the setting
  if (doc.settings.curve !== 'basis') config.flowchart = { curve: doc.settings.curve, ...(extra.flowchart as object) }
  const state: SerializedState = {
    code: doc.code,
    mermaid: JSON.stringify(config, null, 2),
    autoSync: true,
    updateDiagram: true,
    rough: doc.settings.look === 'handDrawn',
    title: doc.title,
    lagoonTheme: doc.settings.theme,
  }
  return `pako:${toBase64Url(deflate(new TextEncoder().encode(JSON.stringify(state)), { level: 9 }))}`
}

export function decodeHash(hash: string): SharedDoc | null {
  const raw = hash.replace(/^#/, '')
  let json: string
  try {
    if (raw.startsWith('pako:')) json = new TextDecoder().decode(inflateCapped(fromBase64(raw.slice(5))))
    else if (raw.startsWith('base64:')) json = new TextDecoder().decode(fromBase64(raw.slice(7)))
    else return null
  } catch {
    return null
  }
  let state: SerializedState
  try {
    state = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof state?.code !== 'string') return null

  const settings: DiagramSettings = { ...DEFAULT_SETTINGS }
  try {
    const { theme, look, layout, ...rest } = JSON.parse(state.mermaid || '{}') as Record<string, unknown>
    if (typeof theme === 'string' && THEMES.includes(theme as MermaidTheme)) settings.theme = theme as MermaidTheme
    if (look === 'handDrawn' || state.rough) settings.look = 'handDrawn'
    if (layout === 'elk') settings.layout = 'elk'
    const { curve, ...flowchart } = (rest.flowchart ?? {}) as Record<string, unknown>
    if (CURVES.includes(curve as DiagramSettings['curve'])) {
      settings.curve = curve as DiagramSettings['curve']
      // left in the advanced JSON it would override the setting again
      if (Object.keys(flowchart).length) rest.flowchart = flowchart
      else delete rest.flowchart
    }
    if (Object.keys(rest).length) settings.advanced = JSON.stringify(rest, null, 2)
    if (state.lagoonTheme === 'auto') settings.theme = 'auto'
  } catch {
    /* keep defaults when the config blob is malformed */
  }
  return { code: state.code, title: typeof state.title === 'string' ? state.title : undefined, settings }
}

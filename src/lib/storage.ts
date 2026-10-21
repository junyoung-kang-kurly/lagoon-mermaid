import { DEFAULT_SETTINGS, type DiagramSettings } from './mermaid'

export interface StoredDoc {
  code: string
  title: string
  settings: DiagramSettings
}

export interface Snapshot {
  id: string
  ts: number
  title: string
  code: string
  /** written by autosave; only these collapse into the next autosave */
  auto?: boolean
}

const DOC_KEY = 'lagoon:doc'
const HISTORY_KEY = 'lagoon:history'
const PREFS_KEY = 'lagoon:prefs'
const MAX_HISTORY = 60
const COLLAPSE_MS = 90_000

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded or storage blocked — autosave is best effort */
  }
}

export function loadDoc(): StoredDoc | null {
  const doc = read<StoredDoc>(DOC_KEY)
  if (!doc || typeof doc.code !== 'string') return null
  return { code: doc.code, title: doc.title ?? '', settings: { ...DEFAULT_SETTINGS, ...doc.settings } }
}

export const saveDoc = (doc: StoredDoc) => write(DOC_KEY, doc)

export function loadHistory(): Snapshot[] {
  const list = read<Snapshot[]>(HISTORY_KEY)
  return Array.isArray(list) ? list : []
}

/** `force` marks a manual save or the checkpoint taken before the document is replaced: never collapsed away */
export function pushHistory(entry: Pick<Snapshot, 'code' | 'title'>, force = false): Snapshot[] {
  const list = loadHistory()
  const latest = list[0]
  if (!entry.code.trim()) return list
  if (latest?.code === entry.code) {
    if (!force || (!latest.auto && latest.title === entry.title)) return list
    return saveHistory([{ ...latest, title: entry.title, auto: false }, ...list.slice(1)])
  }
  // one entry per burst of edits; it keeps the burst's first ts, so the window cannot slide forever
  if (!force && latest?.auto && latest.title === entry.title && Date.now() - latest.ts < COLLAPSE_MS)
    return saveHistory([{ ...latest, code: entry.code }, ...list.slice(1)])
  const id = crypto.randomUUID?.() ?? String(Date.now())
  return saveHistory([{ ...entry, id, ts: Date.now(), ...(force ? {} : { auto: true }) }, ...list])
}

function saveHistory(list: Snapshot[]): Snapshot[] {
  const next = list.slice(0, MAX_HISTORY)
  write(HISTORY_KEY, next)
  return next
}

export function clearHistory(): Snapshot[] {
  write(HISTORY_KEY, [])
  return []
}

export interface Prefs {
  appTheme: 'dark' | 'light'
  swapped: boolean
  grid: boolean
}

export function loadPrefs(): Prefs {
  const prefersLight = typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches
  return { appTheme: prefersLight ? 'light' : 'dark', swapped: false, grid: true, ...read<Partial<Prefs>>(PREFS_KEY) }
}

export const savePrefs = (prefs: Prefs) => write(PREFS_KEY, prefs)

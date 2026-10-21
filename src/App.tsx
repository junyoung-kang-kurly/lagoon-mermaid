import {
  ArrowLeftRight,
  Code2,
  Command as CommandIcon,
  Copy,
  Download,
  FileCode2,
  FilePlus2,
  FileUp,
  FolderOpen,
  Grid3x3,
  History,
  Image as ImageIcon,
  Languages,
  LayoutTemplate,
  Link2,
  Loader2,
  Moon,
  ScanSearch,
  Settings2,
  Share2,
  Sparkles,
  Sun,
  TextQuote,
  WandSparkles,
} from 'lucide-react'
import type { MermaidConfig } from 'mermaid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { type Command, CommandPalette } from './components/CommandPalette'
import { ErrorDock } from './components/ErrorDock'
import { FixSheet } from './components/FixSheet'
import { Logo } from './components/Logo'
import { HistoryPanel, SettingsPanel } from './components/Panels'
import { type NodeTarget, Preview, type PreviewHandle } from './components/Preview'
import { TemplatesDialog } from './components/TemplatesDialog'
import { Toaster, toast } from './components/Toaster'
import { Button, IconButton, Kbd, MenuItem, MenuSeparator, Popover, Segmented, cx } from './components/ui'
import { Editor, useEditor } from './editor/Editor'
import { useDiagram } from './hooks/useDiagram'
import { explain } from './lib/explain'
import { copyBlob, copyText, downloadBlob, downloadText, slugify, standaloneSvg, svgToPng } from './lib/export'
import type { FixResult } from './lib/fix/engine'
import { formatCode } from './lib/format'
import { getLang, setLang, t, useLang } from './lib/i18n'
import { type DiagramSettings, buildConfig, isDarkDiagram, plainTextConfig, renderDiagram } from './lib/mermaid'
import { WELCOME } from './lib/samples'
import { decodeHash, encodeDoc } from './lib/share'
import { type Prefs, type Snapshot, clearHistory, loadDoc, loadHistory, loadPrefs, pushHistory, saveDoc, savePrefs } from './lib/storage'

interface Doc {
  code: string
  title: string
  settings: DiagramSettings
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

function initialDoc(): { doc: Doc; fromLink: boolean } {
  const shared = typeof location !== 'undefined' ? decodeHash(location.hash) : null
  const saved = loadDoc()
  if (shared) {
    // the stored doc may be a draft that never rendered, so autosave never kept a copy of it
    if (saved && saved.code !== shared.code) pushHistory({ code: saved.code, title: saved.title }, true)
    return { doc: { code: shared.code, title: shared.title ?? '', settings: shared.settings }, fromLink: true }
  }
  if (saved) return { doc: saved, fromLink: false }
  return { doc: { code: WELCOME[getLang()], title: '', settings: { theme: 'auto', look: 'classic', layout: 'dagre', curve: 'basis', advanced: '' } }, fromLink: false }
}

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    // some embedded/emulated viewports resize without firing the media query's change event
    window.addEventListener('resize', on)
    return () => {
      mq.removeEventListener('change', on)
      window.removeEventListener('resize', on)
    }
  }, [query])
  return match
}

function extractMermaid(text: string): string {
  const block = text.match(/```mermaid[ \t]*\n([\s\S]*?)```/)
  return block ? block[1].trimEnd() : text
}

export default function App() {
  const lang = useLang()
  const [{ doc: seed, fromLink }] = useState(initialDoc)
  const [doc, setDoc] = useState<Doc>(seed)
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [history, setHistory] = useState<Snapshot[]>(loadHistory)
  const [cursor, setCursor] = useState({ line: 1, col: 1 })
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [fixOpen, setFixOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'code' | 'preview'>('code')
  const [dragging, setDragging] = useState(false)
  const preview = useRef<PreviewHandle>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const wide = useMediaQuery('(min-width: 768px)')

  const dark = prefs.appTheme === 'dark'
  const config: MermaidConfig = useMemo(() => buildConfig(doc.settings, dark), [doc.settings, dark])
  const diagram = useDiagram(doc.code, config)

  // ── persistence ───────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#07090c' : '#f4f6f8')
    savePrefs(prefs)
  }, [prefs, dark])

  useEffect(() => {
    const id = window.setTimeout(() => saveDoc(doc), 300)
    return () => window.clearTimeout(id)
  }, [doc])

  useEffect(() => {
    if (diagram.status !== 'ok') return
    const id = window.setTimeout(() => setHistory(pushHistory({ code: doc.code, title: doc.title })), 2500)
    return () => window.clearTimeout(id)
  }, [diagram.status, doc.code, doc.title])

  useEffect(() => {
    if (!fromLink) return
    window.history.replaceState(null, '', location.pathname + location.search)
    toast(t('share.loaded'), 'magic')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.title = doc.title ? `${doc.title} · Lagoon` : 'Lagoon — Mermaid editor that fixes itself'
  }, [doc.title])

  // ── actions ───────────────────────────────────────────────────
  const setCode = useCallback((code: string) => setDoc((d) => (d.code === code ? d : { ...d, code })), [])

  const editor = useEditor({
    initial: seed.code,
    placeholderText: lang === 'ko' ? 'flowchart TD 처럼 다이어그램 종류부터 적어 보세요…' : 'Start with a diagram type, e.g. flowchart TD…',
    onChange: setCode,
    onCursor: (line, col) => setCursor({ line, col }),
  })

  const loadCode = useCallback(
    (code: string, title = '', settings?: DiagramSettings) => {
      setHistory(pushHistory({ code: doc.code, title: doc.title }, true))
      editor.replace(code)
      setDoc((d) => ({ ...d, code, title, settings: settings ?? d.settings }))
      if (!wide) setMobileTab('preview')
    },
    [doc.code, doc.title, wide, editor],
  )

  // pasting a share link into an open tab only changes the fragment; the page does not reload
  useEffect(() => {
    const onHash = () => {
      const shared = decodeHash(location.hash)
      if (!shared) return
      loadCode(shared.code, shared.title ?? '', shared.settings)
      window.history.replaceState(null, '', location.pathname + location.search)
      toast(t('share.loaded'), 'magic')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [loadCode])

  const applyFix = useCallback(
    (result?: FixResult) => {
      if (!result) return
      editor.replace(result.code)
      setCode(result.code)
      setFixOpen(false)
      toast(`${t('fix.applied', { n: result.steps.length })} · ${MOD}Z`, 'magic')
    },
    [setCode, editor],
  )

  const runFix = useCallback(() => {
    if (diagram.fix.state === 'ready') applyFix(diagram.fix.result)
  }, [diagram.fix, applyFix])

  const gotoError = useCallback(() => {
    const e = diagram.error
    if (!e) return
    if (!wide) setMobileTab('code')
    window.setTimeout(() => editor.goTo(e.line, e.column, e.atEnd ? 0 : e.length), 0)
  }, [diagram.error, wide, editor])

  const shareLink = useCallback(async () => {
    const hash = encodeDoc(doc, dark)
    const url = `${location.origin}${location.pathname}#${hash}`
    try {
      await copyText(url)
      toast(t('share.copied'))
    } catch {
      window.prompt(t('share.copied'), url)
    }
  }, [doc, dark])

  const background = isDarkDiagram(doc.settings, dark) ? '#0d1116' : '#ffffff'
  const fileBase = slugify(doc.title || t('app.untitled'))

  const pngBlob = useCallback(
    async (scale: number, transparent = false): Promise<Blob> => {
      const svg = diagram.svg
      if (!svg) throw new Error('nothing to export')
      try {
        return await svgToPng(svg, scale, transparent ? null : background)
      } catch {
        // foreignObject labels taint the canvas in Safari: re-render with plain SVG text
        const plain = await renderDiagram(diagram.svgCode ?? doc.code, plainTextConfig(config))
        return svgToPng(plain.svg, scale, transparent ? null : background)
      }
    },
    [diagram.svg, diagram.svgCode, doc.code, config, background],
  )

  const exportAction = useCallback(
    async (kind: 'svg' | 'png1' | 'png2' | 'png4' | 'pngT' | 'copyPng' | 'copySvg' | 'copyMd' | 'mmd') => {
      setExportOpen(false)
      if (kind === 'mmd') return downloadText(doc.code, `${fileBase}.mmd`)
      if (kind === 'copyMd') {
        await copyText('```mermaid\n' + doc.code.trimEnd() + '\n```\n')
        return toast(t('export.copied'))
      }
      if (!diagram.svg) return toast(t('export.noDiagram'), 'error')
      try {
        if (kind === 'svg') downloadText(standaloneSvg(diagram.svg), `${fileBase}.svg`, 'image/svg+xml')
        else if (kind === 'copySvg') {
          await copyText(standaloneSvg(diagram.svg))
          return toast(t('export.copied'))
        } else if (kind === 'copyPng') {
          await copyBlob(pngBlob(2))
          return toast(t('export.copied'))
        } else {
          const scale = kind === 'png1' ? 1 : kind === 'png4' ? 4 : 2
          downloadBlob(await pngBlob(scale, kind === 'pngT'), `${fileBase}.png`)
        }
        toast(t('export.done'))
      } catch {
        toast(t('export.failed'), 'error')
      }
    },
    [doc.code, diagram.svg, fileBase, pngBlob],
  )

  const openFile = useCallback(
    async (file: File) => {
      // the editor keeps \n only, and a CRLF Markdown fence would not match either
      const text = (await file.text()).replace(/\r\n?/g, '\n')
      loadCode(extractMermaid(text), file.name.replace(/\.(mmd|mermaid|md|txt)$/i, ''))
      toast(t('toast.fileLoaded', { name: file.name }))
    },
    [loadCode],
  )

  const format = useCallback(() => {
    const next = formatCode(doc.code)
    editor.replace(next)
    setCode(next)
  }, [doc.code, setCode, editor])

  const onNodeClick = useCallback(
    (node: NodeTarget) => {
      const code = doc.code
      const lines = code.split('\n')
      let hit: { line: number; col: number; len: number } | null = null
      const find = (needle: string, asId: boolean) => {
        const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const re = asId ? new RegExp(`(^|[^\\p{L}\\p{N}_])(${escaped})(?![\\p{L}\\p{N}_])`, 'u') : new RegExp(escaped)
        for (let i = 0; i < lines.length; i++) {
          if (/^\s*%%/.test(lines[i])) continue
          const m = lines[i].match(re)
          if (m && m.index !== undefined) {
            const offset = asId ? m.index + m[1].length : m.index
            return { line: i + 1, col: offset, len: needle.length }
          }
        }
        return null
      }
      if (node.id) hit = find(node.id, true)
      if (!hit && node.text) {
        const words = node.text.split(' ')
        for (let n = words.length; n > 0 && !hit; n--) hit = find(words.slice(0, n).join(' '), false)
      }
      if (!hit) return
      if (!wide) setMobileTab('code')
      const target = hit
      window.setTimeout(() => editor.goTo(target.line, target.col, target.len), 0)
    },
    [doc.code, wide, editor],
  )

  const toggleTheme = useCallback(() => setPrefs((p) => ({ ...p, appTheme: p.appTheme === 'dark' ? 'light' : 'dark' })), [])
  const toggleLang = useCallback(() => setLang(getLang() === 'ko' ? 'en' : 'ko'), [])
  const newDoc = useCallback(() => {
    loadCode('flowchart TD\n    A[Start] --> B[End]\n', '')
    toast(t('toast.newDoc'))
    window.setTimeout(() => editor.focus(), 0)
  }, [loadCode, editor])
  const saveSnapshot = useCallback(() => {
    setHistory(pushHistory({ code: doc.code, title: doc.title }, true))
    toast(t('history.saved'))
  }, [doc.code, doc.title])

  // ── keyboard ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      const typing = (e.target as HTMLElement).closest('input, textarea, .cm-editor')
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      } else if (mod && e.key === '.') {
        e.preventDefault()
        runFix()
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveSnapshot()
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        format()
      } else if (!typing && !mod && (e.key === '+' || e.key === '=')) preview.current?.zoomIn()
      else if (!typing && !mod && e.key === '-') preview.current?.zoomOut()
      else if (!typing && !mod && e.key === '0') preview.current?.fit()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [runFix, saveSnapshot, format])

  // drag & drop files anywhere
  useEffect(() => {
    let depth = 0
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files')
    const enter = (e: DragEvent) => hasFiles(e) && (depth++, setDragging(true))
    const leave = (e: DragEvent) => hasFiles(e) && --depth <= 0 && (depth = 0, setDragging(false))
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault()
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      const file = e.dataTransfer?.files[0]
      if (file) void openFile(file)
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', over)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', over)
      window.removeEventListener('drop', drop)
    }
  }, [openFile])

  const commands: Command[] = useMemo(
    () => [
      { id: 'fix', label: t('cmd.fix'), group: 'Lagoon', icon: <WandSparkles className="size-4" />, shortcut: [MOD, '.'], disabled: diagram.fix.state !== 'ready', run: runFix },
      { id: 'templates', label: t('toolbar.templates'), group: 'Lagoon', icon: <LayoutTemplate className="size-4" />, run: () => setTemplatesOpen(true) },
      { id: 'new', label: t('cmd.newDoc'), group: 'Lagoon', icon: <FilePlus2 className="size-4" />, run: newDoc },
      { id: 'open', label: t('export.open'), group: 'Lagoon', icon: <FolderOpen className="size-4" />, run: () => fileInput.current?.click() },
      { id: 'format', label: t('cmd.format'), group: 'Editor', icon: <TextQuote className="size-4" />, shortcut: [MOD, '⇧', 'F'], run: format },
      { id: 'focus', label: t('cmd.focusEditor'), group: 'Editor', icon: <Code2 className="size-4" />, run: () => editor.focus() },
      { id: 'save', label: t('history.saveNow'), group: 'Editor', icon: <History className="size-4" />, shortcut: [MOD, 'S'], run: saveSnapshot },
      { id: 'share', label: t('toolbar.share'), group: 'Export', icon: <Link2 className="size-4" />, run: shareLink },
      { id: 'svg', label: t('export.svg'), group: 'Export', icon: <FileCode2 className="size-4" />, run: () => exportAction('svg') },
      { id: 'png', label: t('export.png2x'), group: 'Export', icon: <ImageIcon className="size-4" />, run: () => exportAction('png2') },
      { id: 'copyPng', label: t('export.copyPng'), group: 'Export', icon: <Copy className="size-4" />, run: () => exportAction('copyPng') },
      { id: 'copyMd', label: t('export.copyMd'), group: 'Export', icon: <Copy className="size-4" />, run: () => exportAction('copyMd') },
      { id: 'fit', label: t('cmd.fit'), group: 'View', icon: <ScanSearch className="size-4" />, shortcut: ['0'], run: () => preview.current?.fit() },
      { id: 'swap', label: t('cmd.layoutSwap'), group: 'View', icon: <ArrowLeftRight className="size-4" />, run: () => setPrefs((p) => ({ ...p, swapped: !p.swapped })) },
      { id: 'grid', label: t('preview.grid'), group: 'View', icon: <Grid3x3 className="size-4" />, run: () => setPrefs((p) => ({ ...p, grid: !p.grid })) },
      { id: 'theme', label: t('cmd.toggleTheme'), group: 'View', icon: dark ? <Sun className="size-4" /> : <Moon className="size-4" />, run: toggleTheme },
      { id: 'lang', label: t('cmd.toggleLang'), group: 'View', icon: <Languages className="size-4" />, run: toggleLang },
    ],
    // lang re-labels every command
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, dark, diagram.fix.state, runFix, newDoc, format, saveSnapshot, shareLink, exportAction, toggleTheme, toggleLang, editor],
  )

  // ── layout ────────────────────────────────────────────────────
  const errorMessage = diagram.error ? explain(lang, doc.code, diagram.error).title.replace(/`/g, '') : ''
  const status = diagram.status

  const editorPane = (
    <section className="relative flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-text-2">
          <Code2 className="size-3.5 text-accent" />
          {t('pane.code')}
        </span>
        <span className="truncate font-mono text-[11.5px] text-muted">{fileBase}.mmd</span>
        <div className="ml-auto flex items-center">
          <IconButton label={t('cmd.format')} shortcut={`${MOD}⇧F`} onClick={format}>
            <TextQuote className="size-3.5" />
          </IconButton>
          <IconButton label={t('export.open')} onClick={() => fileInput.current?.click()}>
            <FileUp className="size-3.5" />
          </IconButton>
          {wide && (
            <IconButton label={t('cmd.layoutSwap')} onClick={() => setPrefs((p) => ({ ...p, swapped: !p.swapped }))}>
              <ArrowLeftRight className="size-3.5" />
            </IconButton>
          )}
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <Editor
          editor={editor}
          problem={diagram.error ? { line: diagram.error.line, column: diagram.error.column, length: diagram.error.atEnd ? 1 : diagram.error.length, message: errorMessage } : null}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
          {diagram.status === 'error' && diagram.error && (
            <ErrorDock
              code={doc.code}
              error={diagram.error}
              fix={diagram.fix}
              onGoto={gotoError}
              onApplyFix={runFix}
              onPreviewFix={() => setFixOpen(true)}
            />
          )}
        </div>
      </div>
      <div className="flex h-7 shrink-0 items-center gap-3 border-t border-line px-3 text-[11px] text-muted">
        <span className="tabular-nums">{t('editor.position', { line: cursor.line, col: cursor.col })}</span>
        <span className="tabular-nums">{t('editor.chars', { n: doc.code.length.toLocaleString() })}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-ok/80" />
          {t('editor.saved')}
        </span>
        <span className="hidden font-mono sm:inline">mermaid 12.2.0</span>
      </div>
    </section>
  )

  const previewPane = (
    <section className="relative h-full min-h-0">
      <Preview
        ref={preview}
        svg={diagram.svg}
        status={status}
        hasError={status === 'error'}
        diagramType={diagram.diagramType}
        ms={diagram.ms}
        renderCount={diagram.renderCount}
        bind={diagram.bind}
        grid={prefs.grid}
        fixReady={diagram.fix.state === 'ready'}
        onFix={runFix}
        onNodeClick={onNodeClick}
      />
      {!wide && status === 'error' && (
        <button
          onClick={() => (diagram.fix.state === 'ready' ? runFix() : gotoError())}
          className="absolute left-1/2 top-3 flex -translate-x-1/2 animate-pop items-center gap-2 rounded-full border border-danger/30 bg-surface-2/95 px-3.5 py-2 text-[12.5px] shadow-float backdrop-blur"
        >
          <span className="size-1.5 rounded-full bg-danger" />
          {t('status.error')}
          {diagram.fix.state === 'ready' && (
            <span className="flex items-center gap-1 font-semibold text-accent">
              <Sparkles className="size-3.5" />
              {t('error.fixCta')}
            </span>
          )}
        </button>
      )}
    </section>
  )

  const statusPill = (
    <button
      onClick={() => (status === 'error' ? (diagram.fix.state === 'ready' ? setFixOpen(true) : gotoError()) : undefined)}
      className={cx(
        'hidden h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium transition-colors sm:flex',
        status === 'ok' && 'border-ok/25 bg-ok/10 text-ok',
        status === 'error' && diagram.fix.state === 'ready' && 'border-accent/30 bg-accent-soft text-accent hover:bg-accent/15',
        status === 'error' && diagram.fix.state !== 'ready' && 'border-danger/25 bg-danger-soft text-danger',
        (status === 'loading' || status === 'rendering' || status === 'empty') && 'border-line bg-surface-3 text-muted',
      )}
    >
      {status === 'loading' || status === 'rendering' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : status === 'error' && diagram.fix.state === 'ready' ? (
        <Sparkles className="size-3" />
      ) : (
        <span className={cx('size-1.5 rounded-full', status === 'ok' ? 'bg-ok' : status === 'error' ? 'bg-danger' : 'bg-muted')} />
      )}
      {status === 'loading'
        ? t('status.loading')
        : status === 'rendering'
          ? t('status.rendering')
          : status === 'error'
            ? diagram.fix.state === 'ready'
              ? t('status.fixable')
              : t('status.error')
            : status === 'ok'
              ? t('status.ok')
              : '—'}
    </button>
  )

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line bg-bg/80 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <a href="/" className="flex shrink-0 items-center gap-2" onClick={(e) => e.preventDefault()}>
          <Logo className="size-7" />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-[14.5px] font-bold tracking-tight">Lagoon</span>
            <span className="mt-0.5 text-[10.5px] text-muted">{t('app.tagline')}</span>
          </span>
        </a>
        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
        <input
          value={doc.title}
          onChange={(e) => setDoc((d) => ({ ...d, title: e.target.value }))}
          placeholder={t('app.untitled')}
          className="hidden h-8 min-w-0 max-w-[260px] flex-1 rounded-lg sm:block bg-transparent px-2 text-[13.5px] font-medium outline-none transition-colors placeholder:text-muted hover:bg-surface-3 focus:bg-surface-3"
        />
        {statusPill}
        <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
          <span className="hidden lg:inline-flex">
            <Button variant="ghost" icon={<LayoutTemplate className="size-4" />} onClick={() => setTemplatesOpen(true)}>
              {t('toolbar.templates')}
            </Button>
          </span>
          <span className="lg:hidden">
            <IconButton label={t('toolbar.templates')} onClick={() => setTemplatesOpen(true)}>
              <LayoutTemplate className="size-4" />
            </IconButton>
          </span>
          <Popover
            className="max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:w-auto"
            trigger={({ toggle, open }) => (
              <span className="hidden sm:inline-flex">
                <IconButton label={t('toolbar.history')} active={open} onClick={toggle}>
                  <History className="size-4" />
                </IconButton>
              </span>
            )}
          >
            {(close) => (
              <HistoryPanel
                items={history}
                onSave={saveSnapshot}
                onClear={() => setHistory(clearHistory())}
                onRestore={(s) => {
                  close()
                  loadCode(s.code, s.title)
                  toast(t('history.restored'))
                }}
              />
            )}
          </Popover>
          <Popover
            className="max-sm:fixed max-sm:inset-x-3 max-sm:top-14 max-sm:w-auto"
            trigger={({ toggle, open }) => (
              <IconButton label={t('toolbar.settings')} active={open} onClick={toggle}>
                <Settings2 className="size-4" />
              </IconButton>
            )}
          >
            <SettingsPanel value={doc.settings} onChange={(settings) => setDoc((d) => ({ ...d, settings }))} />
          </Popover>
          <IconButton label={t('toolbar.theme')} onClick={toggleTheme}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
          <span className="hidden sm:inline-flex">
            <IconButton label={t('toolbar.lang')} onClick={toggleLang}>
              <span className="text-[11.5px] font-semibold">{lang === 'ko' ? 'EN' : '한'}</span>
            </IconButton>
          </span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden h-8 items-center gap-1.5 rounded-lg border border-line px-2 text-[12px] text-muted transition-colors hover:border-line-strong hover:text-text md:flex"
          >
            <CommandIcon className="size-3.5" />
            <Kbd>{MOD}</Kbd>
            <Kbd>K</Kbd>
          </button>
          <Popover
            open={exportOpen}
            onOpenChange={setExportOpen}
            trigger={({ toggle, open }) => (
              <Button variant="outline" className={cx('ml-1 px-2.5 sm:px-3', open && 'bg-surface-3')} icon={<Download className="size-4" />} onClick={toggle}>
                <span className="hidden sm:inline">{t('toolbar.export')}</span>
              </Button>
            )}
            className="w-64"
          >
            <MenuItem icon={<ImageIcon className="size-4" />} hint="2x" onClick={() => exportAction('png2')}>
              {t('export.png')}
            </MenuItem>
            <MenuItem icon={<ImageIcon className="size-4" />} hint="4x" onClick={() => exportAction('png4')}>
              {t('export.png4x')}
            </MenuItem>
            <MenuItem icon={<ImageIcon className="size-4" />} onClick={() => exportAction('pngT')}>
              {t('export.transparent')}
            </MenuItem>
            <MenuItem icon={<FileCode2 className="size-4" />} onClick={() => exportAction('svg')}>
              {t('export.svg')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Copy className="size-4" />} onClick={() => exportAction('copyPng')}>
              {t('export.copyPng')}
            </MenuItem>
            <MenuItem icon={<Copy className="size-4" />} onClick={() => exportAction('copySvg')}>
              {t('export.copySvg')}
            </MenuItem>
            <MenuItem icon={<TextQuote className="size-4" />} onClick={() => exportAction('copyMd')}>
              {t('export.copyMd')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Download className="size-4" />} onClick={() => exportAction('mmd')}>
              {t('export.mmd')}
            </MenuItem>
          </Popover>
          <Button variant="primary" className="px-2.5 sm:px-3" icon={<Share2 className="size-4" />} onClick={shareLink}>
            <span className="hidden sm:inline">{t('toolbar.share')}</span>
          </Button>
        </div>
      </header>

      {wide ? (
        <Group orientation="horizontal" className="min-h-0 flex-1">
          {prefs.swapped ? (
            <>
              <Panel id="preview" minSize="25%">
                {previewPane}
              </Panel>
              <Separator />
              <Panel id="editor" defaultSize="40%" minSize="22%">
                {editorPane}
              </Panel>
            </>
          ) : (
            <>
              <Panel id="editor" defaultSize="40%" minSize="22%">
                {editorPane}
              </Panel>
              <Separator />
              <Panel id="preview" minSize="25%">
                {previewPane}
              </Panel>
            </>
          )}
        </Group>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 justify-center border-b border-line bg-surface py-2">
            <Segmented<'code' | 'preview'>
              value={mobileTab}
              onChange={setMobileTab}
              options={[
                { value: 'code' as const, label: t('pane.code') },
                { value: 'preview' as const, label: t('pane.preview') },
              ]}
            />
          </div>
          <div className={cx('min-h-0 flex-1', mobileTab !== 'code' && 'hidden')}>{editorPane}</div>
          <div className={cx('min-h-0 flex-1', mobileTab !== 'preview' && 'hidden')}>{previewPane}</div>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept=".mmd,.mermaid,.md,.txt,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void openFile(f)
          e.target.value = ''
        }}
      />

      <TemplatesDialog
        open={templatesOpen}
        config={config}
        onClose={() => setTemplatesOpen(false)}
        onPick={(code, name) => {
          setTemplatesOpen(false)
          loadCode(code, name === 'broken' ? '' : name)
        }}
      />
      <FixSheet open={fixOpen} before={doc.code} result={diagram.fix.result} onApply={() => applyFix(diagram.fix.result)} onClose={() => setFixOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <Toaster />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center bg-bg/70 backdrop-blur-sm">
          <div className="flex animate-pop flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent bg-surface-2 px-12 py-10">
            <FileUp className="size-8 text-accent" />
            <div className="text-[15px] font-semibold">{t('drop.title')}</div>
            <div className="text-[12.5px] text-muted">{t('drop.body')}</div>
          </div>
        </div>
      )}
    </div>
  )
}

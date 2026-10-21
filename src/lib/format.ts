import { familyOf } from './fix/text'

const INDENT = '    '
const REINDENTABLE = new Set(['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'journey', 'git', 'pie'])

const OPEN = /^(subgraph\b|loop\b|alt\b|opt\b|par\b|par_over\b|rect\b|critical\b|break\b|box\b)|\{\s*$/
const MIDDLE = /^(else\b|and\b|option\b)/
const CLOSE = /^(end\b|\})/

/** Re-indents block structure; indentation-sensitive diagrams (mindmap, …) only lose trailing spaces */
export function formatCode(code: string): string {
  const lines = code.replace(/\r\n?/g, '\n').replace(/\t/g, INDENT).split('\n').map((l) => l.replace(/\s+$/, ''))
  if (!REINDENTABLE.has(familyOf(code))) return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'

  const out: string[] = []
  let depth = 0
  let inFrontmatter = lines[0]?.trim() === '---'
  let headerSeen = false
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim()
    if (inFrontmatter) {
      out.push(raw)
      if (i > 0 && line === '---') inFrontmatter = false
      continue
    }
    if (!line) {
      out.push('')
      continue
    }
    if (!headerSeen && !line.startsWith('%%')) {
      headerSeen = true
      out.push(line)
      depth = 1
      continue
    }
    if (CLOSE.test(line)) depth = Math.max(1, depth - 1)
    const level = MIDDLE.test(line) ? Math.max(1, depth - 1) : depth
    out.push(INDENT.repeat(level) + line)
    if (OPEN.test(line) && !line.startsWith('%%')) depth++
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

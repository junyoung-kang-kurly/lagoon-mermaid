const TEXT_EXT = /\.(mmd|mermaid|md|markdown|txt)$/i

/** files the editor can open: Mermaid/Markdown/plain text by extension, or any text/* type */
export function isTextFile(file: { name: string; type: string }): boolean {
  return TEXT_EXT.test(file.name) || file.type.startsWith('text/')
}

export const fileTitle = (name: string) => name.replace(TEXT_EXT, '')

/** the first ```mermaid fence of a Markdown file, or the whole text */
export function extractMermaid(text: string): string {
  const block = text.match(/```mermaid[ \t]*\n([\s\S]*?)```/)
  return block ? block[1].trimEnd() : text
}

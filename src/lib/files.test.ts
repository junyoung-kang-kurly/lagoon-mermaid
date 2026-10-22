import { describe, expect, it } from 'vitest'
import { extractMermaid, fileTitle, isTextFile } from './files'

describe('isTextFile', () => {
  it('accepts Mermaid, Markdown and text files, whatever type the browser guessed', () => {
    for (const name of ['a.mmd', 'a.mermaid', 'a.md', 'A.MARKDOWN', 'a.txt']) expect(isTextFile({ name, type: '' })).toBe(true)
    expect(isTextFile({ name: 'diagram', type: 'text/plain' })).toBe(true)
    expect(isTextFile({ name: 'flow.mmd', type: 'application/octet-stream' })).toBe(true)
  })

  it('rejects images and other binaries, including an exported diagram dragged back in', () => {
    expect(isTextFile({ name: 'photo.png', type: 'image/png' })).toBe(false)
    expect(isTextFile({ name: 'diagram.svg', type: 'image/svg+xml' })).toBe(false)
    expect(isTextFile({ name: 'report.pdf', type: 'application/pdf' })).toBe(false)
    expect(isTextFile({ name: 'notes', type: '' })).toBe(false)
  })
})

describe('fileTitle', () => {
  it('drops the text extension only', () => {
    expect(fileTitle('Checkout flow.markdown')).toBe('Checkout flow')
    expect(fileTitle('v1.2.mmd')).toBe('v1.2')
    expect(fileTitle('diagram')).toBe('diagram')
  })
})

describe('extractMermaid', () => {
  it('takes the first mermaid fence of a Markdown file', () => {
    expect(extractMermaid('# Doc\n\n```mermaid\nflowchart LR\n    P --> Q\n```\n\n```mermaid\npie\n```')).toBe('flowchart LR\n    P --> Q')
  })

  it('keeps plain Mermaid as is', () => {
    expect(extractMermaid('flowchart TD\n    A --> B\n')).toBe('flowchart TD\n    A --> B\n')
  })
})

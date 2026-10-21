export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadText = (text: string, filename: string, type = 'text/plain') =>
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename)

export function slugify(title: string): string {
  const slug = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return slug || 'diagram'
}

export interface SvgSize {
  width: number
  height: number
}

export function svgSize(svg: string): SvgSize {
  const vb = svg.match(/viewBox="([-\d.\s]+)"/)?.[1]?.trim().split(/\s+/).map(Number)
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { width: vb[2], height: vb[3] }
  const w = Number(svg.match(/width="([\d.]+)/)?.[1] ?? 800)
  const h = Number(svg.match(/height="([\d.]+)/)?.[1] ?? 600)
  return { width: w, height: h }
}

/** Standalone SVG file: fixed pixel size, xmlns, optional background */
export function standaloneSvg(svg: string, background?: string): string {
  const { width, height } = svgSize(svg)
  // mermaid emits HTML-style markup inside labels (e.g. an unclosed <br>), which is not
  // well-formed XML; parse leniently as HTML and let XMLSerializer emit proper XML
  const root = new DOMParser().parseFromString(svg, 'text/html').querySelector('svg')
  if (!root) throw new Error('no <svg> in render output')
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))
  root.style.removeProperty('max-width')
  if (background) root.style.backgroundColor = background
  return new XMLSerializer().serializeToString(root)
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export async function svgToPng(svg: string, scale: number, background: string | null): Promise<Blob> {
  const file = standaloneSvg(svg)
  const { width, height } = svgSize(svg)
  const img = new Image()
  img.decoding = 'async'
  img.src = `data:image/svg+xml;base64,${utf8ToBase64(file)}`
  await img.decode()
  const canvas = document.createElement('canvas')
  const maxSide = 16384
  const s = Math.min(scale, maxSide / width, maxSide / height)
  canvas.width = Math.ceil(width * s)
  canvas.height = Math.ceil(height * s)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty canvas'))), 'image/png')
    } catch (e) {
      // Safari taints canvases that drew SVGs containing <foreignObject>
      reject(e)
    }
  })
}

export async function copyBlob(blob: Promise<Blob>, type = 'image/png') {
  // passing the promise keeps Safari's user-activation window open while we rasterize
  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

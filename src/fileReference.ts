export type LineRange = {
  startLine: number
  endLine: number
}

export function normalizePath(path: string) {
  return path.replace(/\\/g, "/")
}

export function toFileReference(path: string, range?: LineRange) {
  const normalized = normalizePath(path)
  if (!range) return `@${normalized}`
  if (range.startLine === range.endLine) return `@${normalized}#L${range.startLine}`
  return `@${normalized}#L${range.startLine}-${range.endLine}`
}

export function parseFileReference(input: string) {
  const text = input.trim()
  if (!text.startsWith("@")) return
  const body = text.slice(1)
  if (!body) return
  const hash = body.indexOf("#")
  if (hash === -1) return { path: normalizePath(body) }

  const rawPath = body.slice(0, hash)
  if (!rawPath) return
  const suffix = body.slice(hash + 1)
  const range = parseRange(suffix)
  if (!range) return { path: normalizePath(rawPath) }
  return { path: normalizePath(rawPath), range }
}

function parseRange(input: string): LineRange | undefined {
  const single = /^L(\d+)$/.exec(input)
  if (single) {
    const line = Number(single[1])
    if (!Number.isFinite(line) || line < 1) return
    return { startLine: line, endLine: line }
  }

  const multi = /^L(\d+)-(\d+)$/.exec(input)
  if (!multi) return
  const start = Number(multi[1])
  const end = Number(multi[2])
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) return
  if (start <= end) return { startLine: start, endLine: end }
  return { startLine: end, endLine: start }
}

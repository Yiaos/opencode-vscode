export function buildFileContextPayload(fileRef: string) {
  return `In ${fileRef}`
}

export function buildFilesContextPayload(fileRefs: string[]) {
  const refs = fileRefs.map((item) => item.trim()).filter((item) => item.length > 0)
  if (refs.length === 0) return ""
  if (refs.length === 1) return buildFileContextPayload(refs[0])
  return `Use these files as context:\n${refs.map((ref) => `- In ${ref}`).join("\n")}`
}

export function buildSymbolContextPayload(input: { symbol: string; fileRef: string }) {
  return `Focus on symbol ${input.symbol} in ${input.fileRef}`
}

export function buildGitDiffContextPayload(input: { diff: string; maxChars?: number }) {
  const maxChars = input.maxChars ?? 14_000
  const raw = input.diff.trim()
  if (!raw) return { text: "", truncated: false }

  let body = raw
  let truncated = false
  if (body.length > maxChars) {
    truncated = true
    body = body.slice(0, maxChars)
  }

  const suffix = truncated
    ? "\n\n[diff truncated to fit context window]"
    : ""

  const text = `Use this git diff as context:\n\n\`\`\`diff\n${body}\n\`\`\`${suffix}`
  return { text, truncated }
}

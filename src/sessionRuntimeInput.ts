export type ParsedSessionCommand = {
  command: string
  arguments: string
}

export function parseSessionCommandInput(value: string): ParsedSessionCommand | undefined {
  const line = value.trim().replace(/^\//, "")
  if (!line) return
  const [command, ...rest] = line.split(/\s+/)
  if (!command) return
  return {
    command,
    arguments: rest.join(" "),
  }
}

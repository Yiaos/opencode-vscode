import type { ServerAuth } from "./opencodeApi"
import { createAuthHeader } from "./opencodeApi"

export type GlobalEventEnvelope = {
  directory?: string
  payload?: {
    type?: string
    properties?: Record<string, unknown>
  }
}

export function parseSseDataLine(line: string): GlobalEventEnvelope | undefined {
  if (!line.startsWith("data:")) return
  const raw = line.slice(5).trim()
  if (!raw) return
  const value = JSON.parse(raw)
  if (!value || typeof value !== "object") return
  return value as GlobalEventEnvelope
}

export class ServerEventsClient {
  private running = false
  private controller?: AbortController
  private activeServerUrl?: string
  private activeAuthKey?: string

  constructor(
    private readonly options: {
      onEvent: (event: GlobalEventEnvelope) => void
      onLog?: (message: string) => void
    },
  ) {}

  start(input: { serverUrl: string; auth?: ServerAuth }) {
    const authKey = input.auth ? `${input.auth.username || ""}:${input.auth.password || ""}` : ""
    if (this.running && this.activeServerUrl === input.serverUrl && this.activeAuthKey === authKey) return

    this.stop()
    this.running = true
    this.activeServerUrl = input.serverUrl
    this.activeAuthKey = authKey
    void this.runLoop(input.serverUrl, input.auth)
  }

  stop() {
    this.running = false
    this.activeServerUrl = undefined
    this.activeAuthKey = undefined
    this.controller?.abort()
    this.controller = undefined
  }

  private async runLoop(serverUrl: string, auth?: ServerAuth) {
    while (this.running) {
      this.controller = new AbortController()
      try {
        const headers: Record<string, string> = {}
        const authHeader = createAuthHeader(auth)
        if (authHeader) headers.Authorization = authHeader

        const response = await fetch(`${serverUrl}/event`, {
          headers,
          signal: this.controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        if (!response.body) throw new Error("SSE stream missing body")

        await this.consume(response.body)
      } catch (error) {
        if (!this.running) break
        const message = error instanceof Error ? error.message : String(error)
        this.options.onLog?.(`[event] disconnected: ${message}`)
      } finally {
        this.controller = undefined
      }

      if (!this.running) break
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
  }

  private async consume(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (this.running) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let index = buffer.indexOf("\n")
      while (index >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, "")
        buffer = buffer.slice(index + 1)
        index = buffer.indexOf("\n")

        try {
          const event = parseSseDataLine(line)
          if (event) this.options.onEvent(event)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          this.options.onLog?.(`[event] parse error: ${message}`)
        }
      }
    }
  }
}

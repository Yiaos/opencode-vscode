import { spawn, type ChildProcess } from "node:child_process"

const LISTENING_RE = /opencode server listening on\s+(https?:\/\/\S+)/i

export function parseServerUrlFromOutput(text: string) {
  const match = LISTENING_RE.exec(text)
  return match?.[1]
}

export type ServerManagerOptions = {
  command: string
  args: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  onLog?: (line: string) => void
}

export class ServerManager {
  private proc?: ChildProcess
  private _url?: string
  private starting?: Promise<string>

  constructor(private readonly options: ServerManagerOptions) {}

  get url() {
    return this._url
  }

  async ensureRunning() {
    if (this._url && this.proc && !this.proc.killed) return this._url
    if (this.starting) return this.starting

    this.starting = this.start().finally(() => {
      this.starting = undefined
    })
    return this.starting
  }

  async dispose() {
    const proc = this.proc
    this.proc = undefined
    this._url = undefined
    if (!proc || proc.killed) return
    proc.kill()
  }

  private start() {
    const timeoutMs = this.options.timeoutMs ?? 20_000

    return new Promise<string>((resolve, reject) => {
      const proc = spawn(this.options.command, this.options.args, {
        cwd: this.options.cwd,
        env: { ...process.env, ...this.options.env },
        stdio: ["ignore", "pipe", "pipe"],
        shell: process.platform === "win32",
      })

      this.proc = proc
      let output = ""
      let settled = false

      const done = (err?: Error, url?: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)

        if (err) {
          this.proc = undefined
          this._url = undefined
          reject(err)
          return
        }

        this._url = url
        resolve(url!)
      }

      const handleChunk = (chunk: Buffer) => {
        const text = chunk.toString()
        output += text
        this.options.onLog?.(text)
        const url = parseServerUrlFromOutput(output)
        if (!url) return
        done(undefined, url)
      }

      const timer = setTimeout(() => {
        done(
          new Error(
            `Timeout waiting for opencode server startup after ${timeoutMs}ms. Output:\n${output || "<empty>"}`,
          ),
        )
      }, timeoutMs)

      proc.stdout.on("data", handleChunk)
      proc.stderr.on("data", handleChunk)

      proc.once("error", (err) => {
        done(err)
      })

      proc.once("exit", (code, signal) => {
        this.proc = undefined
        this._url = undefined
        if (!settled) {
          done(
            new Error(
              `opencode server exited before ready (code=${String(code)}, signal=${String(signal)}). Output:\n${output || "<empty>"}`,
            ),
          )
          return
        }
      })
    })
  }
}

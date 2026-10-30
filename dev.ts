/**
 * Void Links dev runner — starts the Vite client (5190) and the Bun gateway
 * (3008) together. Short links generated in dev point at the gateway so the
 * redirect path can be tested exactly as it runs in production.
 */

import { spawn } from "bun"

const procs: { p: ReturnType<typeof spawn>; name: string }[] = []
let stopping = false

function start(name: string, cwd: string, args: string[]) {
  const p = spawn(["bun", ...args], {
    cwd,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  })
  procs.push({ p, name })
  p.exited.then((code) => {
    if (!stopping && code !== 0) {
      console.error(`\n[url] ${name} exited with code ${code}`)
      shutdown()
    }
  })
}

function shutdown() {
  if (stopping) return
  stopping = true
  for (const { p, name } of procs) {
    try {
      p.kill()
    } catch {
      /* already gone */
    }
    console.log(`[url] stopped ${name}`)
  }
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

start("client", "client", ["--env-file=../.env", "run", "dev"])
start("server", "server", ["--env-file=../.env", "run", "start"])

console.log("[url] client → http://localhost:5190 · gateway → http://localhost:3008")

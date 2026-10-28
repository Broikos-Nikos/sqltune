/**
 * One `vite preview` of the built page, on a port the operating system hands
 * out, for the gates that drive a browser. It refuses to report ready until the
 * page it serves is byte for byte `dist/index.html`, because a gate that measures
 * whatever answers on a port can report green against a page nobody built.
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const freePort = () => new Promise<number>((res) => { const s = createServer().listen(0, () => { const p = (s.address() as { port: number }).port; s.close(() => res(p)) }) })

export async function serve(): Promise<{ url: string; stop: () => void }> {
  const built = resolve(root, 'dist/index.html')
  if (!existsSync(built)) { console.error('No dist/index.html: run `npm run build` first.'); process.exit(1) }
  const want = readFileSync(built, 'utf8')
  const port = await freePort()
  const child = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' })
  const url = `http://localhost:${port}/`
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) {
        if ((await r.text()) !== want) { child.kill(); console.error(`${url} is not serving dist/index.html`); process.exit(1) }
        return { url, stop: () => child.kill() }
      }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100))
  }
  child.kill()
  console.error('vite preview did not answer within 10 s')
  process.exit(1)
}

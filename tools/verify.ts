/**
 * Every gate that needs a browser, against one server.
 *
 *   npm run verify            (after npm run build)
 *
 * One `vite preview`, proved to serve `dist/index.html`, handed to each gate
 * through `SQLTUNE_URL`. A gate that started its own server could report green
 * against a page it never started; one server, checked once, cannot.
 */
import { spawn } from 'node:child_process'
import { browserReady } from './preflight.ts'
import { serve } from './serve.ts'

const GATES = ['check:page', 'check:capture']

await browserReady()
const server = await serve()
let failed = 0
try {
  for (const gate of GATES) {
    const code = await new Promise<number | null>((done) => {
      spawn('npm', ['run', gate], { stdio: 'inherit', shell: true, env: { ...process.env, SQLTUNE_URL: server.url } }).on('exit', done)
    })
    if (code !== 0) failed++
  }
} finally {
  server.stop()
}
if (failed) { console.error(`${failed} of ${GATES.length} browser gates failed.`); process.exit(1) }
console.log(`${GATES.length} browser gates, one server.`)

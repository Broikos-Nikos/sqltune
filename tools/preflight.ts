/**
 * The browser the page gates need, checked before the first gate needs it.
 *
 * On a machine that has never run Playwright, every browser gate would otherwise
 * print its own stack trace for the same missing binary. This launches one
 * rather than looking for the file, because `chromium.executablePath()` names a
 * different binary from the headless shell a launch actually runs, and both
 * have to be there.
 */
import { chromium } from 'playwright'

export async function browserReady() {
  try {
    const browser = await chromium.launch()
    await browser.close()
  } catch (err) {
    console.error('These gates drive a real browser, and Playwright has no browser to drive here.\n')
    console.error('  npx playwright install chromium\n')
    console.error(`  ${String(err).split('\n')[0].replace(/^Error:\s*/, '')}`)
    process.exit(1)
  }
}

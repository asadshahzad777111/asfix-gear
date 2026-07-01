/**
 * Pre-deploy smoke test — boots the production server (built frontend +
 * backend API) and loads every key route in a real headless browser,
 * failing the build if any page throws a JS error or renders blank.
 *
 * This exists because `vite build` and ESLint both pass on code that still
 * crashes at runtime (e.g. reading a property that doesn't exist on a
 * config object) — the only reliable way to catch that class of bug before
 * it reaches production is to actually load the page and watch the
 * console, which is what this script does.
 *
 * Run with: node scripts/smoke-test.js
 * (Requires `npm run build` to have produced `frontend/dist` first, and the
 * `playwright` package + its Chromium browser to be installed.)
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = process.env.SMOKE_PORT || 5099;
const BASE_URL = `http://localhost:${PORT}`;
const ROUTES = ['/', '/shop', '/repair', '/contact', '/track', '/account/login', '/account/register'];

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Server did not respond at ${url} within ${timeoutMs}ms`));
            return;
          }
          setTimeout(check, 400);
        });
    };
    check();
  });
}

async function checkRoute(page, route) {
  const errors = [];
  const onPageError = (err) => errors.push(`pageerror: ${err.message}`);
  const onConsole = (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);

  try {
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(300);

    const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
    if (!rootHtml.trim()) {
      errors.push('Blank page — #root rendered no content');
    }
    return errors;
  } finally {
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
}

async function main() {
  console.log(`Starting production server on port ${PORT}...`);
  const server = spawn(process.execPath, ['backend/server.js'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
  });

  let exited = false;
  const cleanup = () => {
    if (!exited) {
      exited = true;
      server.kill();
    }
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(1);
  });

  let hadFailure = false;

  try {
    await waitForServer(`${BASE_URL}/api/health`);
    console.log('Server is up. Launching headless browser...');

    const browser = await chromium.launch();
    const page = await browser.newPage();

    for (const route of ROUTES) {
      process.stdout.write(`Checking ${route} ... `);
      const errors = await checkRoute(page, route);
      if (errors.length > 0) {
        hadFailure = true;
        console.log('FAIL');
        for (const e of errors) console.log(`    ${e}`);
      } else {
        console.log('OK');
      }
    }

    await browser.close();
  } catch (err) {
    hadFailure = true;
    console.error('Smoke test crashed:', err.message);
  } finally {
    cleanup();
  }

  if (hadFailure) {
    console.error('\nSmoke test FAILED — a page crashed or rendered blank. Fix before deploying.');
    process.exit(1);
  }
  console.log('\nSmoke test passed — all routes rendered without errors.');
}

main();

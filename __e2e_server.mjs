// Shared by the browser e2e tests: reuse a server already listening on PORT
// (default 8123), otherwise start `node serve.js` for the duration of the run.
// Returns a stop() function that only stops a server this helper started.
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

export const PORT = Number(process.env.PORT || 8123);
export const BASE = `http://localhost:${PORT}`;
const ROOT = fileURLToPath(new URL('.', import.meta.url));

async function up() {
  try { return (await fetch(`${BASE}/index.html`)).ok; } catch (e) { return false; }
}

export async function ensureServer() {
  if (await up()) return () => {};
  const child = spawn(process.execPath, ['serve.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (await up()) return () => { child.kill(); };
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error(`could not start serve.js on port ${PORT}`);
}

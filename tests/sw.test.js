/** Test solo-Node: el service worker debe precachear todos los archivos de la app. */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, test } from './runner.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

async function listFiles(dir) {
  const entries = await readdir(join(ROOT, dir), { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)])),
  );
  return nested.flat();
}

test('sw: PRECACHE incluye todos los archivos de src/ y styles/', async () => {
  const sw = await readFile(join(ROOT, 'sw.js'), 'utf8');
  const files = [...(await listFiles('src')), ...(await listFiles('styles'))];
  const missing = files
    .map((file) => `./${relative('.', file).split(sep).join('/')}`)
    .filter((path) => !sw.includes(`'${path}'`));
  assert(missing.length === 0, `Faltan en sw.js: ${missing.join(', ')}`);
});

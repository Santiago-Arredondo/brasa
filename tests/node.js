/** Ejecuta los tests de dominio en consola (Node 18+). Uso: node tests/node.js */
import { run } from './runner.js';
import './domain.test.js';
import './sync.test.js';
import './sw.test.js';

const results = await run();
const failed = results.filter((r) => !r.ok);

for (const r of results) {
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : `\n    ${r.error}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} pasaron`);
process.exitCode = failed.length ? 1 : 0;

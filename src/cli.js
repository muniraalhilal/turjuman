import { readFile } from 'node:fs/promises';
import { run } from './language/index.js';
const file = process.argv[2];
if (!file) { console.error('Usage: node src/cli.js examples/fibonacci.ar'); process.exitCode = 1; }
else {
  try {
    const result = run(await readFile(file, 'utf8'));
    for (const line of result.output) console.log(line);
    if (!result.ok) {
      const e = result.error;
      console.error(`${file}:${e.line}:${e.column} [${e.phase}] ${e.message}`);
      process.exitCode = 1;
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

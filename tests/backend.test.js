import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { createRunner } from '../src/runner.js';
import { run } from '../src/language/index.js';

async function service(t, options) {
  const server = createServer(options);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, post: (source) => fetch(base + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) }) };
}

test('health check remains available while a program executes', async t => {
  const { base, post } = await service(t);
  const execution = post('طالما صحيح {}');
  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 200); assert.equal((await health.json()).execution, 'isolated-worker');
  const result = await (await execution).json(); assert.equal(result.ok, false); assert.equal(result.error.phase, 'runtime');
});
test('worker produces the same diagnostics and AST as the standalone engine', async t => {
  const { post } = await service(t);
  for (const source of ['اطبع(٣ + ٤ * ٥)', 'اطبع("قبل") اطبع(١/٠)', 'متغير س =', '@']) {
    const response = await post(source); assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), run(source));
  }
});
test('concurrent requests have separate variable memory', async t => {
  const { post } = await service(t);
  const responses = await Promise.all([1,2,3,4].map(i => post(`متغير س = ${i} اطبع(س)`)));
  const results = await Promise.all(responses.map(r => r.json()));
  assert.deepEqual(results.map(r => r.output), [['1'],['2'],['3'],['4']]);
  assert.equal((await (await post('اطبع(س)')).json()).ok, false);
});
test('concurrency admission rejects excess work and recovers capacity', async () => {
  const isolated = createRunner({ maxConcurrent: 1 });
  const first = isolated('طالما صحيح {}');
  await assert.rejects(isolated('اطبع(١)'), e => e.status === 503);
  await first;
  assert.deepEqual((await isolated('اطبع(٤٢)')).output, ['42']);
});
test('worker wall timeout returns 408 and releases capacity', async () => {
  const isolated = createRunner({ timeoutMs: 1, maxConcurrent: 1 });
  await assert.rejects(isolated('طالما صحيح {}'), e => e.status === 408);
  await assert.rejects(isolated('طالما صحيح {}'), e => e.status === 408);
});
test('cancellation before or during execution stops the worker', async () => {
  const isolated = createRunner({ maxConcurrent: 1 });
  await assert.rejects(isolated('اطبع(١)', AbortSignal.abort()), e => e.status === 499);
  const controller = new AbortController(); const pending = isolated('طالما صحيح {}', controller.signal);
  controller.abort(); await assert.rejects(pending, e => e.status === 499);
  assert.deepEqual((await isolated('اطبع(٢)')).output, ['2']);
});
test('HTTP source and payload limits, malformed schemas and media types', async t => {
  const { base, post } = await service(t);
  assert.equal((await post('x'.repeat(20001))).status, 413);
  assert.equal((await post('x'.repeat(100001))).status, 413);
  for (const body of ['[]','"code"','{"source":42}','{"source":null}','false']) {
    const response = await fetch(base + '/api/run', { method: 'POST', headers: {'Content-Type':'application/json'}, body });
    assert.equal(response.status, 400);
  }
  const wrongType = await fetch(base + '/api/run', { method: 'POST', headers: {'Content-Type':'application/json-wrong'}, body:'{}' });
  assert.equal(wrongType.status, 415);
});
test('private files and encoded traversal are not served', async t => {
  const { base } = await service(t);
  for (const path of ['/src/server.js','/.openai/hosting.json','/.git/config','/src/language/..%2fserver.js','/%2e%2e%2fpackage.json','/%ZZ']) {
    const response = await fetch(base + path); assert.ok([400,404].includes(response.status), path);
    assert.doesNotMatch(await response.text(), /auth_client|createServer|project_id/);
  }
});
test('HEAD returns headers but no file body; unknown methods are rejected', async t => {
  const { base } = await service(t);
  const head = await fetch(base, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.match(head.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(base, { method: 'PUT' })).status, 405);
});
test('strings resembling HTML or host code are never executed', async t => {
  const { post } = await service(t);
  const source = 'اطبع("<script>alert(1)</script>") اطبع("process.env")';
  assert.deepEqual((await (await post(source)).json()).output, ['<script>alert(1)</script>','process.env']);
  assert.equal((await (await post('process.exit()')).json()).ok, false);
});
test('large aggregate output is bounded before flooding the response', () => {
  const result = run(`متغير س = "${'a'.repeat(9000)}" طالما صحيح { اطبع(س) }`);
  assert.equal(result.ok, false); assert.match(result.error.message, /حجم المخرجات/);
  assert.ok(result.output.join('').length <= 64000);
});
test('deterministic malformed-input fuzzing never leaks internal exceptions', () => {
  let seed = 7103;
  const parts = ['متغير','اطبع','إذا','طالما','وإلا','صحيح','س','١','"نص"','{','}','(',')','=','+','/',';','@','ليس'];
  for (let i = 0; i < 500; i++) {
    const code = Array.from({length:12}, () => { seed = (seed * 1664525 + 1013904223) >>> 0; return parts[seed % parts.length]; }).join(' ');
    const result = run(code); assert.equal(typeof result.ok, 'boolean');
    if (!result.ok) assert.ok(['lexer','parser','runtime'].includes(result.error.phase));
  }
});
test('arithmetic property cases preserve precedence and remainder semantics', () => {
  for (let a = -10; a <= 10; a++) for (let b = 1; b <= 8; b++) {
    const r = run(`اطبع(${a} + ${b} * 3) اطبع(${a} % ${b})`);
    assert.deepEqual(r.output, [String(a + b * 3), String(a % b)]);
  }
});

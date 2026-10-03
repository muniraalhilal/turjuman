import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
test('local server serves UI, runs API and rejects invalid requests', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base); assert.equal(page.status, 200); assert.match(await page.text(), /ترجمان/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  const response = await fetch(base + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'اطبع(٦ * ٧)' }) });
  assert.deepEqual((await response.json()).output, ['42']);
  for (const body of ['{', 'null', '{}']) {
    const r = await fetch(base + '/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(r.status, 400);
  }
  assert.equal((await fetch(base + '/package.json')).status, 404);
  assert.equal((await fetch(base + '/src/language/index.js')).status, 200);
  assert.equal((await fetch(base + '/api/run', { method: 'POST', body: '{}' })).status, 415);
});

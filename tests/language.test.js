import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { run, tokenize, parse } from '../src/language/index.js';

const output = source => { const result = run(source); assert.equal(result.ok, true, JSON.stringify(result.error)); return result.output; };
test('Arabic and Latin numbers, arithmetic precedence and grouping', () => {
  assert.deepEqual(output('اطبع(٢ + 3 * ٤) اطبع((٢ + ٣) * ٤) اطبع(-٥ + ٢.٥) اطبع(٧ % ٣)'), ['14', '20', '-2.5', '1']);
});
test('lexer tracks source locations and skips comments', () => {
  const tokens = tokenize('# comment\nمتغير س = ١ // comment\nاطبع(س)');
  assert.deepEqual(tokens[0], { type: 'متغير', value: 'متغير', line: 2, column: 1 });
  assert.equal(tokens[4].line, 3);
});
test('AST preserves precedence and left associativity', () => {
  const ast = parse(tokenize('اطبع(١ + ٢ * ٣)'));
  assert.equal(ast.body[0].argument.right.operator, '*');
  assert.deepEqual(output('اطبع(١٠ - ٣ - ٢)'), ['5']);
});
test('strings, escapes, optional semicolons and booleans', () => {
  assert.deepEqual(output('متغير اسم = "ترجمان"؛ اطبع("مرحبًا " + اسم); اطبع("أ\\nب") اطبع(ليس خطأ)'), ['مرحبًا ترجمان', 'أ\nب', 'صحيح']);
});
test('branches and logical short circuit', () => {
  assert.deepEqual(output('إذا ٢ >= ٢ و صحيح { اطبع("نعم") } وإلا { اطبع("لا") } اطبع(صحيح أو مجهول) اطبع(خطأ و مجهول)'), ['نعم', 'صحيح', 'خطأ']);
});
test('scope shadows locally and assignment updates nearest binding', () => {
  assert.deepEqual(output('متغير س = ١ إذا صحيح { متغير س = ٢ س = ٣ اطبع(س) } اطبع(س) إذا صحيح { س = ٤ } اطبع(س)'), ['3', '1', '4']);
  assert.equal(run('إذا صحيح { متغير س = ١ } اطبع(س)').ok, false);
});
test('each execution uses fresh memory', () => {
  run('متغير س = ١'); assert.equal(run('اطبع(س)').ok, false);
});
for (const [title, source, phase] of [
  ['unknown character', '@', 'lexer'], ['unclosed string', 'اطبع("abc)', 'lexer'],
  ['invalid escape', 'اطبع("\\q")', 'lexer'], ['missing brace', 'إذا صحيح { اطبع(١)', 'parser'],
  ['missing initializer', 'متغير س =', 'parser'], ['missing parenthesis', 'اطبع(١', 'parser'],
  ['undefined variable', 'اطبع(مجهول)', 'runtime'], ['duplicate declaration', 'متغير س = ١ متغير س = ٢', 'runtime'],
  ['division by zero', 'اطبع(١ / ٠)', 'runtime'], ['strict arithmetic', 'اطبع("١" + ٢)', 'runtime'],
  ['strict conditions', 'إذا ١ { اطبع(١) }', 'runtime'], ['infinite loop', 'طالما صحيح {}', 'runtime'],
]) test(title, () => { const r = run(source); assert.equal(r.ok, false); assert.equal(r.error.phase, phase); assert.ok(r.error.line > 0); assert.ok(r.error.column > 0); });
test('runtime errors keep prior output and correct location', () => {
  const r = run('اطبع("قبل")\nاطبع(١ / ٠)');
  assert.deepEqual(r.output, ['قبل']); assert.equal(r.error.line, 2); assert.equal(r.error.column, 8);
});
test('resource limits reject excessive output, strings, source and nesting', () => {
  assert.equal(run('طالما صحيح { اطبع(١) }').ok, false);
  assert.equal(run('اطبع("' + 'a'.repeat(10001) + '")').ok, false);
  assert.equal(run(' '.repeat(20001)).ok, false);
  assert.equal(run('اطبع(' + '('.repeat(200) + '١' + ')'.repeat(200) + ')').ok, false);
  assert.equal(run('اطبع(' + Array(500).fill('١').join('+') + ')').ok, false);
});
test('example programs produce known results', async () => {
  const fib = await readFile(new URL('../examples/fibonacci.ar', import.meta.url), 'utf8');
  assert.deepEqual(output(fib), ['0','1','1','2','3','5','8','13','21','34']);
  const factorial = await readFile(new URL('../examples/factorial.ar', import.meta.url), 'utf8');
  assert.deepEqual(output(factorial), ['120']);
});

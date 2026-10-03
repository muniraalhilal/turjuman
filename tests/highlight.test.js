import test from 'node:test';
import assert from 'node:assert/strict';
import { highlight } from '../web/highlight.js';
test('highlighter classifies Arabic code without losing whitespace', () => {
  const source = '# comment\nمتغير س = ١٢.٥\nاطبع("نص") إذا صحيح {}';
  const tokens = highlight(source);
  assert.equal(tokens.map(t => t.text).join(''), source);
  for (const [text,kind] of [['متغير','keyword'],['اطبع','function'],['١٢.٥','number'],['"نص"','string'],['صحيح','boolean'],['# comment','comment'],['س','identifier']]) {
    assert.equal(tokens.find(t => t.text === text).kind, kind);
  }
});
test('incomplete strings, comments and HTML-like text remain plain source data', () => {
  for (const source of ['اطبع("unfinished','// "string"\n١','"<img src=x onerror=alert(1)>"','"escaped \\" quote"','😀\n']) {
    assert.equal(highlight(source).map(t => t.text).join(''), source);
  }
});

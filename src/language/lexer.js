import { LanguageError } from './error.js';

const keywords = new Set(['متغير', 'اطبع', 'إذا', 'وإلا', 'طالما', 'صحيح', 'خطأ', 'و', 'أو', 'ليس']);
const start = /[\p{L}_]/u;
const part = /[\p{L}\p{M}\p{N}_]/u;
const digit = /[0-9٠-٩]/;
const asciiDigit = c => c >= '٠' && c <= '٩' ? String(c.charCodeAt(0) - 1632) : c;

export function tokenize(source) {
  let i = 0, line = 1, column = 1;
  const tokens = [];
  const peek = (offset = 0) => source[i + offset] ?? '';
  const advance = () => {
    const c = source[i++];
    if (c === '\n') { line++; column = 1; } else column++;
    return c;
  };
  const add = (type, value, location) => tokens.push({ type, value, ...location });
  while (i < source.length) {
    const location = { line, column };
    const c = peek();
    if (/\s/u.test(c)) { advance(); continue; }
    if (c === '#' || (c === '/' && peek(1) === '/')) {
      while (i < source.length && peek() !== '\n') advance();
      continue;
    }
    if (digit.test(c)) {
      let value = '';
      while (peek() && digit.test(peek())) value += asciiDigit(advance());
      if (peek() === '.' && digit.test(peek(1))) {
        value += advance();
        while (peek() && digit.test(peek())) value += asciiDigit(advance());
      }
      const number = Number(value);
      if (!Number.isFinite(number)) throw new LanguageError('lexer', 'العدد أكبر من الحد المسموح.', location);
      add('number', number, location); continue;
    }
    if (start.test(c)) {
      let value = advance();
      while (peek() && part.test(peek())) value += advance();
      value = value.normalize('NFC');
      add(keywords.has(value) ? value : 'identifier', value, location); continue;
    }
    if (c === '"' || c === "'") {
      const quote = advance();
      let value = '';
      while (i < source.length && peek() !== quote) {
        if (peek() === '\n') throw new LanguageError('lexer', 'النص غير مغلق؛ أضيفي علامة اقتباس.', location);
        if (peek() === '\\') {
          advance();
          const escaped = advance();
          const escapes = { n: '\n', t: '\t', '\\': '\\', '"': '"', "'": "'" };
          if (!Object.hasOwn(escapes, escaped)) throw new LanguageError('lexer', 'تسلسل هروب غير معروف داخل النص.', location);
          value += escapes[escaped];
        } else value += advance();
      }
      if (peek() !== quote) throw new LanguageError('lexer', 'النص غير مغلق.', location);
      advance(); add('string', value, location); continue;
    }
    const pair = c + peek(1);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(pair)) {
      advance(); advance(); add(pair, pair, location); continue;
    }
    if ('+-*/%<>=!(){};'.includes(c) || c === '؛') {
      advance(); add(c === '؛' ? ';' : c, c, location); continue;
    }
    throw new LanguageError('lexer', `رمز غير معروف: «${c}».`, location);
  }
  add('eof', null, { line, column });
  return tokens;
}

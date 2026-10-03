import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { interpret } from './interpreter.js';
import { LanguageError } from './error.js';
export { tokenize, parse, interpret, LanguageError };

export function run(source, options = {}) {
  let tokens = [], ast = null;
  try {
    if (typeof source !== 'string' || source.length > 20000) throw new LanguageError('lexer', 'يجب أن يكون البرنامج نصًا لا يتجاوز ٢٠٬٠٠٠ حرف.');
    tokens = tokenize(source);
    ast = parse(tokens);
    return { ok: true, ...interpret(ast, options), tokens, ast };
  } catch (error) {
    if (!(error instanceof LanguageError)) throw error;
    return { ok: false, error: error.toJSON(), output: error.output ?? [], steps: error.steps ?? 0, tokens, ast };
  }
}

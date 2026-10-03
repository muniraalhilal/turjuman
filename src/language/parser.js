import { LanguageError } from './error.js';

const precedence = new Map([
  ['أو', 1], ['||', 1], ['و', 2], ['&&', 2], ['==', 3], ['!=', 3],
  ['<', 4], ['<=', 4], ['>', 4], ['>=', 4], ['+', 5], ['-', 5], ['*', 6], ['/', 6], ['%', 6],
]);

export function parse(tokens) {
  let index = 0, depth = 0;
  const current = () => tokens[index];
  const at = type => current().type === type;
  const take = () => tokens[index++];
  const fail = message => { throw new LanguageError('parser', message, current()); };
  const expect = type => at(type) ? take() : fail(`متوقع «${type}»، وُجد «${current().value ?? 'نهاية البرنامج'}».`);
  const node = (type, token, fields) => ({ type, location: { line: token.line, column: token.column }, ...fields });
  function guarded(fn) {
    if (++depth > 150) fail('التداخل عميق جدًا؛ بسّطي التعبير أو الكتل.');
    try { return fn(); } finally { depth--; }
  }
  function expression(min = 0) {
    return guarded(() => {
      const token = take();
      let left;
      if (token.type === 'number' || token.type === 'string') left = node('Literal', token, { value: token.value });
      else if (['صحيح', 'خطأ'].includes(token.type)) left = node('Literal', token, { value: token.type === 'صحيح' });
      else if (token.type === 'identifier') left = node('Identifier', token, { name: token.value });
      else if (token.type === '(') { left = expression(); expect(')'); }
      else if (['-', '+', '!', 'ليس'].includes(token.type)) left = node('UnaryExpression', token, { operator: token.type, argument: expression(7) });
      else throw new LanguageError('parser', 'متوقع عدد أو نص أو متغير أو تعبير.', token);
      while ((precedence.get(current().type) ?? -1) >= min) {
        const operator = take();
        left = node('BinaryExpression', operator, { operator: operator.type, left, right: expression(precedence.get(operator.type) + 1) });
      }
      return left;
    });
  }
  function block() {
    return guarded(() => {
      const token = expect('{');
      const body = [];
      while (!at('}') && !at('eof')) body.push(statement());
      expect('}');
      return node('BlockStatement', token, { body });
    });
  }
  function statement() {
    const token = current();
    let result;
    if (at('متغير')) {
      take(); const name = expect('identifier').value; expect('=');
      result = node('VariableDeclaration', token, { name, initializer: expression() });
    } else if (at('اطبع')) {
      take(); expect('('); const argument = expression(); expect(')');
      result = node('PrintStatement', token, { argument });
    } else if (at('إذا')) {
      take(); const test = expression(); const consequent = block();
      let alternate = null;
      if (at('وإلا')) { take(); alternate = block(); }
      result = node('IfStatement', token, { test, consequent, alternate });
    } else if (at('طالما')) {
      take(); const test = expression();
      result = node('WhileStatement', token, { test, body: block() });
    } else if (at('identifier')) {
      const name = take().value; expect('=');
      result = node('AssignmentStatement', token, { name, value: expression() });
    } else fail('متوقع أمر: متغير، اطبع، إذا، طالما، أو إسناد قيمة.');
    if (at(';')) take();
    return result;
  }
  const body = [];
  while (!at('eof')) body.push(statement());
  const program = { type: 'Program', body };
  const pending = [[program, 0]];
  while (pending.length) {
    const [item, level] = pending.pop();
    if (level > 180) throw new LanguageError('parser', 'شجرة البرنامج عميقة جدًا؛ قسّمي التعبير.', item.location);
    for (const value of Object.values(item)) {
      if (Array.isArray(value)) for (const child of value) pending.push([child, level + 1]);
      else if (value && typeof value === 'object' && value.type) pending.push([value, level + 1]);
    }
  }
  return program;
}

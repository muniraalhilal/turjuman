import { LanguageError } from './error.js';

class Scope {
  constructor(parent = null) { this.values = new Map(); this.parent = parent; }
  owner(name) { return this.values.has(name) ? this : this.parent?.owner(name); }
}
export const display = value => typeof value === 'boolean' ? (value ? 'صحيح' : 'خطأ') : String(value);

export function interpret(ast, { maxSteps = 50000, maxOutput = 500, maxString = 10000, maxOutputChars = 64000 } = {}) {
  const global = new Scope(), output = [];
  let steps = 0, outputChars = 0;
  const fail = (message, node) => { throw new LanguageError('runtime', message, node.location); };
  const tick = node => { if (++steps > maxSteps) fail('تجاوز البرنامج حد الخطوات؛ تحققي من شرط الحلقة.', node); };
  const numeric = (value, node) => { if (typeof value !== 'number') fail('هذه العملية تتطلب أعدادًا.', node); return value; };
  const boolean = (value, node) => { if (typeof value !== 'boolean') fail('الشرط يجب أن يكون صحيح أو خطأ؛ استخدمي مقارنة.', node); return value; };
  function evaluate(node, scope, depth = 0) {
    tick(node);
    if (depth > 200) fail('التعبير عميق جدًا.', node);
    let result;
    if (node.type === 'Literal') result = node.value;
    else if (node.type === 'Identifier') {
      const owner = scope.owner(node.name);
      if (!owner) fail(`المتغير «${node.name}» غير معرّف.`, node);
      result = owner.values.get(node.name);
    } else if (node.type === 'UnaryExpression') {
      const value = evaluate(node.argument, scope, depth + 1);
      result = ['!', 'ليس'].includes(node.operator) ? !boolean(value, node) : node.operator === '-' ? -numeric(value, node) : numeric(value, node);
    } else {
      const left = evaluate(node.left, scope, depth + 1), op = node.operator;
      if (['و', '&&'].includes(op)) return boolean(left, node) && boolean(evaluate(node.right, scope, depth + 1), node);
      if (['أو', '||'].includes(op)) return boolean(left, node) || boolean(evaluate(node.right, scope, depth + 1), node);
      const right = evaluate(node.right, scope, depth + 1);
      if (op === '==') return left === right;
      if (op === '!=') return left !== right;
      if (op === '+' && typeof left === 'string' && typeof right === 'string') result = left + right;
      else {
        numeric(left, node); numeric(right, node);
        if (['/', '%'].includes(op) && right === 0) fail('لا يمكن القسمة على صفر.', node);
        switch (op) {
          case '+': result = left + right; break;
          case '-': result = left - right; break;
          case '*': result = left * right; break;
          case '/': result = left / right; break;
          case '%': result = left % right; break;
          case '<': return left < right;
          case '<=': return left <= right;
          case '>': return left > right;
          case '>=': return left >= right;
          default: fail('عملية غير مدعومة.', node);
        }
      }
    }
    if (typeof result === 'number' && !Number.isFinite(result)) fail('نتيجة عددية خارج النطاق.', node);
    if (typeof result === 'string' && result.length > maxString) fail('النص أطول من الحد المسموح.', node);
    return result;
  }
  function execute(node, scope) {
    tick(node);
    switch (node.type) {
      case 'VariableDeclaration':
        if (scope.values.has(node.name)) fail(`المتغير «${node.name}» معرّف مسبقًا في هذا النطاق.`, node);
        scope.values.set(node.name, evaluate(node.initializer, scope)); break;
      case 'AssignmentStatement': {
        const owner = scope.owner(node.name);
        if (!owner) fail(`المتغير «${node.name}» غير معرّف.`, node);
        owner.values.set(node.name, evaluate(node.value, scope)); break;
      }
      case 'PrintStatement': {
        if (output.length >= maxOutput) fail('تجاوز البرنامج حد أسطر الإخراج.', node);
        const text = display(evaluate(node.argument, scope));
        if (outputChars + text.length > maxOutputChars) fail('تجاوز البرنامج الحد الإجمالي لحجم المخرجات.', node);
        outputChars += text.length;
        output.push(text); break;
      }
      case 'BlockStatement': {
        const child = new Scope(scope);
        for (const statement of node.body) execute(statement, child);
        break;
      }
      case 'IfStatement':
        if (boolean(evaluate(node.test, scope), node)) execute(node.consequent, scope);
        else if (node.alternate) execute(node.alternate, scope);
        break;
      case 'WhileStatement':
        while (boolean(evaluate(node.test, scope), node)) execute(node.body, scope);
        break;
    }
  }
  try {
    for (const statement of ast.body) execute(statement, global);
    return { output, variables: Object.fromEntries(global.values), steps };
  } catch (error) {
    if (error instanceof LanguageError) { error.output = output; error.steps = steps; }
    throw error;
  }
}

// A tolerant scanner for editing incomplete programs. It never generates HTML.
const pattern = /#[^\n]*|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|[0-9٠-٩]+(?:\.[0-9٠-٩]+)?|[\p{L}_][\p{L}\p{M}\p{N}_]*|==|!=|<=|>=|&&|\|\||[+*/%<>=!\-]|[(){};؛]|\s+|./gu;
const keywords = new Set(['متغير', 'إذا', 'وإلا', 'طالما', 'و', 'أو', 'ليس']);
export function highlight(source) {
  return [...source.matchAll(pattern)].map(([text]) => {
    let kind = 'plain';
    if (text.startsWith('#') || text.startsWith('//')) kind = 'comment';
    else if (/^["']/.test(text)) kind = 'string';
    else if (/^[0-9٠-٩]/.test(text)) kind = 'number';
    else if (keywords.has(text.normalize('NFC'))) kind = 'keyword';
    else if (text === 'اطبع') kind = 'function';
    else if (['صحيح', 'خطأ'].includes(text)) kind = 'boolean';
    else if (/^[+*/%<>=!&|\-]/.test(text)) kind = 'operator';
    else if (/^[(){};؛]/.test(text)) kind = 'punctuation';
    else if (/^[\p{L}_]/u.test(text)) kind = 'identifier';
    return { text, kind };
  });
}

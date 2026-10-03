import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, HighlightStyle, syntaxHighlighting, bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const keywords = new Set(['متغير', 'إذا', 'وإلا', 'طالما', 'و', 'أو', 'ليس']);
const arabic = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/^(#|\/\/)/)) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/^["']/)) {
      const quote = stream.current(); let escaped = false, c;
      while ((c = stream.next()) !== undefined) {
        if (c === quote && !escaped) break;
        escaped = !escaped && c === '\\';
      }
      return 'string';
    }
    if (stream.match(/^[0-9٠-٩]+(?:\.[0-9٠-٩]+)?/)) return 'number';
    if (stream.match(/^[\p{L}_][\p{L}\p{M}\p{N}_]*/u)) {
      const word = stream.current().normalize('NFC');
      if (keywords.has(word)) return 'keyword';
      if (word === 'اطبع') return 'print';
      if (['صحيح', 'خطأ'].includes(word)) return 'bool';
      return 'variableName';
    }
    if (stream.match(/^[+*/%<>=!&|\-]+/)) return 'operator';
    if (stream.match(/^[(){};؛]/)) return 'bracket';
    stream.next(); return null;
  },
  tokenTable: { print: tags.function(tags.name) },
});

export function createEditor(parent, source, { onChange, onRun }) {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(), history(), drawSelection(), highlightActiveLine(), highlightActiveLineGutter(), bracketMatching(), arabic,
        EditorView.cspNonce.of(document.querySelector('meta[name="style-nonce"]')?.content || ''),
        EditorView.contentAttributes.of({ 'aria-label': 'كود البرنامج بالعربية', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        keymap.of([{ key: 'Mod-Enter', run: () => { onRun(); return true; } }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorState.transactionFilter.of(transaction => transaction.newDoc.length > 20000 ? [] : transaction),
        EditorView.updateListener.of(update => { if (update.docChanged) onChange(update.state.doc.toString()); }),
        syntaxHighlighting(HighlightStyle.define([
          { tag: tags.keyword, color: 'var(--purple)' },
          { tag: tags.function(tags.name), color: 'var(--blue)' },
          { tag: tags.string, color: 'var(--green)' },
          { tag: [tags.number, tags.bool], color: 'var(--orange)' },
          { tag: tags.comment, color: 'var(--comment)' },
          { tag: tags.operator, color: 'var(--accent)' },
          { tag: tags.bracket, color: 'var(--muted)' },
        ])),
      ],
    }),
  });
  return {
    get value() { return view.state.doc.toString(); },
    set value(text) { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: 0 } }); },
    focus() { view.focus(); },
    destroy() { view.destroy(); },
  };
}

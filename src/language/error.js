export class LanguageError extends Error {
  constructor(phase, message, location = { line: 1, column: 1 }) {
    super(message);
    this.name = 'LanguageError';
    this.phase = phase;
    this.line = location.line;
    this.column = location.column;
  }
  toJSON() {
    return { phase: this.phase, message: this.message, line: this.line, column: this.column };
  }
}

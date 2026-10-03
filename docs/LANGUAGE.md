# Turjuman v1 language specification

## Grammar (EBNF)

```ebnf
program     = { statement } ;
statement   = ( declaration | assignment | print | conditional | loop ), [ ";" | "؛" ] ;
declaration = "متغير", identifier, "=", expression ;
assignment  = identifier, "=", expression ;
print       = "اطبع", "(", expression, ")" ;
conditional = "إذا", expression, block, [ "وإلا", block ] ;
loop        = "طالما", expression, block ;
block       = "{", { statement }, "}" ;
expression  = unary, { binaryOperator, unary } ; (* precedence table below *)
unary       = ( "-" | "+" | "!" | "ليس" ), unary | primary ;
primary     = number | string | "صحيح" | "خطأ" | identifier | "(", expression, ")" ;
```

Whitespace, including newlines, separates tokens but does not terminate statements. Print requires parentheses; condition parentheses are optional. Braces are required for branches and loops. Standalone blocks and expression statements are not supported. Nest another `إذا` inside an `وإلا` block for an else-if chain.

## Operators (low to high precedence)

| Level | Operators | Types |
| --- | --- | --- |
| 1 | `أو`, `||` | Boolean OR, short circuit |
| 2 | `و`, `&&` | Boolean AND, short circuit |
| 3 | `==`, `!=` | Strict value/type equality |
| 4 | `<`, `<=`, `>`, `>=` | Numeric comparisons |
| 5 | `+`, `-` | Numeric; `+` also joins two strings |
| 6 | `*`, `/`, `%` | Numeric |
| 7 | unary `-`, `+`, `!`, `ليس` | Numeric signs or boolean negation |

Binary operators associate left-to-right. `1 < 2 < 3` is not a range test: use `1 < 2 و 2 < 3`. There is no implicit conversion: `"age: " + 21` is an error. Print strings and numbers separately. Equality across different types is false. Conditions require booleans, not truthy numbers or strings.

## Values, identifiers and scope

Numbers use JavaScript's finite IEEE-754 double precision, including its rounding limitations. Division by zero and non-finite results are errors; `%` follows remainder semantics. Output uses ASCII digits. Strings use single or double ASCII quotes and support `\n`, `\t`, `\\`, `\"`, `\'`. Literal newlines inside strings are rejected.

Identifiers start with a Unicode letter or underscore and continue with letters, marks, numbers or underscores. Arabic and English names may be mixed. Identifiers are normalized to NFC. Keywords must use the documented spelling, including hamzas. Persian digits and Arabic decimal separators are not supported in numeric literals. Columns count UTF-16 code units, beginning at 1.

Declarations may shadow outer bindings but cannot redeclare a name in the same scope. Reads and assignments search the nearest enclosing scope. Each executed block creates a new scope, including each loop iteration. Uninitialized/undefined variables are errors. Variables can change type on reassignment, but operators still check their operands. Only global variables appear in the variables inspector.

## Limits and errors

Default public `run` limits: 20,000 source code units, 50,000 evaluation/statement steps, 500 printed entries and 10,000 code units per string, with 64,000 total printed code units. Parser recursion, AST nesting and evaluator depth have explicit caps. A printed entry can contain embedded newlines. Steps count AST evaluation/statement visits, not source lines or machine instructions.

Errors carry phase (`lexer`, `parser`, `runtime`), an Arabic message, and one-based line/column. Lexing and parsing complete before execution. Runtime errors retain output already produced. The API exposes no option to raise execution limits; trusted callers importing the interpreter can provide options. There is no error recovery or multiple-error reporting yet.

# Architecture and engineering decisions

## Shared, platform-independent engine

The language modules depend only on one another. Node's CLI and HTTP API import the same entry point as the browser worker. Engine tests need no browser. The frontend uses textContent for output and JSON inspectors, so program strings are displayed as text rather than rendered HTML.

## Lexer

A single cursor tracks source offsets, line and column. Tokens carry a type, decoded value and location. Keywords are recognized after scanning a complete identifier, preventing prefix collisions. Comments and whitespace are discarded. Digits are normalized before numeric conversion; identifiers are normalized before keyword lookup.

## Parser

Statements use recursive descent. Expressions use precedence climbing: parse a primary/unary expression, then consume binary operators while their precedence reaches the current threshold. Parsing the right operand at `precedence + 1` implements left associativity. Nodes keep the relevant keyword/operator position. A bounded iterative validation pass rejects deeply nested trees before serialization or evaluation.

## Interpreter and environments

AST nodes are evaluated directly by type. A Scope contains a Map and a parent pointer. Lookup walks outward; assignment modifies the nearest owner; declaration writes only to the current scope. A fresh child scope for each block gives predictable shadowing and makes loop-local declarations reusable on each iteration. Global state is recreated on every run.

Boolean operators evaluate the left side before deciding whether to evaluate the right side. Arithmetic and conditions are checked explicitly instead of inheriting JavaScript coercion. There is no eval, Function constructor, generated JavaScript or arbitrary host access in the language.

## Execution boundaries

The hosted browser sends execution to the backend after a health check. A static-only copy uses a browser worker. Stop aborts the HTTP request or terminates the browser worker, and stale responses are ignored. Engine step limits also catch empty infinite loops. Source, string, output and nesting caps bound common resource growth. The server runs each request in a disposable Node worker with a two-second timeout, a heap limit, and at most four active requests. Excess requests get 503 instead of entering an unbounded queue. Disconnects cancel execution. Health checks remain independent of execution. This is a bounded demo service rather than a complete multi-tenant sandbox.

## Complexity

For source length n, tokenization is O(n); parsing is approximately O(n) with fixed precedence levels, and token/AST storage is O(n). Interpretation depends on executed steps rather than source length: a short loop can execute many times. Variable lookup is O(d) for scope depth d. String concatenation has a cost proportional to its resulting length. Output and limits consume additional bounded memory. There is no bytecode optimizer or JIT.

## Tradeoffs / next milestones

- Handwritten parser: transparent and easy to explain; extending syntax requires grammar and regression tests.
- Tree walker: direct relationship to AST; slower than bytecode on larger workloads.
- Lightweight editor: CodeMirror renders editable syntax-colored text and its cursor in one measured layout, with bidirectional navigation, native input handling, undo history and shared light/dark theme colors. The previous transparent textarea overlay was removed because it could disagree with Arabic text layout. Styles use a per-response CSP nonce; scripts remain restricted to the same origin.
- First-error reporting: deterministic, small implementation; no recovery to collect multiple diagnostics.
- Planned: functions/call frames, arrays, step debugging, syntax-aware editor, source spans, and service-level abuse controls.

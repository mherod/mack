# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mack is a Markdown to Slack BlockKit Blocks parser. It converts Markdown (including GitHub Flavoured Markdown) into Slack BlockKit block objects that can be sent via Slack's API. The parser uses the `marked` library for lexical analysis and transforms tokens into Slack's block format.

## Development Commands

### Install dependencies
```bash
npm install
```

### Build the project
```bash
npm run compile
```
This compiles TypeScript to JavaScript in the `build/` directory using `tsc`.

### Run tests
```bash
npm test
```
This runs:
1. `npm run compile` (pretest hook)
2. Jest tests with ts-jest preset
3. `npm run lint` (posttest hook)

Tests are located in `test/*.spec.ts` and use the pattern `**/*.spec.ts`.

### Run a single test file
```bash
npx jest test/parser.spec.ts
```
or
```bash
npx jest test/integration.spec.ts
```

### Lint code
```bash
npm run lint
```
Uses Google TypeScript Style (gts).

### Auto-fix lint issues
```bash
npm run fix
```

### Clean build artifacts
```bash
npm run clean
```

## Architecture

### Core Components

**Entry Point (`src/index.ts`)**
- Exports `markdownToBlocks()` function - the main API
- Uses `marked.Lexer` with custom tokenizer for Slack-specific escaping
- Only escapes `&`, `<`, and `>` per Slack's formatting requirements
- Delegates token parsing to `parseBlocks()`

**Parser (`src/parser/internal.ts`)**
- `parseBlocks()`: Main parser that converts marked tokens to Slack blocks
- `parseToken()`: Routes different token types to specific parsers
- Token-specific parsers: `parseHeading()`, `parseParagraph()`, `parseCode()`, `parseList()`, `parseTable()`, `parseBlockquote()`, `parseHTML()`
- Inline content parsers: `parseMrkdwn()` converts inline elements (bold, italic, links, etc.) to Slack's mrkdwn format
- `parsePhrasingContent()`: Handles inline tokens and accumulates them into section blocks

**Slack Block Builders (`src/slack.ts`)**
- Factory functions for creating Slack blocks: `section()`, `header()`, `image()`, `divider()`
- Enforces Slack API limits (text: 3000 chars, headers: 150 chars, etc.)
- Automatically truncates content to fit Slack's constraints

**Types (`src/types.ts`)**
- `ParsingOptions`: Configuration for the parser
- `ListOptions`: Configure checkbox prefix display

### Key Design Patterns

1. **Token Accumulation**: Section blocks are accumulated when consecutive inline content appears, reducing block count
2. **Recursive Parsing**: Inline elements like links and emphasis recursively parse their children
3. **XML Parsing**: HTML tokens are parsed with `fast-xml-parser` to extract image tags
4. **Length Truncation**: All text is truncated at Slack's API limits in the block builder functions

### Native Table Support

Mack now supports Slack's native Table blocks (introduced in 2024):
- **Rich text formatting** in cells: bold, italic, strikethrough, code, links
- **Column alignment**: left (default), center, or right from markdown
- **Automatic format detection**: uses `raw_text` for simple cells, `rich_text` for formatted cells
- **Validation**: enforces Slack's limits (100 rows max, 20 cells per row, 20 column settings)

Example:
```markdown
| Header | **Bold** | *Italic* |
|:-------|:--------:|----------:|
| Left   | Center   | Right    |
```

Produces a native Slack Table block with proper alignment and formatting.

## Code Style

This project uses Google TypeScript Style (gts). The configuration extends from `node_modules/gts/tsconfig-google.json`.

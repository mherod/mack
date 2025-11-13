# Mack: Markdown to Slack BlockKit

> Convert Markdown to native Slack BlockKit blocks with rich formatting support

[![Node.js CI](https://github.com/mherod/mack/actions/workflows/ci.yml/badge.svg)](https://github.com/mherod/mack/actions/workflows/ci.yml)
[![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg)](https://github.com/google/gts)
[![npm version](https://img.shields.io/npm/v/@mherod/mack.svg)](https://www.npmjs.com/package/@mherod/mack)

> **Note**: This is a fork of the original [Mack project by Fabric](https://github.com/tryfabric/mack), maintained by [@mherod](https://github.com/mherod) with enhanced features and native Slack block support.

A TypeScript library for parsing Markdown and GitHub Flavoured Markdown into Slack's BlockKit format. Mack leverages native Slack blocks for superior rendering quality.

## Features

### Native Slack Blocks

- **Lists** → `rich_text_list` blocks with proper visual structure
- **Code blocks** → `rich_text_preformatted` for improved syntax presentation
- **Blockquotes** → `rich_text_quote` for cleaner formatting
- **Tables** → Native Slack table blocks with column alignment and rich formatting

### Comprehensive Markdown Support

- **Inline formatting**: bold, italic, strikethrough, inline code, hyperlinks
- **Lists**: ordered, unordered, checkbox (with ✅/☐ indicators), nested lists
- **Headings**: All heading levels (rendered as Slack headers)
- **Code blocks**: With optional language hints
- **Blockquotes**: Simple quotes and complex quotes with lists, code, and nesting
- **Images**: Both Markdown and HTML syntax
- **Tables**: Markdown and HTML tables with rich text formatting in cells
- **Media**: Video embeds and file attachments
- **Horizontal rules**: Divider blocks

### Robust Parsing

- UTF-8 aware text truncation respecting Slack's API limits
- Comprehensive error handling with graceful degradation
- URL validation and security features
- Recursion depth protection
- 223 test cases with full coverage

## Installation

```bash
npm install @mherod/mack
```

## Quick Start

```typescript
import {markdownToBlocks} from '@mherod/mack';

const markdown = `
# Hello World

A simple example with **bold** and _italic_ text.

- Task list items
- [x] Completed task
- [ ] Pending task

\`\`\`typescript
const greeting = 'Hello, Slack!';
console.log(greeting);
\`\`\`
`;

const blocks = await markdownToBlocks(markdown);

// Send to Slack
await client.chat.postMessage({
  channel: '#general',
  blocks: blocks,
});
```

## Examples

### Lists

```typescript
const markdown = `
- Bullet point one
- Bullet point two

1. Numbered item
2. Another item

- [x] Completed task
- [ ] Pending task
`;

const blocks = await markdownToBlocks(markdown);
// Renders as native rich_text_list blocks with proper formatting
```

### Code Blocks

```typescript
const markdown = `
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`
`;

const blocks = await markdownToBlocks(markdown);
// Renders as rich_text_preformatted block
```

### Tables

```typescript
const markdown = `
| Feature | Status | Priority |
|---------|:------:|---------:|
| Lists   | ✅     | High     |
| Tables  | ✅     | High     |
| Images  | ✅     | Medium   |
`;

const blocks = await markdownToBlocks(markdown);
// Renders as native Slack table block with alignment
```

### Blockquotes

```typescript
const markdown = `
> This is a simple quote with **bold** text.

> Complex quote:
> - With lists
> - And formatting
`;

const blocks = await markdownToBlocks(markdown);
// Simple quotes render as rich_text_quote
// Complex quotes render with proper nesting
```

## API

### `markdownToBlocks(markdown, options?)`

Converts Markdown to Slack BlockKit blocks.

**Parameters:**
- `markdown` (string): The Markdown content to parse
- `options` (ParsingOptions, optional): Configuration options

**Returns:** `Promise<Block[]>` - Array of Slack BlockKit blocks

**Throws:**
- `ValidationError`: Invalid input or content exceeding limits
- `BlockLimitError`: Block count exceeds Slack's 50 block maximum
- `ParseError`: Parsing failures

### Options

```typescript
interface ParsingOptions {
  lists?: ListOptions;
}

interface ListOptions {
  // Customize checkbox prefixes (default: ✅ for checked, ☐ for unchecked)
  checkboxPrefix?: (checked: boolean) => string;
}
```

**Example:**

```typescript
const blocks = await markdownToBlocks(markdown, {
  lists: {
    checkboxPrefix: (checked) => checked ? '[x] ' : '[ ] '
  }
});
```

## Block Types

Mack generates the following Slack block types:

| Markdown Element | Slack Block Type |
|-----------------|------------------|
| Headings | `header` |
| Paragraphs | `section` with `mrkdwn` |
| Lists | `rich_text` with `rich_text_list` |
| Code blocks | `rich_text` with `rich_text_preformatted` |
| Blockquotes | `rich_text` with `rich_text_quote` |
| Images | `image` |
| Tables | `table` |
| Horizontal rules | `divider` |
| Videos | `video` |
| File attachments | `file` |

## Limitations

- **Nested lists**: Currently flattened within a single `rich_text_list` block
- **Checkbox interactivity**: Checkboxes render as static text with emoji indicators (not interactive)
- **Block limit**: Slack enforces a maximum of 50 blocks per message
- **Text limits**: Section blocks limited to 3000 characters, headers to 150 characters

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run compile

# Lint
npm run lint

# Fix linting issues
npm run fix
```

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass (`npm test`)
2. Code follows Google TypeScript Style (`npm run lint`)
3. New features include test coverage
4. Breaking changes are clearly documented

## Credits

- Original project by [Fabric](https://github.com/tryfabric/mack)
- Enhanced and maintained by [Matthew Herod](https://github.com/mherod)
- Built with [marked](https://marked.js.org/) for Markdown parsing

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

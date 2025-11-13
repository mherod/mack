import type {KnownBlock} from '@slack/types';
import {parseBlocks} from './parser/internal';
import type {ParsingOptions} from './types';
import {marked} from 'marked';
import {validateInput, validateBlockCount, MAX_BLOCKS} from './validation';
import type {TableBlock, VideoBlock, FileBlock, RichTextBlock} from './slack';

/**
 * Parses Markdown content into Slack BlockKit Blocks.
 * - Supports headings (all Markdown heading levels are treated as the single Slack header block)
 * - Supports numbered lists, bulleted lists, to-do lists
 * - Supports italics, bold, strikethrough, inline code, hyperlinks
 * - Supports images
 * - Supports thematic breaks / dividers
 * - Supports nested lists and blockquotes with rich content
 * - Supports native table blocks with rich text formatting and column alignment
 *
 * Supports GitHub-flavoured Markdown.
 *
 * Enforces Slack API limits:
 * - Maximum 50 blocks per message
 * - Maximum 3000 characters per section block
 * - Maximum 150 characters per header block
 * - Text truncation handles multi-byte characters safely
 *
 * @param body any Markdown or GFM content
 * @param options options to configure the parser
 * @throws {ValidationError} if input is invalid or exceeds limits
 * @throws {BlockLimitError} if block count exceeds maximum
 * @throws {ParseError} if parsing fails
 */
export async function markdownToBlocks(
  body: string,
  options: ParsingOptions = {}
): Promise<
  (KnownBlock | TableBlock | VideoBlock | FileBlock | RichTextBlock)[]
> {
  // Validate input
  validateInput(body);

  // Slack only wants &, <, and > escaped
  // https://api.slack.com/reference/surfaces/formatting#escaping
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  };

  const lexer = new marked.Lexer();
  lexer.options.tokenizer = new marked.Tokenizer();
  lexer.options.tokenizer.inlineText = src => {
    const text = src.replace(/[&<>]/g, char => {
      return replacements[char];
    });

    return {
      type: 'text',
      raw: src,
      text: text,
    };
  };

  const tokens = lexer.lex(body);

  const blocks = parseBlocks(tokens, options);

  // Validate block count
  validateBlockCount(blocks.length, MAX_BLOCKS);

  return blocks;
}

import {
  DividerBlock,
  HeaderBlock,
  ImageBlock,
  KnownBlock,
  SectionBlock,
} from '@slack/types';
import {ParsingOptions, ListOptions} from '../types';
import {
  section,
  divider,
  header,
  image,
  video,
  table,
  file,
  richTextList,
  richTextCode,
  richTextQuote,
  VideoBlock,
  FileBlock,
  TableBlock,
  RichTextBlock,
  TableRow,
  TableCell,
  ColumnSetting,
  RichTextSectionElement,
  RichTextElement,
} from '../slack';
import {marked} from 'marked';
import {XMLParser} from 'fast-xml-parser';
import {
  validateUrl,
  validateRecursionDepth,
  SECURE_XML_CONFIG,
} from '../validation';

type PhrasingToken =
  | marked.Tokens.Link
  | marked.Tokens.Em
  | marked.Tokens.Strong
  | marked.Tokens.Del
  | marked.Tokens.Br
  | marked.Tokens.Image
  | marked.Tokens.Codespan
  | marked.Tokens.Text
  | marked.Tokens.HTML;

// Recursion depth context for tracking nested content
let recursionDepth = 0;

// File extensions that should be converted to file blocks
const FILE_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'txt',
  'csv',
  'json',
  'xml',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'svg',
]);

function detectFileExtension(href: string): string | null {
  // Extract the path part (before query string or hash)
  const pathname = href.split('?')[0].split('#')[0];
  const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : null;
}

function isFileType(extension: string | null): boolean {
  return extension !== null && FILE_EXTENSIONS.has(extension);
}

function extractFileName(href: string): string {
  // Extract the path part (before query string or hash)
  const pathname = href.split('?')[0].split('#')[0];
  return pathname.split('/').pop() || 'Document';
}

function parsePlainText(element: PhrasingToken): string[] {
  switch (element.type) {
    case 'link':
    case 'em':
    case 'strong':
    case 'del':
      return element.tokens.flatMap((child: marked.Token) =>
        parsePlainText(child as PhrasingToken)
      );

    case 'br':
      return [];

    case 'image':
      return [element.title ?? element.href];

    case 'codespan':
    case 'text':
    case 'html':
      return [element.raw];
  }
}

function isSectionBlock(block: KnownBlock): block is SectionBlock {
  return block.type === 'section';
}

function parseMrkdwn(
  element: Exclude<PhrasingToken, marked.Tokens.Image>
): string {
  recursionDepth++;
  try {
    validateRecursionDepth(recursionDepth);

    switch (element.type) {
      case 'link': {
        // Validate URL before including it
        const href =
          element.href && validateUrl(element.href) ? element.href : '';
        if (!href) {
          // URL is invalid, just return the link text without formatting
          return element.tokens
            .flatMap((child: marked.Token) =>
              parseMrkdwn(child as Exclude<PhrasingToken, marked.Tokens.Image>)
            )
            .join('');
        }
        return `<${href}|${element.tokens
          .flatMap((child: marked.Token) =>
            parseMrkdwn(child as Exclude<PhrasingToken, marked.Tokens.Image>)
          )
          .join('')}> `;
      }

      case 'em': {
        return `_${element.tokens
          .flatMap((child: marked.Token) =>
            parseMrkdwn(child as Exclude<PhrasingToken, marked.Tokens.Image>)
          )
          .join('')}_`;
      }

      case 'codespan':
        return `\`${element.text}\``;

      case 'strong': {
        return `*${element.tokens
          .flatMap((child: marked.Token) =>
            parseMrkdwn(child as Exclude<PhrasingToken, marked.Tokens.Image>)
          )
          .join('')}*`;
      }

      case 'text':
        return element.text;

      case 'del': {
        return `~${element.tokens
          .flatMap((child: marked.Token) =>
            parseMrkdwn(child as Exclude<PhrasingToken, marked.Tokens.Image>)
          )
          .join('')}~`;
      }

      default:
        return '';
    }
  } finally {
    recursionDepth--;
  }
}

function addMrkdwn(
  content: string,
  accumulator: (SectionBlock | ImageBlock | FileBlock)[]
) {
  const last = accumulator[accumulator.length - 1];

  if (last && isSectionBlock(last) && last.text) {
    last.text.text += content;
  } else {
    accumulator.push(section(content));
  }
}

function parsePhrasingContent(
  element: PhrasingToken,
  accumulator: (SectionBlock | ImageBlock | FileBlock)[]
) {
  if (element.type === 'image') {
    try {
      const imageBlock: ImageBlock = image(
        element.href,
        element.text || element.title || element.href,
        element.title
      );
      accumulator.push(imageBlock);
    } catch (error) {
      // Skip images with invalid URLs instead of throwing
      // This allows graceful degradation - silently skip
    }
  } else if (element.type === 'link') {
    // Check if this is a file link - check both URL and link text
    const linkText = element.tokens
      .flatMap((child: marked.Token) => parsePlainText(child as PhrasingToken))
      .join('');
    const urlExtension = detectFileExtension(element.href);
    const textExtension = detectFileExtension(linkText);
    const fileExtension = urlExtension || textExtension;

    if (isFileType(fileExtension)) {
      try {
        // Prefer text filename, fall back to URL filename
        const fileName = textExtension
          ? extractFileName(linkText)
          : extractFileName(element.href);
        const fileBlock: FileBlock = file(fileName);
        accumulator.push(fileBlock);
      } catch (error) {
        // If file block creation fails, treat as regular link
        const text = parseMrkdwn(element);
        addMrkdwn(text, accumulator);
      }
    } else {
      const text = parseMrkdwn(element);
      addMrkdwn(text, accumulator);
    }
  } else {
    const text = parseMrkdwn(element);
    addMrkdwn(text, accumulator);
  }
}

function parseParagraph(
  element: marked.Tokens.Paragraph
): (KnownBlock | FileBlock)[] {
  return element.tokens.reduce<(SectionBlock | ImageBlock | FileBlock)[]>(
    (
      accumulator: (SectionBlock | ImageBlock | FileBlock)[],
      child: marked.Token
    ) => {
      parsePhrasingContent(child as PhrasingToken, accumulator);
      return accumulator;
    },
    []
  );
}

function parseHeading(element: marked.Tokens.Heading): HeaderBlock {
  return header(
    element.tokens
      .flatMap((child: marked.Token) => parsePlainText(child as PhrasingToken))
      .join('')
  );
}

function parseCode(element: marked.Tokens.Code): RichTextBlock {
  return richTextCode(element.text);
}

function parseList(
  element: marked.Tokens.List,
  options: ListOptions = {},
  indent = 0
): RichTextBlock {
  const items: RichTextElement[] = [];

  // Default checkbox prefix function
  const defaultCheckboxPrefix = (checked: boolean): string => {
    return checked ? '✅ ' : '☐ ';
  };

  const checkboxPrefix = options.checkboxPrefix || defaultCheckboxPrefix;

  for (const item of element.items) {
    const itemElements: RichTextSectionElement[] = [];

    // Handle checkbox items by adding prefix
    if (item.task) {
      const prefix = checkboxPrefix(item.checked || false);
      itemElements.push({
        type: 'text',
        text: prefix,
      });
    }

    for (const token of item.tokens) {
      if (token.type === 'text' || token.type === 'paragraph') {
        const textToken = token as marked.Tokens.Text | marked.Tokens.Paragraph;
        if (!textToken.tokens?.length) {
          continue;
        }

        // Convert tokens to rich text elements
        const richElements = tokensToRichTextElements(
          textToken.tokens as PhrasingToken[]
        );
        itemElements.push(...richElements);
      } else if (token.type === 'code') {
        // Include code blocks as code-styled text within list items
        const codeToken = token as marked.Tokens.Code;
        itemElements.push({
          type: 'text',
          text: `\n${codeToken.text}\n`,
          style: {code: true},
        });
      }
      // Note: Nested lists are not yet supported in rich_text_list format
      // They would need to be separate blocks with increased indent
    }

    items.push({
      type: 'rich_text_section',
      elements: itemElements,
    });
  }

  // Determine list style - checkbox lists use bullet style
  let style: 'bullet' | 'ordered' = 'bullet';
  if (element.ordered) {
    style = 'ordered';
  }

  return richTextList(items, style, indent);
}

// Helper function to convert marked tokens to rich text elements
function tokensToRichTextElements(
  tokens: PhrasingToken[]
): RichTextSectionElement[] {
  const elements: RichTextSectionElement[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        elements.push({
          type: 'text',
          text: token.text,
        });
        break;

      case 'strong': {
        const strongText = token.tokens
          .map((t: marked.Token) => (t as marked.Tokens.Text).text || '')
          .join('');
        elements.push({
          type: 'text',
          text: strongText,
          style: {bold: true},
        });
        break;
      }

      case 'em': {
        const emText = token.tokens
          .map((t: marked.Token) => (t as marked.Tokens.Text).text || '')
          .join('');
        elements.push({
          type: 'text',
          text: emText,
          style: {italic: true},
        });
        break;
      }

      case 'del': {
        const delText = token.tokens
          .map((t: marked.Token) => (t as marked.Tokens.Text).text || '')
          .join('');
        elements.push({
          type: 'text',
          text: delText,
          style: {strike: true},
        });
        break;
      }

      case 'codespan':
        elements.push({
          type: 'text',
          text: token.text,
          style: {code: true},
        });
        break;

      case 'link': {
        const linkText = token.tokens
          .map((t: marked.Token) => (t as marked.Tokens.Text).text || '')
          .join('');
        if (validateUrl(token.href)) {
          elements.push({
            type: 'link',
            text: linkText,
            url: token.href,
          });
        } else {
          // Fallback to plain text if URL is invalid
          elements.push({
            type: 'text',
            text: linkText,
          });
        }
        break;
      }

      case 'image':
        // Images can't be inline in table cells, use text fallback
        elements.push({
          type: 'text',
          text: token.text || token.title || '[image]',
        });
        break;

      default:
        // Fallback for unsupported token types
        if (
          'text' in token &&
          typeof (token as {text?: string}).text === 'string'
        ) {
          elements.push({
            type: 'text',
            text: (token as {text: string}).text,
          });
        }
    }
  }

  return elements;
}

// Parse a table cell to a TableCell object
function parseTableCellToBlock(cell: marked.Tokens.TableCell): TableCell {
  // Check if cell contains complex formatting
  const hasComplexFormatting = cell.tokens.some((token: marked.Token) => {
    const tokenType = (token as PhrasingToken).type;
    return ['strong', 'em', 'del', 'link', 'codespan'].includes(tokenType);
  });

  if (hasComplexFormatting) {
    // Use rich_text for complex formatting
    const elements = tokensToRichTextElements(cell.tokens as PhrasingToken[]);
    return {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_section',
          elements,
        },
      ],
    };
  } else {
    // Use raw_text for simple text
    const text = cell.tokens
      .map((token: marked.Token) => {
        if ('text' in token) {
          return (token as marked.Tokens.Text).text;
        }
        return '';
      })
      .join('');
    return {
      type: 'raw_text',
      text,
    };
  }
}

// Parse table rows to TableRow array
function parseTableRowsToBlocks(
  header: marked.Tokens.TableCell[],
  rows: marked.Tokens.TableCell[][],
  align: Array<'left' | 'center' | 'right' | null>
): {tableRows: TableRow[]; columnSettings: ColumnSetting[]} {
  const tableRows: TableRow[] = [];

  // Parse header row
  const headerRow: TableCell[] = header.map((cell: marked.Tokens.TableCell) =>
    parseTableCellToBlock(cell)
  );
  tableRows.push(headerRow);

  // Parse data rows
  for (const row of rows) {
    const tableRow: TableCell[] = row.map((cell: marked.Tokens.TableCell) =>
      parseTableCellToBlock(cell)
    );
    tableRows.push(tableRow);
  }

  // Generate column settings from alignment
  const columnSettings: ColumnSetting[] = [];
  for (let i = 0; i < align.length && i < 20; i++) {
    if (align[i] && align[i] !== 'left') {
      // Only add settings for non-default alignment
      columnSettings.push({
        align: align[i] as 'center' | 'right',
      });
    } else if (columnSettings.length > 0) {
      // Add null to maintain column index
      columnSettings.push({});
    }
  }

  return {tableRows, columnSettings};
}

function parseTable(element: marked.Tokens.Table): TableBlock {
  const {tableRows, columnSettings} = parseTableRowsToBlocks(
    element.header,
    element.rows,
    element.align
  );

  return table(
    tableRows,
    columnSettings.length > 0 ? columnSettings : undefined
  );
}

function parseBlockquote(
  element: marked.Tokens.Blockquote
): (KnownBlock | TableBlock | VideoBlock | FileBlock | RichTextBlock)[] {
  // Check if blockquote contains only paragraph tokens (simple quote)
  const onlyParagraphs = element.tokens.every(
    (token: marked.Token) => token.type === 'paragraph' || token.type === 'text'
  );

  if (onlyParagraphs) {
    // First check if paragraphs contain file links by parsing them normally
    const testBlocks = element.tokens.flatMap((token: marked.Token) => {
      if (token.type === 'paragraph') {
        return parseParagraph(token as marked.Tokens.Paragraph);
      }
      return [];
    });

    // If any file blocks were generated, use the old approach
    const hasFileBlocks = testBlocks.some(
      (
        block: KnownBlock | TableBlock | VideoBlock | FileBlock | RichTextBlock
      ) => block.type === 'file'
    );
    if (hasFileBlocks) {
      // Fall through to the complex blockquote handling below
    } else {
      // Convert to rich_text_quote for simple quotes
      const quoteElements: RichTextSectionElement[] = [];

      for (const token of element.tokens) {
        if (token.type === 'paragraph') {
          const paragraphToken = token as marked.Tokens.Paragraph;
          if (paragraphToken.tokens?.length) {
            const richElements = tokensToRichTextElements(
              paragraphToken.tokens as PhrasingToken[]
            );
            quoteElements.push(...richElements);
            // Add newline between paragraphs
            if (element.tokens.indexOf(token) < element.tokens.length - 1) {
              quoteElements.push({type: 'text', text: '\n'});
            }
          }
        } else if (token.type === 'text') {
          const textToken = token as marked.Tokens.Text;
          if (textToken.tokens?.length) {
            const richElements = tokensToRichTextElements(
              textToken.tokens as PhrasingToken[]
            );
            quoteElements.push(...richElements);
          } else {
            quoteElements.push({type: 'text', text: textToken.text});
          }
        }
      }

      if (quoteElements.length > 0) {
        return [richTextQuote(quoteElements)];
      }
      return [];
    }
  }

  // For complex blockquotes (with lists, code, etc.), use the old approach
  const blocks = element.tokens.flatMap((token: marked.Token) => {
    if (token.type === 'paragraph') {
      return parseParagraph(token);
    } else if (token.type === 'list') {
      return [parseList(token)];
    } else if (token.type === 'code') {
      return [parseCode(token)];
    } else if (token.type === 'blockquote') {
      // Handle nested blockquotes
      return parseBlockquote(token);
    } else if (token.type === 'heading') {
      return [parseHeading(token)];
    } else if (token.type === 'html') {
      return parseHTML(token);
    }
    // Skip unsupported token types in blockquotes
    return [];
  });

  // Add blockquote formatting to section blocks only
  return blocks.map(
    (
      block: KnownBlock | TableBlock | VideoBlock | FileBlock | RichTextBlock
    ) => {
      if ('type' in block && block.type === 'section' && block.text?.text) {
        block.text.text = '> ' + block.text.text.replace(/\n/g, '\n> ');
      }
      return block;
    }
  );
}

function parseThematicBreak(): DividerBlock {
  return divider();
}

// Type for parsed XML/HTML elements
interface XmlElement {
  '#text'?: string;
  _?: string;
  '@_align'?: string;
  '@_style'?: string;
  [key: string]: unknown;
}

// Helper function to extract text content from HTML element
function extractTextFromHtmlElement(
  element: XmlElement | string | XmlElement[]
): string {
  if (typeof element === 'string') {
    return element;
  }
  if (Array.isArray(element)) {
    return element
      .map((e: XmlElement | string) => extractTextFromHtmlElement(e))
      .join('');
  }
  if (element && element['#text']) {
    return element['#text'];
  }
  if (element && typeof element === 'object') {
    // Handle nested elements (like <b>, <i>, etc.)
    const keys = Object.keys(element);
    for (const key of keys) {
      if (key !== '@_align' && !key.startsWith('@_')) {
        const value = element[key];
        if (typeof value === 'string') {
          return value;
        }
        if (
          value &&
          typeof value === 'object' &&
          (value as XmlElement)['#text']
        ) {
          return (value as XmlElement)['#text'] as string;
        }
        // Recursively extract from nested elements
        const extracted = extractTextFromHtmlElement(value as XmlElement);
        if (extracted) {
          return extracted;
        }
      }
    }
  }
  return '';
}

// Type for HTML table structure from XML parser
interface HtmlTableElement {
  colgroup?: {
    col?: XmlElement | XmlElement[];
  };
  thead?: {
    tr?: XmlElement | XmlElement[];
  };
  tbody?: {
    tr?: XmlElement | XmlElement[];
  };
  tr?: XmlElement | XmlElement[];
  [key: string]: unknown;
}

// Helper function to parse HTML table to TableBlock
function parseHtmlTable(tableElement: HtmlTableElement): TableBlock | null {
  try {
    const rows: TableRow[] = [];
    const columnSettings: ColumnSetting[] = [];

    // Extract alignment from col or colgroup elements if present
    if (tableElement.colgroup && tableElement.colgroup.col) {
      const cols = Array.isArray(tableElement.colgroup.col)
        ? tableElement.colgroup.col
        : [tableElement.colgroup.col];

      cols.forEach((col: XmlElement, index: number) => {
        if (col['@_align']) {
          const align = (col['@_align'] as string).toLowerCase();
          if (['center', 'right'].includes(align)) {
            columnSettings[index] = {align: align as 'center' | 'right'};
          }
        }
      });
    }

    // Process thead if present
    if (tableElement.thead && tableElement.thead.tr) {
      const headerRow = Array.isArray(tableElement.thead.tr)
        ? tableElement.thead.tr[0]
        : tableElement.thead.tr;

      if (headerRow && (headerRow as XmlElement).th) {
        const headers = Array.isArray((headerRow as XmlElement).th)
          ? ((headerRow as XmlElement).th as XmlElement[])
          : [(headerRow as XmlElement).th as XmlElement];
        const headerCells: TableCell[] = headers.map(
          (th: XmlElement, index: number) => {
            const text = extractTextFromHtmlElement(th);
            // Check for alignment attribute
            if (th['@_align'] && !columnSettings[index]) {
              const align = (th['@_align'] as string).toLowerCase();
              if (['center', 'right'].includes(align)) {
                columnSettings[index] = {align: align as 'center' | 'right'};
              }
            }
            return {type: 'raw_text', text};
          }
        );
        rows.push(headerCells);
      }
    }

    // Process tbody or direct tr elements
    const bodyElement = tableElement.tbody || tableElement;
    if (bodyElement.tr) {
      const dataRows = Array.isArray(bodyElement.tr)
        ? bodyElement.tr
        : [bodyElement.tr];

      for (const tr of dataRows) {
        // Skip if this was already processed as header
        if (tableElement.thead && tableElement.thead.tr === tr) {
          continue;
        }

        const cells: TableCell[] = [];

        // Handle both td and th elements in body
        const cellElements = (tr as XmlElement).td || (tr as XmlElement).th;
        if (cellElements) {
          const cellArray = Array.isArray(cellElements)
            ? cellElements
            : [cellElements];
          cellArray.forEach((cell: XmlElement, index: number) => {
            const text = extractTextFromHtmlElement(cell);
            // Check for alignment attribute
            if (cell['@_align'] && !columnSettings[index]) {
              const align = (cell['@_align'] as string).toLowerCase();
              if (['center', 'right'].includes(align)) {
                columnSettings[index] = {align: align as 'center' | 'right'};
              }
            }
            cells.push({type: 'raw_text', text});
          });

          if (cells.length > 0) {
            rows.push(cells);
          }
        }
      }
    }

    // Only create table if we have rows
    if (rows.length > 0) {
      // Clean up column settings - remove empty entries at the end
      const cleanedSettings = columnSettings.filter(
        (setting: ColumnSetting, index: number) => {
          // Keep settings if they have values or if there are values after them
          return (
            setting.align ||
            columnSettings
              .slice(index + 1)
              .some((futureSetting: ColumnSetting) => futureSetting.align)
          );
        }
      );

      return table(
        rows,
        cleanedSettings.length > 0 ? cleanedSettings : undefined
      );
    }

    return null;
  } catch (error) {
    console.warn(
      `Failed to parse HTML table: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
    return null;
  }
}

function parseHTML(
  element: marked.Tokens.HTML | marked.Tokens.Tag
): (KnownBlock | TableBlock | VideoBlock | FileBlock)[] {
  try {
    const parser = new XMLParser(SECURE_XML_CONFIG);
    const res = parser.parse(element.raw);
    const blocks: (KnownBlock | TableBlock | VideoBlock | FileBlock)[] = [];

    // Handle tables
    if (res.table) {
      const tableBlock = parseHtmlTable(res.table);
      if (tableBlock) {
        blocks.push(tableBlock);
      }
    }

    // Handle images
    if (res.img) {
      const tags = res.img instanceof Array ? res.img : [res.img];

      const imageBlocks = tags
        .map((img: Record<string, string>) => {
          const url: string = img['@_src'];
          // Validate URL before creating image block
          if (!validateUrl(url)) {
            return null;
          }
          return image(url, img['@_alt'] || url);
        })
        .filter((e: ImageBlock | null) => e !== null) as ImageBlock[];

      blocks.push(...imageBlocks);
    }

    // Handle videos
    if (res.video) {
      const tags = res.video instanceof Array ? res.video : [res.video];

      const videoBlocks = tags
        .map((vid: Record<string, unknown>) => {
          const videoUrl = String(vid['@_src'] || '');
          const posterUrl = String(vid['@_poster'] || '');
          const title = String(vid['@_title'] || 'Video');
          const altText = String(vid['@_alt'] || title);

          // Validate URLs before creating video block
          if (!videoUrl || !validateUrl(videoUrl)) {
            return null;
          }
          if (posterUrl && !validateUrl(posterUrl)) {
            return null;
          }

          try {
            return video({
              videoUrl,
              thumbnailUrl: posterUrl || videoUrl,
              title,
              altText,
              description: undefined,
            });
          } catch {
            return null;
          }
        })
        .filter((e: VideoBlock | null) => e !== null) as VideoBlock[];

      blocks.push(...videoBlocks);
    }

    return blocks;
  } catch (error) {
    // Log parsing error but don't crash - just skip this HTML block
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Failed to parse HTML block: ${errorMessage}`);
    return [];
  }
}

function parseToken(
  token: marked.Token,
  options: ParsingOptions
): (KnownBlock | TableBlock | VideoBlock | FileBlock | RichTextBlock)[] {
  switch (token.type) {
    case 'heading':
      return [parseHeading(token)];

    case 'paragraph':
      return parseParagraph(token);

    case 'code':
      return [parseCode(token)];

    case 'blockquote':
      return parseBlockquote(token);

    case 'list':
      return [parseList(token, options.lists)];

    case 'table':
      return [parseTable(token)];

    case 'hr':
      return [parseThematicBreak()];

    case 'html':
      return parseHTML(token);

    default:
      return [];
  }
}

export function parseBlocks(
  tokens: marked.TokensList,
  options: ParsingOptions = {}
): (KnownBlock | TableBlock | VideoBlock | FileBlock | RichTextBlock)[] {
  return tokens.flatMap((token: marked.Token) => parseToken(token, options));
}

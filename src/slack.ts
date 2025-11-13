import type {
  DividerBlock,
  HeaderBlock,
  ImageBlock,
  SectionBlock,
} from '@slack/types';
import {safeTruncate, validateUrl} from './validation';
import {ValidationError} from './errors';

// Video block type (not yet in @slack/types)
export interface VideoBlock {
  type: 'video';
  alt_text: string;
  title: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
  thumbnail_url: string;
  video_url: string;
  author_name?: string;
  block_id?: string;
  description?: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
  provider_icon_url?: string;
  provider_name?: string;
  title_url?: string;
}

// File block type (not yet in @slack/types)
export interface FileBlock {
  type: 'file';
  external_id: string;
  source: 'remote';
  block_id?: string;
}

// Table block types (not yet in @slack/types)
export interface TableBlock {
  type: 'table';
  block_id?: string;
  rows: TableRow[];
  column_settings?: ColumnSetting[];
}

export type TableRow = TableCell[];

export interface TableCell {
  type: 'raw_text' | 'rich_text';
  text?: string; // for raw_text
  elements?: RichTextElement[]; // for rich_text
}

export interface ColumnSetting {
  align?: 'left' | 'center' | 'right';
  is_wrapped?: boolean;
}

export interface RichTextElement {
  type: 'rich_text_section';
  elements: RichTextSectionElement[];
}

export interface RichTextSectionElement {
  type: 'text' | 'link' | 'emoji';
  text: string;
  style?: {
    bold?: boolean;
    italic?: boolean;
    strike?: boolean;
    code?: boolean;
  };
  url?: string; // for links
  name?: string; // for emoji
}

// Rich text block (container for rich text elements)
export interface RichTextBlock {
  type: 'rich_text';
  block_id?: string;
  elements: (
    | RichTextListElement
    | RichTextElement
    | RichTextPreformattedElement
    | RichTextQuoteElement
  )[];
}

// Rich text list element (for bullet and numbered lists)
export interface RichTextListElement {
  type: 'rich_text_list';
  style: 'bullet' | 'ordered';
  indent?: number;
  offset?: number; // Starting number for ordered lists
  border?: number;
  elements: RichTextElement[];
}

// Rich text preformatted element (for code blocks)
export interface RichTextPreformattedElement {
  type: 'rich_text_preformatted';
  elements: RichTextSectionElement[];
  border?: number;
}

// Rich text quote element (for blockquotes)
export interface RichTextQuoteElement {
  type: 'rich_text_quote';
  elements: RichTextSectionElement[];
  border?: number;
}

const MAX_TEXT_LENGTH = 3000;
const MAX_HEADER_LENGTH = 150;
const MAX_IMAGE_TITLE_LENGTH = 2000;
const MAX_IMAGE_ALT_TEXT_LENGTH = 2000;
const MAX_VIDEO_TITLE_LENGTH = 200;
const MAX_VIDEO_DESCRIPTION_LENGTH = 200;
const MAX_VIDEO_AUTHOR_NAME_LENGTH = 50;

export function section(text: string): SectionBlock {
  if (typeof text !== 'string') {
    throw new ValidationError(
      `Section text must be a string, received ${typeof text}`
    );
  }

  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: safeTruncate(text, MAX_TEXT_LENGTH),
    },
  };
}

export function divider(): DividerBlock {
  return {
    type: 'divider',
  };
}

export function header(text: string): HeaderBlock {
  if (typeof text !== 'string') {
    throw new ValidationError(
      `Header text must be a string, received ${typeof text}`
    );
  }

  return {
    type: 'header',
    text: {
      type: 'plain_text',
      text: safeTruncate(text, MAX_HEADER_LENGTH),
    },
  };
}

export function image(
  url: string,
  altText: string,
  title?: string
): ImageBlock {
  if (typeof url !== 'string' || !url) {
    throw new ValidationError('Image URL must be a non-empty string');
  }

  // Validate URL - for backward compatibility, allow relative URLs and strings that don't look like URLs
  // but validate that absolute URLs follow proper format
  const isAbsoluteUrl =
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:');
  if (isAbsoluteUrl && !validateUrl(url)) {
    throw new ValidationError(`Invalid image URL: ${url}`);
  }

  if (typeof altText !== 'string') {
    throw new ValidationError(
      `Image alt text must be a string, received ${typeof altText}`
    );
  }

  return {
    type: 'image',
    image_url: url,
    alt_text: safeTruncate(altText, MAX_IMAGE_ALT_TEXT_LENGTH),
    title: title
      ? {
          type: 'plain_text',
          text: safeTruncate(title, MAX_IMAGE_TITLE_LENGTH),
        }
      : undefined,
  };
}

export interface VideoBlockOptions {
  altText: string;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  authorName?: string;
  description?: string;
  providerIconUrl?: string;
  providerName?: string;
  titleUrl?: string;
}

export function video(options: VideoBlockOptions): VideoBlock {
  // Validate required fields
  if (typeof options.altText !== 'string' || !options.altText) {
    throw new ValidationError('Video alt text must be a non-empty string');
  }

  if (typeof options.title !== 'string' || !options.title) {
    throw new ValidationError('Video title must be a non-empty string');
  }

  if (typeof options.thumbnailUrl !== 'string' || !options.thumbnailUrl) {
    throw new ValidationError('Video thumbnail URL must be a non-empty string');
  }

  if (typeof options.videoUrl !== 'string' || !options.videoUrl) {
    throw new ValidationError('Video URL must be a non-empty string');
  }

  // Validate URLs
  const isValidUrl = (url: string): boolean => {
    const isAbsoluteUrl =
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:');
    return !isAbsoluteUrl || validateUrl(url);
  };

  if (!isValidUrl(options.thumbnailUrl)) {
    throw new ValidationError(`Invalid thumbnail URL: ${options.thumbnailUrl}`);
  }

  if (!isValidUrl(options.videoUrl)) {
    throw new ValidationError(`Invalid video URL: ${options.videoUrl}`);
  }

  // Validate title URL if provided
  if (options.titleUrl && !isValidUrl(options.titleUrl)) {
    throw new ValidationError(`Invalid title URL: ${options.titleUrl}`);
  }

  // Validate provider icon URL if provided
  if (options.providerIconUrl && !isValidUrl(options.providerIconUrl)) {
    throw new ValidationError(
      `Invalid provider icon URL: ${options.providerIconUrl}`
    );
  }

  return {
    type: 'video',
    alt_text: safeTruncate(options.altText, MAX_IMAGE_ALT_TEXT_LENGTH),
    title: {
      type: 'plain_text',
      text: safeTruncate(options.title, MAX_VIDEO_TITLE_LENGTH),
      emoji: true,
    },
    thumbnail_url: options.thumbnailUrl,
    video_url: options.videoUrl,
    author_name: options.authorName
      ? safeTruncate(options.authorName, MAX_VIDEO_AUTHOR_NAME_LENGTH)
      : undefined,
    description: options.description
      ? {
          type: 'plain_text',
          text: safeTruncate(options.description, MAX_VIDEO_DESCRIPTION_LENGTH),
          emoji: true,
        }
      : undefined,
    provider_icon_url: options.providerIconUrl,
    provider_name: options.providerName,
    title_url: options.titleUrl,
  };
}

export function file(externalId: string): FileBlock {
  if (typeof externalId !== 'string' || !externalId) {
    throw new ValidationError('File external_id must be a non-empty string');
  }

  return {
    type: 'file',
    external_id: externalId,
    source: 'remote',
  };
}

export function richTextList(
  items: RichTextElement[],
  style: 'bullet' | 'ordered' = 'bullet',
  indent = 0
): RichTextBlock {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Rich text list must have at least one item');
  }

  return {
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_list',
        style,
        indent,
        elements: items,
      },
    ],
  };
}

export function richTextCode(code: string): RichTextBlock {
  if (typeof code !== 'string') {
    throw new ValidationError(
      `Code text must be a string, received ${typeof code}`
    );
  }

  return {
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_preformatted',
        elements: [
          {
            type: 'text',
            text: code,
          },
        ],
      },
    ],
  };
}

export function richTextQuote(
  elements: RichTextSectionElement[]
): RichTextBlock {
  if (!Array.isArray(elements) || elements.length === 0) {
    throw new ValidationError('Rich text quote must have at least one element');
  }

  return {
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_quote',
        elements,
      },
    ],
  };
}

const MAX_TABLE_ROWS = 100;
const MAX_TABLE_CELLS_PER_ROW = 20;
const MAX_COLUMN_SETTINGS = 20;

export function table(
  rows: TableRow[],
  columnSettings?: ColumnSetting[]
): TableBlock {
  if (!Array.isArray(rows)) {
    throw new ValidationError('Table rows must be an array');
  }

  if (rows.length === 0) {
    throw new ValidationError('Table must have at least one row');
  }

  if (rows.length > MAX_TABLE_ROWS) {
    throw new ValidationError(
      `Table cannot have more than ${MAX_TABLE_ROWS} rows`
    );
  }

  // Validate each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) {
      throw new ValidationError(`Table row ${i} must be an array`);
    }
    if (row.length > MAX_TABLE_CELLS_PER_ROW) {
      throw new ValidationError(
        `Table row ${i} cannot have more than ${MAX_TABLE_CELLS_PER_ROW} cells`
      );
    }
    // Validate each cell
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (!cell || typeof cell !== 'object') {
        throw new ValidationError(
          `Table cell at row ${i}, column ${j} must be an object`
        );
      }
      if (cell.type !== 'raw_text' && cell.type !== 'rich_text') {
        throw new ValidationError(
          `Table cell at row ${i}, column ${j} must have type 'raw_text' or 'rich_text'`
        );
      }
      if (cell.type === 'raw_text' && typeof cell.text !== 'string') {
        throw new ValidationError(
          `Table cell at row ${i}, column ${j} with type 'raw_text' must have a text property`
        );
      }
      if (cell.type === 'rich_text' && !Array.isArray(cell.elements)) {
        throw new ValidationError(
          `Table cell at row ${i}, column ${j} with type 'rich_text' must have an elements array`
        );
      }
    }
  }

  // Validate column settings if provided
  if (columnSettings) {
    if (!Array.isArray(columnSettings)) {
      throw new ValidationError('Column settings must be an array');
    }
    if (columnSettings.length > MAX_COLUMN_SETTINGS) {
      throw new ValidationError(
        `Cannot have more than ${MAX_COLUMN_SETTINGS} column settings`
      );
    }
    for (const setting of columnSettings) {
      if (
        setting &&
        setting.align &&
        !['left', 'center', 'right'].includes(setting.align)
      ) {
        throw new ValidationError(
          'Column alignment must be left, center, or right'
        );
      }
    }
  }

  return {
    type: 'table',
    rows,
    column_settings: columnSettings,
  };
}

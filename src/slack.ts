import type {
  DividerBlock,
  HeaderBlock,
  ImageBlock,
  SectionBlock,
} from '@slack/types';
import {safeTruncate, validateUrl} from './validation';
import {ValidationError} from './errors';

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

const MAX_TEXT_LENGTH = 3000;
const MAX_HEADER_LENGTH = 150;
const MAX_IMAGE_TITLE_LENGTH = 2000;
const MAX_IMAGE_ALT_TEXT_LENGTH = 2000;

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

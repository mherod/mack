/**
 * Input validation and sanitization utilities
 */

import {ValidationError} from './errors';

const MAX_INPUT_SIZE = 1_000_000; // 1MB limit
const MAX_RECURSION_DEPTH = 50;
const BLOCK_LIMIT = 50;

/**
 * Validates markdown input before parsing
 */
export function validateInput(input: string | null | undefined): void {
  if (input === null || input === undefined) {
    throw new ValidationError('Input cannot be null or undefined');
  }

  if (typeof input !== 'string') {
    throw new ValidationError(
      `Expected string input, received ${typeof input}`
    );
  }

  if (input.length === 0) {
    throw new ValidationError('Input cannot be empty');
  }

  if (input.length > MAX_INPUT_SIZE) {
    throw new ValidationError(
      `Input size ${input.length} exceeds maximum of ${MAX_INPUT_SIZE} bytes`
    );
  }
}

/**
 * Validates a URL is safe to use
 */
export function validateUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string' || url.length === 0) {
    return false;
  }

  // Check for common protocols or absolute/relative paths
  // Allow data: URLs only if they're images
  if (url.startsWith('data:')) {
    return url.startsWith('data:image/');
  }

  // Allow relative URLs
  if (url.startsWith('/') || url.startsWith('.')) {
    return true;
  }

  // Validate absolute URLs using regex to avoid Node version issues
  // Must have valid host part (at least one character after //)
  const httpRegex = /^https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+$/;
  if (!httpRegex.test(url)) {
    return false;
  }

  return true;
}

/**
 * Validates block count against Slack's limits
 */
export function validateBlockCount(
  blockCount: number,
  maxBlocks: number = BLOCK_LIMIT
): void {
  if (blockCount > maxBlocks) {
    throw new ValidationError(
      `Block count ${blockCount} exceeds maximum of ${maxBlocks} blocks`
    );
  }
}

/**
 * Checks recursion depth to prevent stack overflow
 */
export function validateRecursionDepth(depth: number): void {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new ValidationError(
      `Recursion depth ${depth} exceeds maximum of ${MAX_RECURSION_DEPTH}`
    );
  }
}

/**
 * Safely truncates text while respecting character boundaries
 */
export function safeTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Truncate at max length
  let truncated = text.slice(0, maxLength);

  // Check if we're in the middle of a multi-byte character (UTF-16 surrogate pair)
  // This is a safety measure for emoji and other multi-byte characters
  const lastChar = truncated.charCodeAt(truncated.length - 1);
  if (lastChar >= 0xd800 && lastChar <= 0xdbff) {
    // High surrogate without low surrogate - remove it
    truncated = truncated.slice(0, -1);
  }

  return truncated;
}

/**
 * Validates mrkdwn formatting to ensure it won't break Slack rendering
 */
export function validateMrkdwn(text: string): void {
  // Check for unmatched formatting markers
  const markers = ['*', '_', '~', '`'];

  for (const marker of markers) {
    const count = (text.match(new RegExp(`\\${marker}`, 'g')) || []).length;
    // Count should be even (matched pairs), except for single backticks which can be single
    if (marker !== '`' && count % 2 !== 0) {
      // Warn but don't throw - Slack may handle it gracefully
      console.warn(
        `Potential unmatched formatting marker "${marker}" in: ${text.slice(
          0,
          50
        )}`
      );
    }
  }
}

/**
 * Configuration for secure XML parsing
 */
export const SECURE_XML_CONFIG = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  // Security settings to prevent XXE and other attacks
  isArray: () => false,
  processEntities: false,
  htmlEntities: true,
  ignoreDeclaration: true,
  ignoreNameSpace: true,
  parseAttributeValue: false,
  cdataTagName: false,
  cdataValue: false,
};

export const MAX_BLOCKS = BLOCK_LIMIT;
export const MAX_INPUT_SIZE_BYTES = MAX_INPUT_SIZE;
export const MAX_RECURSION = MAX_RECURSION_DEPTH;

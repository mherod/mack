/**
 * Custom error types for Mack parser
 */

export class MackError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'MackError';
    Object.setPrototypeOf(this, MackError.prototype);
  }
}

export class ValidationError extends MackError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ParseError extends MackError {
  constructor(message: string, public readonly tokenType?: string) {
    super(message, 'PARSE_ERROR');
    this.name = 'ParseError';
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

export class BlockLimitError extends MackError {
  constructor(
    public readonly blockCount: number,
    public readonly maxBlocks: number
  ) {
    super(
      `Block limit exceeded: ${blockCount} blocks exceeds maximum of ${maxBlocks}`,
      'BLOCK_LIMIT_EXCEEDED'
    );
    this.name = 'BlockLimitError';
    Object.setPrototypeOf(this, BlockLimitError.prototype);
  }
}

export class SecurityError extends MackError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
    Object.setPrototypeOf(this, SecurityError.prototype);
  }
}

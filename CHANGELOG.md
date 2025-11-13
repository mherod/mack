# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2025-11-13

### Added

**Native Slack Block Support**
- Lists now render using Slack's `rich_text_list` format with proper visual structure
- Code blocks use `rich_text_preformatted` for improved syntax presentation
- Blockquotes converted to `rich_text_quote` for cleaner formatting
- Checkbox lists display with tick (✅) and empty box (☐) emoji indicators
- Inline formatting (bold, italic, code) preserved within list items and quotes

**Media and File Handling**
- Video block support for embedding media content
- Automatic file attachment detection based on file extensions
- File links converted to native Slack file blocks

**Table Rendering**
- Native Slack table blocks for both Markdown and HTML tables
- Column alignment support (left, centre, right)
- Rich text formatting within table cells
- HTML table parsing with graceful handling of malformed markup

### Changed

**Breaking Changes**
- List rendering now outputs `rich_text` blocks instead of section blocks with markdown text
- Blockquote rendering uses `rich_text_quote` for simple quotes (maintains backward compatibility for complex quotes)
- Package renamed to `@mherod/mack` namespace
- Build output relocated from `/build/src` to `/lib`

**Build System**
- Migrated from TypeScript compiler to tsup for faster builds
- Dual-package support (CommonJS and ESM)

### Fixed

- Nested list rendering now processes all content correctly
- Blockquotes support multiple content types (lists, code, headings)
- Character escaping limited to Slack requirements (&, <, >)
- Horizontal rule placement no longer affects adjacent list formatting
- Markdown parsing API updated to current marked library standards

### Technical Improvements

- Comprehensive error handling with custom error classes
- Input validation and URL verification
- UTF-8 aware text truncation
- Recursion depth protection
- XML parsing security (XXE protection)
- 223 test cases with comprehensive coverage
- TypeScript strict mode compliance

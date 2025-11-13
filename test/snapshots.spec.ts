import {markdownToBlocks} from '../src';
import type {KnownBlock} from '@slack/types';
import type {
  TableBlock,
  VideoBlock,
  FileBlock,
  RichTextBlock,
} from '../src/slack';

type SlackBlock =
  | KnownBlock
  | TableBlock
  | VideoBlock
  | FileBlock
  | RichTextBlock;

/**
 * Helper to generate a Slack Block Kit Builder URL for easy testing
 * @param blocks - The blocks to preview
 * @returns URL to Block Kit Builder with the blocks pre-loaded
 */
function getBlockKitBuilderUrl(blocks: SlackBlock[]): string {
  const payload = JSON.stringify({blocks});
  const encoded = encodeURIComponent(payload);
  return `https://app.slack.com/block-kit-builder/#${encoded}`;
}

/**
 * Custom serializer that outputs clean JSON for easy copying to Block Kit Builder
 */
function serializeBlocks(blocks: SlackBlock[]): string {
  const payload = {blocks};
  const json = JSON.stringify(payload, null, 2);
  const url = getBlockKitBuilderUrl(blocks);
  return `${json}\n\n// Block Kit Builder URL:\n// ${url}`;
}

describe('Snapshot Tests', () => {
  describe('Basic Formatting', () => {
    it('should render bold, italic, and strikethrough', async () => {
      const markdown = '**bold text** and _italic text_ and ~strikethrough~';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render inline code', async () => {
      const markdown = 'This is `inline code` in a sentence';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render combined formatting', async () => {
      const markdown =
        '**bold with _italic_ inside** and _italic with **bold** inside_';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Headings', () => {
    it('should render h1 heading', async () => {
      const markdown = '# Main Title';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render h2 heading', async () => {
      const markdown = '## Section Title';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render h3 heading', async () => {
      const markdown = '### Subsection';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render multiple headings', async () => {
      const markdown = '# Title\n\n## Subtitle\n\n### Details';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Links', () => {
    it('should render simple link', async () => {
      const markdown = 'Check out [Google](https://google.com)';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render multiple links', async () => {
      const markdown =
        'Visit [Google](https://google.com) or [GitHub](https://github.com)';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render link with formatting', async () => {
      const markdown = 'Check out [**bold link**](https://example.com)';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Lists', () => {
    it('should render unordered list', async () => {
      const markdown = '- First item\n- Second item\n- Third item';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render ordered list', async () => {
      const markdown = '1. First step\n2. Second step\n3. Third step';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render task list', async () => {
      const markdown =
        '- [ ] Incomplete task\n- [x] Completed task\n- [ ] Another task';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render nested lists', async () => {
      const markdown =
        '- Level 1\n  - Level 2\n    - Level 3\n  - Back to 2\n- Back to 1';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render list with formatting', async () => {
      const markdown = '- **Bold** item\n- _Italic_ item\n- `Code` item';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Code Blocks', () => {
    it('should render simple code block', async () => {
      const markdown =
        '```\nfunction hello() {\n  console.log("world");\n}\n```';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render code block with language', async () => {
      const markdown =
        '```javascript\nfunction hello() {\n  console.log("world");\n}\n```';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render code block with TypeScript', async () => {
      const markdown =
        '```typescript\ninterface User {\n  name: string;\n  age: number;\n}\n```';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Block Quotes', () => {
    it('should render simple blockquote', async () => {
      const markdown = '> This is a quote';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render multi-line blockquote', async () => {
      const markdown = '> First line\n> Second line\n> Third line';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render blockquote with formatting', async () => {
      const markdown = '> **Bold quote** with _italic_ text';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render nested blockquote content', async () => {
      const markdown = '> Quote with list:\n> - Item 1\n> - Item 2';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Images', () => {
    it('should render image', async () => {
      const markdown = '![Alt text](https://example.com/image.png)';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render HTML image', async () => {
      const markdown =
        '<img src="https://example.com/image.png" alt="Alt text"/>';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Tables', () => {
    it('should render simple table', async () => {
      const markdown =
        '| Name | Age |\n|------|-----|\n| John | 30  |\n| Jane | 25  |';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render table with alignment', async () => {
      const markdown =
        '| Left | Center | Right |\n|:-----|:------:|------:|\n| A    | B      | C     |';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render table with formatting', async () => {
      const markdown =
        '| Name | Status |\n|------|--------|\n| **Bold** | _Italic_ |\n| `Code` | [Link](https://example.com) |';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Horizontal Rules', () => {
    it('should render horizontal rule', async () => {
      const markdown = 'Above\n\n---\n\nBelow';
      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });

  describe('Complex Documents', () => {
    it('should render complete document', async () => {
      const markdown = `# Project Update

## Overview

We've made significant progress on the **Q4 roadmap**.

### Completed Items

- [x] Feature A
- [x] Feature B
- [ ] Feature C (in progress)

### Code Example

\`\`\`typescript
const result = await api.fetch();
\`\`\`

### Team Members

| Name | Role | Status |
|------|------|--------|
| **Alice** | Lead | Active |
| **Bob** | Dev | Active |

> Remember: Ship early, ship often!

More details at [our wiki](https://example.com/wiki).`;

      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render announcement', async () => {
      const markdown = `# 🎉 New Release v2.0

We're excited to announce **version 2.0** is now available!

## What's New

- Improved performance
- Better error handling
- New API endpoints

Try it out: [Download Now](https://example.com/download)`;

      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });

    it('should render bug report', async () => {
      const markdown = `## Bug Report

**Issue:** Login button not working

**Steps to Reproduce:**
1. Navigate to login page
2. Enter credentials
3. Click login button

**Expected:** User logs in
**Actual:** Nothing happens

\`\`\`javascript
// Console error:
TypeError: Cannot read property 'user'
\`\`\`

Priority: **HIGH**`;

      const blocks = await markdownToBlocks(markdown);
      expect(serializeBlocks(blocks)).toMatchSnapshot();
    });
  });
});

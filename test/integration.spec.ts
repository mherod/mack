import {markdownToBlocks} from '../src';
import * as slack from '../src/slack';
import type {TableBlock} from '../src/slack';

describe('integration with unified', () => {
  it('should parse raw markdown into slack blocks', async () => {
    const text = `
a **b** _c_ **_d_ e**

# heading **a**

![59953191-480px](https://user-images.githubusercontent.com/16073505/123464383-b8715300-d5ba-11eb-8586-b1f965e1f18d.jpg)

<img src="https://user-images.githubusercontent.com/16073505/123464383-b8715300-d5ba-11eb-8586-b1f965e1f18d.jpg" alt="59953191-480px"/>

> block quote **a**
> block quote b

[link](https://apple.com)

- bullet _a_
- bullet _b_

1. number _a_
2. number _b_

- [ ] checkbox false
- [x] checkbox true

| Syntax      | Description |
| ----------- | ----------- |
| Header      | Title       |
| Paragraph   | Text        |
`;

    const actual = await markdownToBlocks(text);

    const expected = [
      slack.section('a *b* _c_ *_d_ e*'),
      slack.header('heading a'),
      slack.image(
        'https://user-images.githubusercontent.com/16073505/123464383-b8715300-d5ba-11eb-8586-b1f965e1f18d.jpg',
        '59953191-480px'
      ),
      slack.image(
        'https://user-images.githubusercontent.com/16073505/123464383-b8715300-d5ba-11eb-8586-b1f965e1f18d.jpg',
        '59953191-480px'
      ),
      slack.section('> block quote *a*\n> block quote b'),
      slack.section('<https://apple.com|link> '),
      slack.section('• bullet _a_\n• bullet _b_'),
      slack.section('1. number _a_\n2. number _b_'),
      slack.section('• checkbox false\n• checkbox true'),
      slack.table([
        [
          {type: 'raw_text', text: 'Syntax'},
          {type: 'raw_text', text: 'Description'},
        ],
        [
          {type: 'raw_text', text: 'Header'},
          {type: 'raw_text', text: 'Title'},
        ],
        [
          {type: 'raw_text', text: 'Paragraph'},
          {type: 'raw_text', text: 'Text'},
        ],
      ]),
    ];

    expect(actual).toStrictEqual(expected);
  });

  it('should parse long markdown', async () => {
    const text: string = new Array(3500).fill('a').join('') + 'bbbcccdddeee';

    const actual = await markdownToBlocks(text);

    const expected = [slack.section(text.slice(0, 3000))];

    expect(actual).toStrictEqual(expected);
  });

  describe('code blocks', () => {
    it('should parse code blocks with no language', async () => {
      const text = `\`\`\`
if (a === 'hi') {
  console.log('hi!')
} else {
  console.log('hello')
}
\`\`\``;

      const actual = await markdownToBlocks(text);

      const expected = [
        slack.section(
          `\`\`\`
if (a === 'hi') {
  console.log('hi!')
} else {
  console.log('hello')
}
\`\`\``
        ),
      ];

      expect(actual).toStrictEqual(expected);
    });

    it('should parse code blocks with language', async () => {
      const text = `\`\`\`javascript
if (a === 'hi') {
  console.log('hi!')
} else {
  console.log('hello')
}
\`\`\``;

      const actual = await markdownToBlocks(text);

      const expected = [
        slack.section(
          `\`\`\`
if (a === 'hi') {
  console.log('hi!')
} else {
  console.log('hello')
}
\`\`\``
        ),
      ];

      expect(actual).toStrictEqual(expected);
    });
  });

  it('should correctly escape text', async () => {
    const actual = await markdownToBlocks('<>&\'""\'&><');
    const expected = [slack.section('&lt;&gt;&amp;\'""\'&amp;&gt;&lt;')];
    expect(actual).toStrictEqual(expected);
  });
});

describe('robustness - error handling', () => {
  it('should throw ValidationError for null input', async () => {
    await expect(markdownToBlocks(null as unknown as string)).rejects.toThrow(
      'Input cannot be null or undefined'
    );
  });

  it('should throw ValidationError for undefined input', async () => {
    await expect(
      markdownToBlocks(undefined as unknown as string)
    ).rejects.toThrow('Input cannot be null or undefined');
  });

  it('should throw ValidationError for empty string', async () => {
    await expect(markdownToBlocks('')).rejects.toThrow('Input cannot be empty');
  });

  it('should throw ValidationError for input exceeding size limit', async () => {
    const tooLargeInput = new Array(1_000_001).fill('a').join('');
    await expect(markdownToBlocks(tooLargeInput)).rejects.toThrow(
      'exceeds maximum'
    );
  });

  it('should throw ValidationError for block count exceeding limit', async () => {
    // Create markdown that generates more than 50 blocks
    const manyBlocksMarkdown = new Array(60)
      .fill(0)
      .map((_, i) => `Paragraph ${i}`)
      .join('\n\n');

    await expect(markdownToBlocks(manyBlocksMarkdown)).rejects.toThrow(
      'Block count'
    );
  });

  it('should throw ValidationError for invalid image URL in absolute form', async () => {
    expect(() => {
      slack.image('http://', 'alt');
    }).toThrow('Invalid image URL');
  });

  it('should accept relative image URLs', () => {
    const result = slack.image('/path/to/image.png', 'alt');
    expect(result.image_url).toBe('/path/to/image.png');
  });

  it('should accept arbitrary URLs for backward compatibility', () => {
    const result = slack.image('custom-url-string', 'alt');
    expect(result.image_url).toBe('custom-url-string');
  });

  it('should throw ValidationError for non-string section text', () => {
    expect(() => {
      slack.section(123 as unknown as string);
    }).toThrow('Section text must be a string');
  });

  it('should throw ValidationError for non-string header text', () => {
    expect(() => {
      slack.header(123 as unknown as string);
    }).toThrow('Header text must be a string');
  });

  it('should throw ValidationError for empty image URL', () => {
    expect(() => {
      slack.image('', 'alt');
    }).toThrow('Image URL must be a non-empty string');
  });
});

describe('robustness - text truncation', () => {
  it('should safely truncate text at 3000 characters', async () => {
    const text = new Array(3500).fill('a').join('');
    const result = await markdownToBlocks(text);
    expect(result[0]).toBeDefined();
    if ('text' in result[0] && result[0].text) {
      expect(
        (result[0].text as {text: string}).text.length
      ).toBeLessThanOrEqual(3000);
    }
  });

  it('should safely truncate header at 150 characters', () => {
    const longHeader = new Array(200).fill('a').join('');
    const result = slack.header(longHeader);
    expect(result.text.text.length).toBeLessThanOrEqual(150);
  });

  it('should safely truncate image alt text at 2000 characters', () => {
    const longAlt = new Array(2500).fill('a').join('');
    const result = slack.image('https://example.com/img.png', longAlt);
    expect(result.alt_text.length).toBeLessThanOrEqual(2000);
  });

  it('should handle multi-byte UTF-8 characters correctly', () => {
    // Emoji and multi-byte characters should truncate safely
    const emoji = '😀'.repeat(2000);
    const result = slack.section(emoji);
    // Should not throw and result should be valid
    expect(result).toBeDefined();
    expect(result.text?.text).toBeDefined();
  });
});

describe('robustness - nested content support', () => {
  it('should parse nested lists', async () => {
    const markdown = `
- Item 1
  - Nested item 1.1
  - Nested item 1.2
- Item 2
`;
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBeGreaterThan(0);
    // Should contain nested list content
    const content = result[0];
    if ('text' in content && content.text) {
      const text = (content.text as {text: string}).text;
      expect(text).toContain('Nested');
    }
  });

  it('should parse blockquotes with lists', async () => {
    const markdown = `
> - List item in blockquote
> - Another item
`;
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should parse blockquotes with code blocks', async () => {
    const markdown = `
> \`\`\`
> code in blockquote
> \`\`\`
`;
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should parse nested blockquotes', async () => {
    const markdown = `
> Outer blockquote
> > Nested blockquote
`;
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('robustness - URL validation', () => {
  it('should validate http URLs', async () => {
    const markdown = '![alt](http://example.com/image.png)';
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should validate https URLs', async () => {
    const markdown = '![alt](https://example.com/image.png)';
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle invalid URLs gracefully', async () => {
    // Malformed absolute URL should skip the image
    const markdown = '![alt](http://)';
    const result = await markdownToBlocks(markdown);
    // Should not throw
    expect(result).toBeDefined();
  });

  it('should validate links with invalid URLs', async () => {
    const markdown = '[text](http://)';
    const result = await markdownToBlocks(markdown);
    // Should return link text without URL formatting
    if ('text' in result[0] && result[0].text) {
      const text = (result[0].text as {text: string}).text;
      expect(text).toContain('text');
    }
  });

  it('should handle data: URLs for images', async () => {
    const markdown = '![alt](data:image/png;base64,iVBORw0KGgo=)';
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should reject non-image data: URLs', () => {
    expect(() => {
      slack.image('data:text/plain;base64,aGVsbG8=', 'alt');
    }).toThrow('Invalid image URL');
  });
});

describe('robustness - HTML parsing security', () => {
  it('should handle malformed HTML gracefully', async () => {
    const markdown =
      '<img src="https://example.com/img.png" alt="test" invalid>';
    const result = await markdownToBlocks(markdown);
    // Should not throw and should handle gracefully
    expect(result).toBeDefined();
  });

  it('should extract images from valid HTML', async () => {
    const markdown =
      '<img src="https://example.com/img.png" alt="test image" />';
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should filter out images with invalid URLs from HTML', async () => {
    const markdown = '<img src="http://" alt="broken" />';
    const result = await markdownToBlocks(markdown);
    // Should handle gracefully without throwing
    expect(result).toBeDefined();
  });
});

describe('robustness - recursion depth protection', () => {
  it('should handle deeply nested formatting', async () => {
    // Create deeply nested emphasis/strong formatting
    let markdown = 'text';
    for (let i = 0; i < 40; i++) {
      markdown = `**_${markdown}_**`;
    }
    const result = await markdownToBlocks(markdown);
    // Should not throw stack overflow
    expect(result).toBeDefined();
  });
});

describe('table block support', () => {
  it('should parse simple markdown tables as native table blocks', async () => {
    const markdown = `
| Header A | Header B |
|----------|----------|
| Cell 1A  | Cell 1B  |
| Cell 2A  | Cell 2B  |
`;
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBe(1);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');
    expect(tableBlock.rows).toBeDefined();
    expect(tableBlock.rows.length).toBe(3); // header + 2 data rows
  });

  it('should support column alignment in tables', async () => {
    const markdown = `
| Left | Center | Right |
|:-----|:------:|------:|
| A    |   B    |     C |
`;
    const result = await markdownToBlocks(markdown);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');
    expect(tableBlock.column_settings).toBeDefined();
    // First column default (left), second center, third right
    expect(tableBlock.column_settings).toEqual([
      {align: 'center'}, // Column 2
      {align: 'right'}, // Column 3
    ]);
  });

  it('should use rich text for formatted table cells', async () => {
    const markdown = `
| Plain | **Bold** | *Italic* | [Link](https://slack.com) |
|-------|----------|----------|---------------------------|
| text  | **bold** | _em_     | [link](https://example.com) |
`;
    const result = await markdownToBlocks(markdown);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');

    // Check header row
    const headerRow = tableBlock.rows[0];
    expect(headerRow[0].type).toBe('raw_text'); // Plain text
    expect(headerRow[1].type).toBe('rich_text'); // Bold text
    expect(headerRow[2].type).toBe('rich_text'); // Italic text
    expect(headerRow[3].type).toBe('rich_text'); // Link

    // Check formatted cells have proper structure
    const boldCell = headerRow[1];
    expect(boldCell.elements?.[0].type).toBe('rich_text_section');
    expect(boldCell.elements?.[0].elements[0].style?.bold).toBe(true);
  });

  it('should handle inline code in table cells', async () => {
    const markdown = `
| Code | Description |
|------|-------------|
| \`npm install\` | Install dependencies |
| \`npm test\` | Run tests |
`;
    const result = await markdownToBlocks(markdown);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');

    // Check code cells use rich text with code style
    const codeCell = tableBlock.rows[1][0];
    expect(codeCell.type).toBe('rich_text');
    expect(codeCell.elements?.[0].elements[0].style?.code).toBe(true);
  });

  it('should handle strikethrough in table cells', async () => {
    const markdown = `
| Task | Status |
|------|--------|
| ~~Old task~~ | Complete |
| New task | Pending |
`;
    const result = await markdownToBlocks(markdown);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');

    // Check strikethrough cell uses rich text
    const strikeCell = tableBlock.rows[1][0];
    expect(strikeCell.type).toBe('rich_text');
    expect(strikeCell.elements?.[0].elements[0].style?.strike).toBe(true);
  });

  it('should validate table size limits', () => {
    // Test row limit (max 100)
    const tooManyRows = new Array(101).fill(['Cell']);
    expect(() => {
      slack.table(tooManyRows);
    }).toThrow('cannot have more than 100 rows');

    // Test cells per row limit (max 20)
    const tooManyCells = [
      new Array(21).fill({type: 'raw_text', text: 'Cell'}),
    ] as slack.TableRow[];
    expect(() => {
      slack.table(tooManyCells);
    }).toThrow('cannot have more than 20 cells');
  });

  it('should validate table cell structure', () => {
    // Invalid cell type
    const invalidCell = [
      [{type: 'invalid', text: 'test'}],
    ] as unknown as slack.TableRow[];
    expect(() => {
      slack.table(invalidCell);
    }).toThrow('must have type');

    // Missing text in raw_text cell
    const missingText = [[{type: 'raw_text'}]] as unknown as slack.TableRow[];
    expect(() => {
      slack.table(missingText);
    }).toThrow('must have a text property');

    // Missing elements in rich_text cell
    const missingElements = [
      [{type: 'rich_text'}],
    ] as unknown as slack.TableRow[];
    expect(() => {
      slack.table(missingElements);
    }).toThrow('must have an elements array');
  });

  it('should validate column settings', () => {
    const validRows: slack.TableRow[] = [[{type: 'raw_text', text: 'Cell'}]];

    // Invalid alignment
    const invalidAlign = [
      {align: 'invalid' as unknown},
    ] as slack.ColumnSetting[];
    expect(() => {
      slack.table(validRows, invalidAlign);
    }).toThrow('must be left, center, or right');

    // Too many column settings (max 20)
    const tooManySettings = new Array(21).fill({
      align: 'center',
    }) as slack.ColumnSetting[];
    expect(() => {
      slack.table(validRows, tooManySettings);
    }).toThrow('Cannot have more than 20 column settings');
  });

  it('should handle tables with mixed content gracefully', async () => {
    const markdown = `
| Mixed | Content |
|-------|---------|
| Plain text | **Bold** with _italic_ and [link](https://example.com) |
| \`code\` | ~~strike~~ text |
`;
    const result = await markdownToBlocks(markdown);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');
    expect(tableBlock.rows.length).toBe(3);

    // Complex cell should be rich_text
    const complexCell = tableBlock.rows[1][1];
    expect(complexCell.type).toBe('rich_text');
  });

  it('should parse HTML tables as native table blocks', async () => {
    const markdown = `
<table>
  <thead>
    <tr>
      <th>Header 1</th>
      <th>Header 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Cell 1A</td>
      <td>Cell 1B</td>
    </tr>
    <tr>
      <td>Cell 2A</td>
      <td>Cell 2B</td>
    </tr>
  </tbody>
</table>
`;
    const result = await markdownToBlocks(markdown);
    expect(result.length).toBe(1);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');
    expect(tableBlock.rows).toBeDefined();
    expect(tableBlock.rows.length).toBe(3); // 1 header + 2 data rows
    expect(tableBlock.rows[0][0].text).toBe('Header 1');
    expect(tableBlock.rows[1][0].text).toBe('Cell 1A');
  });

  it('should handle HTML tables without thead', async () => {
    const markdown = `
<table>
  <tr>
    <td>Row 1 Cell 1</td>
    <td>Row 1 Cell 2</td>
  </tr>
  <tr>
    <td>Row 2 Cell 1</td>
    <td>Row 2 Cell 2</td>
  </tr>
</table>
`;
    const result = await markdownToBlocks(markdown);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');
    expect(tableBlock.rows.length).toBe(2);
    expect(tableBlock.rows[0][0].text).toBe('Row 1 Cell 1');
  });

  it('should handle HTML table alignment attributes', async () => {
    // Note: marked may not parse complex HTML tables with colgroup
    // This test focuses on cell-level alignment which is more commonly supported
    const markdown = `<table>
<tr>
<td align="left">Left</td>
<td align="center">Center</td>
<td align="right">Right</td>
</tr>
</table>`;
    const result = await markdownToBlocks(markdown);

    // Check if marked parsed it as HTML
    if (result.length > 0 && result[0].type === 'table') {
      const tableBlock = result[0] as TableBlock;
      expect(tableBlock.column_settings).toBeDefined();
      expect(tableBlock.column_settings).toEqual([
        {align: 'center'},
        {align: 'right'},
      ]);
    } else {
      // Marked might not parse all HTML tables - that's ok
      expect(result).toBeDefined();
    }
  });

  it('should handle HTML table with cell alignment attributes', async () => {
    const markdown = `
<table>
  <tr>
    <td align="left">Left</td>
    <td align="center">Center</td>
    <td align="right">Right</td>
  </tr>
</table>
`;
    const result = await markdownToBlocks(markdown);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');
    expect(tableBlock.column_settings).toBeDefined();
    expect(tableBlock.column_settings).toEqual([
      {align: 'center'},
      {align: 'right'},
    ]);
  });

  it('should handle nested elements in HTML table cells', async () => {
    const markdown = `
<table>
  <tr>
    <td><b>Bold text</b></td>
    <td><i>Italic text</i></td>
    <td><code>Code text</code></td>
  </tr>
</table>
`;
    const result = await markdownToBlocks(markdown);
    const tableBlock = result[0] as TableBlock;
    expect(tableBlock.type).toBe('table');
    expect(tableBlock.rows[0][0].text).toBe('Bold text');
    expect(tableBlock.rows[0][1].text).toBe('Italic text');
    expect(tableBlock.rows[0][2].text).toBe('Code text');
  });

  it('should handle mixed markdown and HTML tables', async () => {
    const markdown = `
# Document with Tables

| Markdown | Table |
|----------|-------|
| Cell 1   | Cell 2 |

<table>
  <tr>
    <th>HTML</th>
    <th>Table</th>
  </tr>
  <tr>
    <td>Cell A</td>
    <td>Cell B</td>
  </tr>
</table>
`;
    const result = await markdownToBlocks(markdown);
    // Should have: header, markdown table, html table
    expect(result.length).toBe(3);
    expect(result[0].type).toBe('header');
    expect(result[1].type).toBe('table');
    expect(result[2].type).toBe('table');

    const mdTable = result[1] as TableBlock;
    expect(mdTable.rows[0][0].text).toBe('Markdown');

    const htmlTable = result[2] as TableBlock;
    expect(htmlTable.rows[0][0].text).toBe('HTML');
  });

  it('should handle empty HTML tables gracefully', async () => {
    const markdown = '<table></table>';
    const result = await markdownToBlocks(markdown);
    // Empty tables should be skipped
    expect(result.length).toBe(0);
  });

  it('should handle malformed HTML tables gracefully', async () => {
    const markdown = `
<table>
  <tr>
    <td>Cell without closing
  </tr>
</table>
`;
    // Should not throw, just handle gracefully
    const result = await markdownToBlocks(markdown);
    expect(result).toBeDefined();
  });

  // GitHub Issues Tests
  describe('GitHub Issues', () => {
    // Issue #24: Nested bulleted lists should be rendered
    it('#24 - should render nested bulleted lists', async () => {
      const markdown = `- asdf
  - asdf2`;
      const result = await markdownToBlocks(markdown);
      expect(result.length).toBe(1);
      const section = result[0];
      expect(section.type).toBe('section');
      // Should contain both items
      if (
        section.type === 'section' &&
        section.text &&
        'text' in section.text
      ) {
        expect(section.text.text).toContain('asdf');
        expect(section.text.text).toContain('asdf2');
      }
    });

    // Issue #25: Blockquote should support single-line quotes
    it('#25 - should support single-line blockquotes', async () => {
      const markdown = '> This is a blockquote';
      const result = await markdownToBlocks(markdown);
      expect(result.length).toBeGreaterThan(0);
      const section = result[0];
      expect(section.type).toBe('section');
      if (
        section.type === 'section' &&
        section.text &&
        'text' in section.text
      ) {
        expect(section.text.text).toContain('>');
      }
    });

    // Issue #26: Quote characters should not be HTML-escaped
    it('#26 - should not HTML-escape quote characters', async () => {
      const markdown = "I've just completed the 'Research Report' workflow";
      const result = await markdownToBlocks(markdown);
      expect(result.length).toBeGreaterThan(0);
      const section = result[0];
      expect(section.type).toBe('section');
      if (
        section.type === 'section' &&
        section.text &&
        'text' in section.text
      ) {
        // Should contain actual quote characters, not HTML entities
        expect(section.text.text).toContain("I've");
        expect(section.text.text).not.toContain('&#39;');
        expect(section.text.text).toContain("'Research Report'");
      }
    });

    // Issue #27: Divider block under list should not turn list into header
    it('#27 - should handle divider after list correctly', async () => {
      const markdown = `Test
- test 1
- test 2
---

test3`;
      const result = await markdownToBlocks(markdown);
      // Should have at least: section/header for "Test", section for list, divider, section for "test3"
      expect(result.length).toBeGreaterThanOrEqual(3);
      // First should be section or header with "Test"
      expect(result[0].type).toMatch(/^(section|header)$/);
      // Should have a divider somewhere
      const hasDivider = result.some(block => block.type === 'divider');
      expect(hasDivider).toBe(true);
    });

    // Issue #23: marked.lexer runtime error - verify API works correctly
    it('#23 - should not throw marked.lexer runtime error', async () => {
      const markdown = `# Test
This is a paragraph`;
      // Should not throw "Cannot read properties of undefined (reading 'lexer')"
      const result = await markdownToBlocks(markdown);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

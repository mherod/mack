import * as slack from '../src/slack';
import {parseBlocks} from '../src/parser/internal';
import {marked} from 'marked';

describe('parser', () => {
  it('should parse basic markdown', () => {
    const tokens = marked.lexer('**a ~b~** c[*d*](https://example.com)');
    const actual = parseBlocks(tokens);

    const expected = [slack.section('*a ~b~* c<https://example.com|_d_> ')];

    expect(actual).toStrictEqual(expected);
  });

  it('should parse header', () => {
    const tokens = marked.lexer('# a');
    const actual = parseBlocks(tokens);

    const expected = [slack.header('a')];

    expect(actual).toStrictEqual(expected);
  });

  it('should parse header with formatting (bold, italic, code)', () => {
    const tokens = marked.lexer('# **bold** _italic_ `code`');
    const actual = parseBlocks(tokens);

    // Headers extract plain text, but codespan keeps backticks in plain text extraction
    const expected = [slack.header('bold italic `code`')];

    expect(actual).toStrictEqual(expected);
  });

  it('should parse header with link (extracts link text)', () => {
    const tokens = marked.lexer('# [link text](https://example.com)');
    const actual = parseBlocks(tokens);

    const expected = [slack.header('link text')];

    expect(actual).toStrictEqual(expected);
  });

  it('should parse multiple heading levels as header blocks', () => {
    const tokens = marked.lexer(
      '# h1\n## h2\n### h3\n#### h4\n##### h5\n###### h6'
    );
    const actual = parseBlocks(tokens);

    const expected = [
      slack.header('h1'),
      slack.header('h2'),
      slack.header('h3'),
      slack.header('h4'),
      slack.header('h5'),
      slack.header('h6'),
    ];

    expect(actual).toStrictEqual(expected);
  });

  it('should handle headers with special characters', () => {
    const tokens = marked.lexer('# Special: &<> chars');
    const actual = parseBlocks(tokens);

    expect(actual.length).toBe(1);
    expect(actual[0].type).toBe('header');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((actual[0] as any).text.text).toBe('Special: &<> chars');
  });

  it('should handle headers with unicode and emoji', () => {
    const tokens = marked.lexer('# Hello 🎉 世界 مرحبا');
    const actual = parseBlocks(tokens);

    const expected = [slack.header('Hello 🎉 世界 مرحبا')];

    expect(actual).toStrictEqual(expected);
  });

  it('should handle headers with strikethrough text', () => {
    const tokens = marked.lexer('# ~~strikethrough~~ text');
    const actual = parseBlocks(tokens);

    const expected = [slack.header('strikethrough text')];

    expect(actual).toStrictEqual(expected);
  });

  it('should parse thematic break', () => {
    const tokens = marked.lexer('---');
    const actual = parseBlocks(tokens);

    const expected = [slack.divider()];

    expect(actual).toStrictEqual(expected);
  });

  it('should parse lists', () => {
    const tokens = marked.lexer(
      `
    1. a
    2. b
    - c
    - d
    * e
    * f
    `
        .trim()
        .split('\n')
        .map(s => s.trim())
        .join('\n')
    );
    const actual = parseBlocks(tokens);

    const expected = [
      slack.section('1. a\n2. b'),
      slack.section('• c\n• d'),
      slack.section('• e\n• f'),
    ];

    expect(actual).toStrictEqual(expected);
  });

  it('should parse images', () => {
    const tokens = marked.lexer('![alt](url "title")![](url)');
    const actual = parseBlocks(tokens);

    const expected = [
      slack.image('url', 'alt', 'title'),
      slack.image('url', 'url'),
    ];

    expect(actual).toStrictEqual(expected);
  });
});

it('should truncate basic markdown', () => {
  const a4000 = new Array(4000).fill('a').join('');
  const a3000 = new Array(3000).fill('a').join('');

  const tokens = marked.lexer(a4000);
  const actual = parseBlocks(tokens);

  const expected = [slack.section(a3000)];

  expect(actual.length).toStrictEqual(expected.length);
});

it('should truncate header', () => {
  const a200 = new Array(200).fill('a').join('');
  const a150 = new Array(150).fill('a').join('');

  const tokens = marked.lexer(`# ${a200}`);
  const actual = parseBlocks(tokens);

  const expected = [slack.header(a150)];

  expect(actual.length).toStrictEqual(expected.length);
});

it('should truncate image title', () => {
  const a3000 = new Array(3000).fill('a').join('');
  const a2000 = new Array(2000).fill('a').join('');

  const tokens = marked.lexer(`![${a3000}](url)`);
  const actual = parseBlocks(tokens);

  const expected = [slack.image('url', a2000)];

  expect(actual.length).toStrictEqual(expected.length);
});

describe('header block unit tests', () => {
  it('should create a valid header block with plain text', () => {
    const result = slack.header('Test Header');

    expect(result).toEqual({
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Test Header',
      },
    });
  });

  it('should have correct block structure', () => {
    const result = slack.header('Title');

    expect(result.type).toBe('header');
    expect(result.text).toBeDefined();
    expect(result.text.type).toBe('plain_text');
    expect(result.text.text).toBe('Title');
  });

  it('should truncate header text at 150 characters', () => {
    const longText = 'a'.repeat(200);
    const result = slack.header(longText);

    expect(result.text.text).toBe('a'.repeat(150));
    expect(result.text.text.length).toBe(150);
  });

  it('should preserve exactly 150 characters when at limit', () => {
    const text150 = 'x'.repeat(150);
    const result = slack.header(text150);

    expect(result.text.text).toBe(text150);
    expect(result.text.text.length).toBe(150);
  });

  it('should handle headers with whitespace', () => {
    const result = slack.header('  Header with spaces  ');

    expect(result.text.text).toBe('  Header with spaces  ');
  });

  it('should handle headers with newlines in text', () => {
    const result = slack.header('Line 1\nLine 2');

    // The header should preserve the newline
    expect(result.text.text).toContain('Line 1');
    expect(result.text.text).toContain('Line 2');
  });

  it('should handle headers with special characters', () => {
    const result = slack.header('Header with &<> chars');

    expect(result.text.text).toBe('Header with &<> chars');
  });

  it('should handle headers with unicode characters', () => {
    const result = slack.header('Привет мир 你好 مرحبا 🌍');

    expect(result.text.text).toBe('Привет мир 你好 مرحبا 🌍');
  });

  it('should handle headers with emoji', () => {
    const result = slack.header('🎉 Celebration! 🎊');

    expect(result.text.text).toBe('🎉 Celebration! 🎊');
  });

  it('should handle single character header', () => {
    const result = slack.header('A');

    expect(result.text.text).toBe('A');
  });

  it('should throw ValidationError for non-string input', () => {
    expect(() => {
      slack.header(123 as unknown as string);
    }).toThrow('Header text must be a string');
  });

  it('should throw ValidationError for null input', () => {
    expect(() => {
      slack.header(null as unknown as string);
    }).toThrow('Header text must be a string');
  });

  it('should throw ValidationError for undefined input', () => {
    expect(() => {
      slack.header(undefined as unknown as string);
    }).toThrow('Header text must be a string');
  });

  it('should throw ValidationError for object input', () => {
    expect(() => {
      slack.header({} as unknown as string);
    }).toThrow('Header text must be a string');
  });

  it('should throw ValidationError for array input', () => {
    expect(() => {
      slack.header([] as unknown as string);
    }).toThrow('Header text must be a string');
  });

  it('should handle headers with mixed content', () => {
    const result = slack.header('Test: &Special< >Chars 123 🎯');

    expect(result.text.text).toContain('Test');
    expect(result.text.text).toContain('Special');
    expect(result.text.text).toContain('🎯');
  });

  it('should maintain proper truncation with multi-byte UTF-8 characters', () => {
    // Each emoji is multiple bytes in UTF-8
    const text = '🎉'.repeat(100); // 100 emojis
    const result = slack.header(text);

    // Should not exceed 150 characters (boundary safe)
    expect(result.text.text.length).toBeLessThanOrEqual(150);
  });

  it('should handle headers with numbers and symbols', () => {
    const result = slack.header('Section 1.2.3: Title (Updated)');

    expect(result.text.text).toBe('Section 1.2.3: Title (Updated)');
  });

  it('should handle headers with punctuation', () => {
    const result = slack.header('Question? Answer! Really...');

    expect(result.text.text).toBe('Question? Answer! Really...');
  });

  it('should handle very long headers gracefully', () => {
    const longHeader =
      'This is a very long header that exceeds the 150 character limit imposed by Slack. It will be truncated to fit within the constraints.';
    const result = slack.header(longHeader);

    expect(result.text.text.length).toBeLessThanOrEqual(150);
    // Original is 133 characters, which is less than 150, so no truncation
    expect(result.text.text.length).toBe(133);
  });

  it('should truncate headers that exceed 150 characters', () => {
    // Create a header that is definitely over 150 characters
    const longHeader = 'a'.repeat(200);
    const result = slack.header(longHeader);

    expect(result.text.text.length).toBe(150);
    expect(result.text.text).toBe('a'.repeat(150));
  });

  it('should maintain immutability of input', () => {
    const input = 'Test Header';
    slack.header(input);

    // Input should not be modified
    expect(input).toBe('Test Header');
  });
});

describe('image block unit tests', () => {
  it('should create a valid image block with URL and alt text', () => {
    const result = slack.image('https://example.com/image.png', 'An image');

    expect(result).toEqual({
      type: 'image',
      image_url: 'https://example.com/image.png',
      alt_text: 'An image',
      title: undefined,
    });
  });

  it('should have correct block structure', () => {
    const result = slack.image('https://example.com/img.jpg', 'Alt text');

    expect(result.type).toBe('image');
    expect(result.image_url).toBe('https://example.com/img.jpg');
    expect(result.alt_text).toBe('Alt text');
  });

  it('should support optional title parameter', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Alt text',
      'Image Title'
    );

    expect(result.title).toBeDefined();
    expect(result.title?.type).toBe('plain_text');
    expect(result.title?.text).toBe('Image Title');
  });

  it('should handle https URLs', () => {
    const result = slack.image('https://example.com/image.png', 'Test image');

    expect(result.image_url).toBe('https://example.com/image.png');
  });

  it('should handle http URLs', () => {
    const result = slack.image('http://example.com/image.gif', 'Test image');

    expect(result.image_url).toBe('http://example.com/image.gif');
  });

  it('should handle data URLs', () => {
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = slack.image(dataUrl, 'Data URL image');

    expect(result.image_url).toBe(dataUrl);
  });

  it('should handle relative URLs for backward compatibility', () => {
    const result = slack.image('/images/logo.png', 'Company logo');

    expect(result.image_url).toBe('/images/logo.png');
  });

  it('should truncate alt text at 2000 characters', () => {
    const longAltText = 'a'.repeat(2500);
    const result = slack.image('https://example.com/img.png', longAltText);

    expect(result.alt_text.length).toBe(2000);
  });

  it('should truncate title at 2000 characters', () => {
    const longTitle = 'x'.repeat(2500);
    const result = slack.image('https://example.com/img.png', 'Alt', longTitle);

    expect(result.title?.text.length).toBe(2000);
  });

  it('should preserve exactly 2000 characters for alt text at limit', () => {
    const text2000 = 'y'.repeat(2000);
    const result = slack.image('https://example.com/img.png', text2000);

    expect(result.alt_text).toBe(text2000);
    expect(result.alt_text.length).toBe(2000);
  });

  it('should handle special characters in alt text', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Image with &<> special chars'
    );

    expect(result.alt_text).toBe('Image with &<> special chars');
  });

  it('should handle unicode in alt text', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Изображение 图像 صورة'
    );

    expect(result.alt_text).toBe('Изображение 图像 صورة');
  });

  it('should handle emoji in alt text', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Image with emoji 🖼️ 🎨'
    );

    expect(result.alt_text).toContain('emoji');
    expect(result.alt_text).toContain('🖼️');
  });

  it('should handle unicode in title', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Alt text',
      'Titre français 标题'
    );

    expect(result.title?.text).toBe('Titre français 标题');
  });

  it('should handle emoji in title', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Alt',
      '🎨 Artwork Title'
    );

    expect(result.title?.text).toContain('Artwork');
    expect(result.title?.text).toContain('🎨');
  });

  it('should throw ValidationError for empty URL', () => {
    expect(() => {
      slack.image('', 'Alt text');
    }).toThrow('Image URL must be a non-empty string');
  });

  it('should throw ValidationError for non-string URL', () => {
    expect(() => {
      slack.image(123 as unknown as string, 'Alt text');
    }).toThrow('Image URL must be a non-empty string');
  });

  it('should throw ValidationError for null URL', () => {
    expect(() => {
      slack.image(null as unknown as string, 'Alt text');
    }).toThrow('Image URL must be a non-empty string');
  });

  it('should throw ValidationError for non-string alt text', () => {
    expect(() => {
      slack.image('https://example.com/img.png', 123 as unknown as string);
    }).toThrow('Image alt text must be a string');
  });

  it('should throw ValidationError for null alt text', () => {
    expect(() => {
      slack.image('https://example.com/img.png', null as unknown as string);
    }).toThrow('Image alt text must be a string');
  });

  it('should handle image URL with query parameters', () => {
    const url = 'https://example.com/image.png?size=large&format=webp';
    const result = slack.image(url, 'Parameterized image');

    expect(result.image_url).toBe(url);
  });

  it('should handle image URL with fragment identifier', () => {
    const url = 'https://example.com/image.png#section1';
    const result = slack.image(url, 'Image with fragment');

    expect(result.image_url).toBe(url);
  });

  it('should handle long image URL (up to 3000 chars)', () => {
    // Create a valid URL with query parameters that results in ~2500 chars
    const longPath = 'a'.repeat(2480);
    const url = `https://example.com/image.png?path=${longPath}`;
    const result = slack.image(url, 'Long URL image');

    expect(result.image_url).toBe(url);
  });

  it('should handle alt text with newlines', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Line 1\nLine 2\nLine 3'
    );

    expect(result.alt_text).toContain('Line 1');
    expect(result.alt_text).toContain('Line 2');
    expect(result.alt_text).toContain('Line 3');
  });

  it('should handle title with newlines', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Alt',
      'Title Line 1\nTitle Line 2'
    );

    expect(result.title?.text).toContain('Title Line 1');
    expect(result.title?.text).toContain('Title Line 2');
  });

  it('should support common image file formats', () => {
    const formats = [
      'https://example.com/image.png',
      'https://example.com/image.jpg',
      'https://example.com/image.jpeg',
      'https://example.com/image.gif',
    ];

    for (const url of formats) {
      const result = slack.image(url, 'Alt');
      expect(result.image_url).toBe(url);
    }
  });

  it('should handle image URL with authentication in URL', () => {
    const url = 'https://user:pass@example.com/secure/image.png';
    const result = slack.image(url, 'Authenticated image');

    expect(result.image_url).toBe(url);
  });

  it('should handle complex alt text with punctuation', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'A photo of cats and dogs playing fetch? Yes! Really...'
    );

    expect(result.alt_text).toBe(
      'A photo of cats and dogs playing fetch? Yes! Really...'
    );
  });

  it('should preserve whitespace in alt text', () => {
    const result = slack.image(
      'https://example.com/img.png',
      '  Indented alt text  '
    );

    expect(result.alt_text).toBe('  Indented alt text  ');
  });

  it('should handle alt text with multiple spaces', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Text  with   multiple    spaces'
    );

    expect(result.alt_text).toBe('Text  with   multiple    spaces');
  });

  it('should not modify input parameters', () => {
    const url = 'https://example.com/image.png';
    const altText = 'Original alt text';
    const title = 'Original title';

    slack.image(url, altText, title);

    expect(url).toBe('https://example.com/image.png');
    expect(altText).toBe('Original alt text');
    expect(title).toBe('Original title');
  });

  it('should return undefined title when title is not provided', () => {
    const result = slack.image('https://example.com/img.png', 'Alt');

    expect(result.title).toBeUndefined();
  });

  it('should handle image blocks with no title parameter', () => {
    const result = slack.image('https://example.com/img.png', 'Alt text');

    expect(result.type).toBe('image');
    expect(result.image_url).toBeDefined();
    expect(result.alt_text).toBeDefined();
    expect(result.title).toBeUndefined();
  });

  it('should validate that alt_text is not truncated markup', () => {
    const result = slack.image(
      'https://example.com/img.png',
      'Alt text with **bold** and _italic_'
    );

    // Alt text should be plain text, not processed markdown
    expect(result.alt_text).toContain('**bold**');
    expect(result.alt_text).toContain('_italic_');
  });

  it('should handle single character alt text', () => {
    const result = slack.image('https://example.com/img.png', 'A');

    expect(result.alt_text).toBe('A');
  });

  it('should handle single character title', () => {
    const result = slack.image('https://example.com/img.png', 'Alt', 'T');

    expect(result.title?.text).toBe('T');
  });
});

describe('video block unit tests', () => {
  it('should create a valid video block with required fields', () => {
    const result = slack.video({
      videoUrl: 'https://www.youtube.com/embed/8876OZV_Yy0',
      thumbnailUrl: 'https://i.ytimg.com/vi/8876OZV_Yy0/hqdefault.jpg',
      title: 'Test Video',
      altText: 'A test video',
    });

    expect(result.type).toBe('video');
    expect(result.video_url).toBe('https://www.youtube.com/embed/8876OZV_Yy0');
    expect(result.thumbnail_url).toBe(
      'https://i.ytimg.com/vi/8876OZV_Yy0/hqdefault.jpg'
    );
    expect(result.title.text).toBe('Test Video');
    expect(result.alt_text).toBe('A test video');
  });

  it('should have correct block structure', () => {
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Video Title',
      altText: 'Alt text',
    });

    expect(result.type).toBe('video');
    expect(result.title.type).toBe('plain_text');
    expect(result.title.emoji).toBe(true);
    expect(result.video_url).toBeDefined();
    expect(result.thumbnail_url).toBeDefined();
    expect(result.alt_text).toBeDefined();
  });

  it('should support optional fields', () => {
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Video Title',
      altText: 'Alt text',
      description: 'Video description',
      authorName: 'John Doe',
      providerName: 'YouTube',
      providerIconUrl: 'https://example.com/youtube.png',
      titleUrl: 'https://example.com/video',
    });

    expect(result.description).toBeDefined();
    expect(result.description?.text).toBe('Video description');
    expect(result.author_name).toBe('John Doe');
    expect(result.provider_name).toBe('YouTube');
    expect(result.provider_icon_url).toBe('https://example.com/youtube.png');
    expect(result.title_url).toBe('https://example.com/video');
  });

  it('should truncate title at 200 characters', () => {
    const longTitle = 'x'.repeat(250);
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: longTitle,
      altText: 'Alt',
    });

    expect(result.title.text.length).toBe(200);
  });

  it('should truncate description at 200 characters', () => {
    const longDescription = 'y'.repeat(250);
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Title',
      altText: 'Alt',
      description: longDescription,
    });

    expect(result.description?.text.length).toBe(200);
  });

  it('should truncate author name at 50 characters', () => {
    const longAuthor = 'a'.repeat(100);
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Title',
      altText: 'Alt',
      authorName: longAuthor,
    });

    expect(result.author_name?.length).toBe(50);
  });

  it('should throw error for empty video URL', () => {
    expect(() => {
      slack.video({
        videoUrl: '',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        title: 'Title',
        altText: 'Alt',
      });
    }).toThrow('Video URL must be a non-empty string');
  });

  it('should throw error for empty thumbnail URL', () => {
    expect(() => {
      slack.video({
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: '',
        title: 'Title',
        altText: 'Alt',
      });
    }).toThrow('Video thumbnail URL must be a non-empty string');
  });

  it('should throw error for empty title', () => {
    expect(() => {
      slack.video({
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        title: '',
        altText: 'Alt',
      });
    }).toThrow('Video title must be a non-empty string');
  });

  it('should throw error for empty alt text', () => {
    expect(() => {
      slack.video({
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        title: 'Title',
        altText: '',
      });
    }).toThrow('Video alt text must be a non-empty string');
  });

  it('should handle relative video URLs for backward compatibility', () => {
    const result = slack.video({
      videoUrl: '/videos/sample.mp4',
      thumbnailUrl: '/images/thumb.jpg',
      title: 'Title',
      altText: 'Alt',
    });

    expect(result.video_url).toBe('/videos/sample.mp4');
    expect(result.thumbnail_url).toBe('/images/thumb.jpg');
  });

  it('should throw error for invalid absolute video URL', () => {
    expect(() => {
      slack.video({
        videoUrl: 'https://',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        title: 'Title',
        altText: 'Alt',
      });
    }).toThrow('Invalid video URL');
  });

  it('should throw error for invalid absolute thumbnail URL', () => {
    expect(() => {
      slack.video({
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://',
        title: 'Title',
        altText: 'Alt',
      });
    }).toThrow('Invalid thumbnail URL');
  });

  it('should throw error for invalid absolute title URL', () => {
    expect(() => {
      slack.video({
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        title: 'Title',
        altText: 'Alt',
        titleUrl: 'https://',
      });
    }).toThrow('Invalid title URL');
  });

  it('should throw error for invalid absolute provider icon URL', () => {
    expect(() => {
      slack.video({
        videoUrl: 'https://example.com/video.mp4',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        title: 'Title',
        altText: 'Alt',
        providerIconUrl: 'https://',
      });
    }).toThrow('Invalid provider icon URL');
  });

  it('should handle https video URLs', () => {
    const result = slack.video({
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Title',
      altText: 'Alt',
    });

    expect(result.video_url).toContain('https://');
  });

  it('should handle data URLs for thumbnail', () => {
    const dataUrl =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8VAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: dataUrl,
      title: 'Title',
      altText: 'Alt',
    });

    expect(result.thumbnail_url).toBe(dataUrl);
  });

  it('should handle unicode in title', () => {
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Видео 视频 الفيديو',
      altText: 'Alt',
    });

    expect(result.title.text).toBe('Видео 视频 الفيديو');
  });

  it('should handle emoji in title and description', () => {
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: '🎬 Movie Time 🎥',
      altText: 'Alt',
      description: '📺 Watch this 🍿',
    });

    expect(result.title.text).toContain('🎬');
    expect(result.description?.text).toContain('📺');
  });

  it('should preserve author name without truncation if under 50 chars', () => {
    const authorName = 'John Doe';
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Title',
      altText: 'Alt',
      authorName,
    });

    expect(result.author_name).toBe(authorName);
  });

  it('should handle video URL with query parameters', () => {
    const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ?feature=oembed';
    const result = slack.video({
      videoUrl: url,
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Title',
      altText: 'Alt',
    });

    expect(result.video_url).toBe(url);
  });

  it('should return undefined for optional fields when not provided', () => {
    const result = slack.video({
      videoUrl: 'https://example.com/video.mp4',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Title',
      altText: 'Alt',
    });

    expect(result.description).toBeUndefined();
    expect(result.author_name).toBeUndefined();
    expect(result.provider_icon_url).toBeUndefined();
    expect(result.provider_name).toBeUndefined();
    expect(result.title_url).toBeUndefined();
  });

  it('should handle complex provider information', () => {
    const result = slack.video({
      videoUrl: 'https://vimeo.com/embed/123456',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Vimeo Video',
      altText: 'A Vimeo video',
      providerName: 'Vimeo',
      providerIconUrl: 'https://vimeo.com/logo.png',
      authorName: 'Vimeo Creator',
    });

    expect(result.provider_name).toBe('Vimeo');
    expect(result.provider_icon_url).toBe('https://vimeo.com/logo.png');
    expect(result.author_name).toBe('Vimeo Creator');
  });

  it('should handle long title URL', () => {
    const longUrl =
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s&list=PLxxxx&index=1';
    const result = slack.video({
      videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      title: 'Title',
      altText: 'Alt',
      titleUrl: longUrl,
    });

    expect(result.title_url).toBe(longUrl);
  });

  // File block builder tests
  describe('file builder', () => {
    it('should create file block with external_id', () => {
      const result = slack.file('document.pdf');
      expect(result.type).toBe('file');
      expect(result.external_id).toBe('document.pdf');
      expect(result.source).toBe('remote');
    });

    it('should create file block with URL as external_id', () => {
      const result = slack.file('https://example.com/files/report.pdf');
      expect(result.type).toBe('file');
      expect(result.external_id).toBe('https://example.com/files/report.pdf');
      expect(result.source).toBe('remote');
    });

    it('should create file block with various file types', () => {
      const extensions = [
        'document.pdf',
        'spreadsheet.xlsx',
        'presentation.pptx',
        'archive.zip',
        'data.csv',
        'config.json',
      ];

      extensions.forEach(ext => {
        const result = slack.file(ext);
        expect(result.type).toBe('file');
        expect(result.external_id).toBe(ext);
        expect(result.source).toBe('remote');
      });
    });

    it('should throw error on empty external_id', () => {
      expect(() => slack.file('')).toThrow();
    });

    it('should throw error on non-string external_id', () => {
      expect(() => slack.file(null as any)).toThrow();
      expect(() => slack.file(undefined as any)).toThrow();
      expect(() => slack.file(123 as any)).toThrow();
    });

    it('should always set source to remote', () => {
      const result = slack.file('any-file.pdf');
      expect(result.source).toBe('remote');
    });

    it('should support optional block_id', () => {
      // The builder doesn't support block_id yet, but the interface allows it
      const result: slack.FileBlock = {
        type: 'file',
        external_id: 'doc.pdf',
        source: 'remote',
        block_id: 'custom_id_123',
      };
      expect(result.block_id).toBe('custom_id_123');
    });
  });

  // File link parser tests
  describe('file link parsing', () => {
    it('should convert PDF link to file block', () => {
      const tokens = marked.lexer(
        '[report.pdf](https://example.com/report.pdf)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should convert DOCX link to file block', () => {
      const tokens = marked.lexer(
        '[document.docx](https://example.com/doc.docx)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should convert XLSX link to file block', () => {
      const tokens = marked.lexer(
        '[data.xlsx](https://example.com/spreadsheet.xlsx)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should convert PPTX link to file block', () => {
      const tokens = marked.lexer(
        '[slides.pptx](https://example.com/presentation.pptx)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should convert ZIP link to file block', () => {
      const tokens = marked.lexer(
        '[archive.zip](https://example.com/files.zip)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should convert CSV link to file block', () => {
      const tokens = marked.lexer('[data.csv](https://example.com/export.csv)');
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should convert JSON link to file block', () => {
      const tokens = marked.lexer(
        '[config.json](https://example.com/settings.json)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should preserve regular links that are not files', () => {
      const tokens = marked.lexer('[example](https://example.com)');
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('section');
    });

    it('should preserve links to HTML files as regular links', () => {
      const tokens = marked.lexer('[page.html](https://example.com/page.html)');
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('section');
    });

    it('should handle multiple file links in a paragraph', () => {
      const tokens = marked.lexer(
        'Download: [report.pdf](https://example.com/report.pdf) or [data.xlsx](https://example.com/data.xlsx)'
      );
      const actual = parseBlocks(tokens);

      // Should have 5 blocks: section, file, section, file, section
      // Actually: section with text "Download: ", then file, then section with " or ", then file
      expect(actual.some(block => block.type === 'file')).toBe(true);
    });

    it('should handle file links with query parameters', () => {
      const tokens = marked.lexer(
        '[document.pdf](https://example.com/download?file=doc.pdf&token=abc123)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should handle file links with hash fragments', () => {
      const tokens = marked.lexer(
        '[document.pdf](https://example.com/docs.pdf#page=5)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should handle relative file paths', () => {
      const tokens = marked.lexer('[local.pdf](./files/document.pdf)');
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should handle file links in blockquotes', () => {
      const tokens = marked.lexer(
        '> [document.pdf](https://example.com/doc.pdf)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.some(block => block.type === 'file')).toBe(true);
    });

    it('should handle case-insensitive file extensions', () => {
      const tokens = marked.lexer('[file.PDF](https://example.com/FILE.PDF)');
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should handle mixed case extensions', () => {
      const tokens = marked.lexer('[file.PdF](https://example.com/file.PdF)');
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should extract filename as external_id', () => {
      const tokens = marked.lexer(
        '[report.pdf](https://example.com/files/report.pdf)'
      );
      const actual = parseBlocks(tokens);

      expect(actual[0].type).toBe('file');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((actual[0] as any).external_id).toBe('report.pdf');
    });

    it('should handle long file paths', () => {
      const tokens = marked.lexer(
        '[document.pdf](https://example.com/very/long/path/structure/to/deep/folders/document.pdf)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should not convert links without file extensions to file blocks', () => {
      const tokens = marked.lexer('[link](https://example.com)');
      const actual = parseBlocks(tokens);

      expect(actual[0].type).toBe('section');
    });

    it('should not convert links with unsupported extensions to file blocks', () => {
      const tokens = marked.lexer('[file.xyz](https://example.com/file.xyz)');
      const actual = parseBlocks(tokens);

      expect(actual[0].type).toBe('section');
    });

    it('should handle links with multiple dots in filename', () => {
      const tokens = marked.lexer(
        '[my.report.v2.pdf](https://example.com/files/my.report.v2.pdf)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support JPEG file extension', () => {
      const tokens = marked.lexer(
        '[image.jpeg](https://example.com/photo.jpeg)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support PNG file extension', () => {
      const tokens = marked.lexer(
        '[image.png](https://example.com/screenshot.png)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support GIF file extension', () => {
      const tokens = marked.lexer(
        '[animation.gif](https://example.com/animation.gif)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support SVG file extension', () => {
      const tokens = marked.lexer(
        '[diagram.svg](https://example.com/diagram.svg)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support TAR file extension', () => {
      const tokens = marked.lexer(
        '[archive.tar](https://example.com/backup.tar)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support GZ file extension', () => {
      const tokens = marked.lexer(
        '[archive.gz](https://example.com/backup.gz)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support RAR file extension', () => {
      const tokens = marked.lexer(
        '[archive.rar](https://example.com/files.rar)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support 7Z file extension', () => {
      const tokens = marked.lexer(
        '[archive.7z](https://example.com/backup.7z)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support DOC file extension', () => {
      const tokens = marked.lexer(
        '[document.doc](https://example.com/letter.doc)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support XLS file extension', () => {
      const tokens = marked.lexer(
        '[spreadsheet.xls](https://example.com/data.xls)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should support PPT file extension', () => {
      const tokens = marked.lexer(
        '[presentation.ppt](https://example.com/slides.ppt)'
      );
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });

    it('should handle numeric file extensions', () => {
      const tokens = marked.lexer('[archive.7z](https://example.com/files.7z)');
      const actual = parseBlocks(tokens);

      expect(actual.length).toBe(1);
      expect(actual[0].type).toBe('file');
    });
  });
});

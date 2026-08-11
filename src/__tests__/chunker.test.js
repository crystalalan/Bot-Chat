import { chunkText } from '../kb/chunker.js';

describe('chunkText', () => {
  test('短文本返回单个块', () => {
    expect(chunkText('你好世界', 800, 100)).toEqual(['你好世界']);
  });

  test('按 chunkSize 切分长文本', () => {
    const text = 'a'.repeat(100);
    const chunks = chunkText(text, 30, 5);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 30)).toBe(true);
  });

  test('空文本返回空数组', () => {
    expect(chunkText('', 800, 100)).toEqual([]);
    expect(chunkText(null, 800, 100)).toEqual([]);
    expect(chunkText('   \n  ', 800, 100)).toEqual([]);
  });

  test('chunkOverlap 生效产生重叠块', () => {
    const text = 'x'.repeat(80);
    const chunks = chunkText(text, 40, 10);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  test('chunkOverlap 大于 chunkSize 时被限制', () => {
    expect(() => chunkText('abc', 10, 50)).not.toThrow();
  });

  test('优先在换行处切分', () => {
    const text = '段落一的内容，用于测试换行切分。\n段落二的内容，同样用于测试。';
    const chunks = chunkText(text, 20, 2);
    expect(chunks.length).toBeGreaterThan(1);
  });

  test('超长单行按固定长度切分', () => {
    const text = 'y'.repeat(500);
    const chunks = chunkText(text, 100, 0);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.length).toBe(5);
  });
});

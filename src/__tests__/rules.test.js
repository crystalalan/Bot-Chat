import { matchRule, matchAllRules } from '../rules.js';

const baseRules = [
  { id: 'a', keywords: ['苹果'], reply: 'A', mode: 'contains', priority: 1, enabled: true },
  { id: 'b', keywords: ['水果'], reply: 'B', mode: 'contains', priority: 2, enabled: true },
];

describe('matchRule', () => {
  test('包含匹配命中返回对应规则', () => {
    const r = matchRule('我喜欢吃苹果', baseRules);
    expect(r && r.id).toBe('a');
  });

  test('精确匹配模式要求完全一致', () => {
    const rules = [{ id: 'e', keywords: ['苹果'], reply: 'E', mode: 'exact', priority: 1, enabled: true }];
    expect(matchRule('苹果', rules)).toBeTruthy();
    expect(matchRule('我喜欢苹果', rules)).toBeNull();
  });

  test('按优先级降序返回最高优先级规则', () => {
    const r = matchRule('苹果和水果都是', baseRules);
    expect(r && r.id).toBe('b');
  });

  test('同一优先级按配置顺序取第一个', () => {
    const rules = [
      { id: 'x', keywords: ['测试'], mode: 'contains', priority: 1 },
      { id: 'y', keywords: ['测试'], mode: 'contains', priority: 1 },
    ];
    expect(matchRule('测试', rules).id).toBe('x');
  });

  test('disabled 规则不参与匹配', () => {
    const rules = [{ id: 'd', keywords: ['苹果'], reply: 'D', mode: 'contains', priority: 1, enabled: false }];
    expect(matchRule('苹果', rules)).toBeNull();
  });

  test('空文本、空规则返回 null', () => {
    expect(matchRule('', baseRules)).toBeNull();
    expect(matchRule(null, baseRules)).toBeNull();
    expect(matchRule('任意', [])).toBeNull();
    expect(matchRule('任意', null)).toBeNull();
  });

  test('未命中返回 null', () => {
    expect(matchRule('香蕉', baseRules)).toBeNull();
  });
});

describe('matchAllRules', () => {
  test('返回所有命中规则', () => {
    const hits = matchAllRules('苹果是一种水果', baseRules);
    expect(hits.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  test('无命中返回空数组', () => {
    expect(matchAllRules('香蕉', baseRules)).toEqual([]);
    expect(matchAllRules('', baseRules)).toEqual([]);
  });
});

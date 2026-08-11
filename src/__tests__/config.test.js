import fs from 'node:fs';
import { loadConfig } from '../config.js';

describe('loadConfig', () => {
  test('加载合法配置并合并默认值', () => {
    const cfg = loadConfig('config.example.json');
    expect(cfg.rooms).toEqual(['测试群']);
    expect(cfg.keywordRules.length).toBeGreaterThan(0);
    expect(cfg.rag.topK).toBe(3);
    expect(cfg.rateLimit.maxRepliesPerWindow).toBe(20);
  });

  test('配置文件不存在时抛出错误', () => {
    expect(() => loadConfig('__not_exists__.json')).toThrow(/配置文件不存在/);
  });

  test('非法 JSON 抛出错误', () => {
    const tmp = '__bad_config__.json';
    fs.writeFileSync(tmp, '{ not valid json', 'utf-8');
    expect(() => loadConfig(tmp)).toThrow(/不是合法 JSON/);
    fs.unlinkSync(tmp);
  });

  test('缺少字段时使用默认值', () => {
    const tmp = '__minimal_config__.json';
    fs.writeFileSync(tmp, '{}', 'utf-8');
    const cfg = loadConfig(tmp);
    expect(cfg.rooms).toEqual([]);
    expect(cfg.keywordRules).toEqual([]);
    expect(cfg.mentionReply).toContain('我在');
    fs.unlinkSync(tmp);
  });

  test('非法 keywordRules 抛出错误', () => {
    const tmp = '__bad_rules__.json';
    fs.writeFileSync(tmp, JSON.stringify({ keywordRules: [{ id: 'x', keywords: [] }] }), 'utf-8');
    expect(() => loadConfig(tmp)).toThrow(/keywords/);
    fs.unlinkSync(tmp);
  });
});

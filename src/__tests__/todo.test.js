import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TodoManager, parseTodoCommand, parseRemindTime } from '../todo.js';

const tmpFile = () => path.join(os.tmpdir(), `todos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);

function makeContact(id, name) {
  return { id, name: () => name };
}

describe('parseRemindTime', () => {
  test('解析 N 分钟后', () => {
    const before = Date.now();
    const { remindAt, rest } = parseRemindTime('30分钟后 交报告');
    expect(remindAt).toBeGreaterThanOrEqual(before + 30 * 60 * 1000 - 1000);
    expect(remindAt).toBeLessThanOrEqual(before + 30 * 60 * 1000 + 1000);
    expect(rest).toBe('交报告');
  });

  test('解析 N 小时后', () => {
    const before = Date.now();
    const { remindAt, rest } = parseRemindTime('2小时后 开会');
    expect(remindAt).toBeGreaterThanOrEqual(before + 2 * 3600 * 1000 - 1000);
    expect(rest).toBe('开会');
  });

  test('解析今天/明天具体时刻', () => {
    const { remindAt, rest } = parseRemindTime('明天15点 交周报');
    expect(remindAt).toBeGreaterThan(Date.now());
    expect(rest).toBe('交周报');
  });

  test('解析指定日期与时间（8月25日 14:30）', () => {
    const now = new Date();
    const { remindAt, rest } = parseRemindTime('8月25日 14:30 交报告');
    expect(rest).toBe('交报告');
    const d = new Date(remindAt);
    expect(d.getMonth() + 1).toBe(8);
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
    let expectedYear = now.getFullYear();
    if (now.getMonth() + 1 > 8 || (now.getMonth() + 1 === 8 && now.getDate() > 25)) expectedYear += 1;
    expect(d.getFullYear()).toBe(expectedYear);
  });

  test('解析带年份的日期时间', () => {
    const { remindAt, rest } = parseRemindTime('2027年8月25日 14:30 交报告');
    expect(rest).toBe('交报告');
    const d = new Date(remindAt);
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth() + 1).toBe(8);
    expect(d.getDate()).toBe(25);
    expect(d.getHours()).toBe(14);
  });

  test('解析指定日期无时间（默认 9 点）', () => {
    const { remindAt, rest } = parseRemindTime('8月25日 交报告');
    expect(rest).toBe('交报告');
    const d = new Date(remindAt);
    expect(d.getHours()).toBe(9);
  });

  test('解析指定日期下午时刻', () => {
    const { remindAt, rest } = parseRemindTime('8月25日下午2点30分 开会');
    expect(rest).toBe('开会');
    const d = new Date(remindAt);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  test('解析明天单独（默认 9 点）', () => {
    const { remindAt, rest } = parseRemindTime('明天 交周报');
    expect(remindAt).toBeGreaterThan(Date.now());
    const d = new Date(remindAt);
    expect(d.getHours()).toBe(9);
    expect(rest).toBe('交周报');
  });

  test('无时间描述返回 null', () => {
    const { remindAt, rest } = parseRemindTime('交周报');
    expect(remindAt).toBeNull();
    expect(rest).toBe('交周报');
  });
});

describe('parseTodoCommand', () => {
  test('解析添加个人待办', () => {
    expect(parseTodoCommand('添加待办 明天9点 交周报')).toEqual({ action: 'add', scope: 'personal', raw: '明天9点 交周报' });
    expect(parseTodoCommand('添加个人待办 写代码')).toEqual({ action: 'add', scope: 'personal', raw: '写代码' });
  });

  test('解析添加团体待办', () => {
    expect(parseTodoCommand('添加团体待办 明天9点 开会')).toEqual({ action: 'add', scope: 'group', raw: '明天9点 开会' });
  });

  test('解析查看/完成/删除待办', () => {
    expect(parseTodoCommand('查看待办')).toEqual({ action: 'list' });
    expect(parseTodoCommand('完成待办 1')).toEqual({ action: 'done', scope: 'personal', seqs: [1], seq: 1 });
    expect(parseTodoCommand('完成团体待办 2')).toEqual({ action: 'done', scope: 'group', seqs: [2], seq: 2 });
    expect(parseTodoCommand('删除待办 3')).toEqual({ action: 'remove', scope: 'personal', seqs: [3], seq: 3 });
  });

  test('解析批量删除待办（空格/逗号/顿号分隔）', () => {
    expect(parseTodoCommand('删除待办 1 3 5')).toEqual({ action: 'remove', scope: 'personal', seqs: [1, 3, 5], seq: 1 });
    expect(parseTodoCommand('删除待办 1,3,5')).toEqual({ action: 'remove', scope: 'personal', seqs: [1, 3, 5], seq: 1 });
    expect(parseTodoCommand('删除待办 1，3，5')).toEqual({ action: 'remove', scope: 'personal', seqs: [1, 3, 5], seq: 1 });
    expect(parseTodoCommand('删除待办 1、3、5')).toEqual({ action: 'remove', scope: 'personal', seqs: [1, 3, 5], seq: 1 });
    expect(parseTodoCommand('删除团体待办 2 4')).toEqual({ action: 'remove', scope: 'group', seqs: [2, 4], seq: 2 });
    expect(parseTodoCommand('移除待办 1 2')).toEqual({ action: 'remove', scope: 'personal', seqs: [1, 2], seq: 1 });
  });

  test('非待办文本返回 null', () => {
    expect(parseTodoCommand('你好')).toBeNull();
    expect(parseTodoCommand('')).toBeNull();
  });
});

describe('TodoManager', () => {
  test('添加/列出/完成/删除待办', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    const todo = mgr.add({ scope: 'personal', content: '交周报', remindAt: null, roomId: 'r1', roomTopic: '测试群', creator });
    expect(todo.done).toBe(false);
    expect(mgr.list('r1').length).toBe(1);
    expect(mgr.list('r1', 'personal').length).toBe(1);

    const done = mgr.markDone('r1', 'personal', 1);
    expect(done.content).toBe('交周报');
    expect(mgr.list('r1').length).toBe(0);

    mgr.add({ scope: 'group', content: '开会', remindAt: null, roomId: 'r1', creator });
    const removed = mgr.remove('r1', 'group', 1);
    expect(removed.content).toBe('开会');
    expect(mgr.list('r1').length).toBe(0);
    fs.unlinkSync(file);
  });

  test('批量删除多个待办', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    mgr.add({ scope: 'personal', content: '待办A', remindAt: null, roomId: 'r1', creator });
    mgr.add({ scope: 'personal', content: '待办B', remindAt: null, roomId: 'r1', creator });
    mgr.add({ scope: 'personal', content: '待办C', remindAt: null, roomId: 'r1', creator });
    mgr.add({ scope: 'personal', content: '待办D', remindAt: null, roomId: 'r1', creator });
    const removed = mgr.removeMany('r1', 'personal', [1, 3]);
    expect(removed.map((t) => t.content)).toEqual(['待办A', '待办C']);
    const rest = mgr.list('r1', 'personal').map((t) => t.content);
    expect(rest).toEqual(['待办B', '待办D']);
    fs.unlinkSync(file);
  });

  test('批量删除支持乱序与重复序号，越界序号忽略', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    mgr.add({ scope: 'personal', content: '待办A', remindAt: null, roomId: 'r1', creator });
    mgr.add({ scope: 'personal', content: '待办B', remindAt: null, roomId: 'r1', creator });
    mgr.add({ scope: 'personal', content: '待办C', remindAt: null, roomId: 'r1', creator });
    const removed = mgr.removeMany('r1', 'personal', [3, 1, 1, 99]);
    expect(removed.map((t) => t.content)).toEqual(['待办A', '待办C']);
    expect(mgr.list('r1', 'personal').map((t) => t.content)).toEqual(['待办B']);
    fs.unlinkSync(file);
  });

  test('批量删除不存在的序号返回空数组且不报错', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const removed = mgr.removeMany('r1', 'personal', [1, 2]);
    expect(removed).toEqual([]);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  test('持久化：重启后恢复待办', () => {
    const file = tmpFile();
    let mgr = new TodoManager({ file });
    mgr.add({ scope: 'personal', content: '持久化测试', remindAt: null, roomId: 'r1', creator: makeContact('u1', '张三') });
    mgr = new TodoManager({ file });
    const todos = mgr.list('r1');
    expect(todos.length).toBe(1);
    expect(todos[0].content).toBe('持久化测试');
    fs.unlinkSync(file);
  });

  test('重启后 roomId 变化时按 roomTopic 回退查到未完成待办', () => {
    const file = tmpFile();
    let mgr = new TodoManager({ file });
    mgr.add({ scope: 'personal', content: '跨重启待办', remindAt: null, roomId: 'old-id', roomTopic: '测试群', creator: makeContact('u1', '张三') });
    mgr = new TodoManager({ file });
    const personal = mgr.list('new-id', 'personal', '测试群');
    expect(personal.length).toBe(1);
    expect(personal[0].content).toBe('跨重启待办');
    expect(mgr.formatList('new-id', '测试群')).toContain('跨重启待办');
    fs.unlinkSync(file);
  });

  test('完成待办后从文件清除记录', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    mgr.add({ scope: 'personal', content: '交周报', remindAt: null, roomId: 'r1', creator: makeContact('u1', '张三') });
    mgr.markDone('r1', 'personal', 1);
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(raw.filter((t) => t.content === '交周报')).toEqual([]);
    fs.unlinkSync(file);
  });

  test('删除待办后从文件清除记录', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    mgr.add({ scope: 'personal', content: '交周报', remindAt: null, roomId: 'r1', creator: makeContact('u1', '张三') });
    mgr.remove('r1', 'personal', 1);
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    expect(raw.filter((t) => t.content === '交周报')).toEqual([]);
    fs.unlinkSync(file);
  });

  test('按 roomTopic 回退完成/删除待办', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    mgr.add({ scope: 'group', content: '开会', remindAt: null, roomId: 'old-id', roomTopic: '测试群', creator: makeContact('u1', '张三') });
    const done = mgr.markDone('new-id', 'group', 1, '测试群');
    expect(done.content).toBe('开会');
    expect(mgr.list('new-id', 'group', '测试群').length).toBe(0);
    mgr.add({ scope: 'group', content: '值班', remindAt: null, roomId: 'old-id', roomTopic: '测试群', creator: makeContact('u1', '张三') });
    const removed = mgr.removeMany('new-id', 'group', [1], '测试群');
    expect(removed[0].content).toBe('值班');
    fs.unlinkSync(file);
  });

  test('formatAdd 输出个人/团体待办', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    const p = mgr.add({ scope: 'personal', content: '交周报', remindAt: null, roomId: 'r1', creator });
    expect(mgr.formatAdd(p)).toContain('个人待办');
    const g = mgr.add({ scope: 'group', content: '开会', remindAt: null, roomId: 'r1', creator, participants: [makeContact('u2', '李四')] });
    expect(mgr.formatAdd(g)).toContain('团体待办');
    expect(mgr.formatAdd(g)).toContain('李四');
    fs.unlinkSync(file);
  });

  test('formatList 区分个人与团体待办', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    mgr.add({ scope: 'personal', content: '交周报', remindAt: null, roomId: 'r1', creator });
    mgr.add({ scope: 'group', content: '开会', remindAt: null, roomId: 'r1', creator, participants: [makeContact('u2', '李四')] });
    const out = mgr.formatList('r1');
    expect(out).toContain('个人待办');
    expect(out).toContain('团体待办');
    expect(out).toContain('交周报');
    expect(out).toContain('开会');
    expect(out).toContain('李四');
    fs.unlinkSync(file);
  });

  test('空列表提示', () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    expect(mgr.formatList('r1')).toContain('没有未完成的待办');
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });
});

function makeSpySay() {
  const calls = [];
  const say = async (...args) => { calls.push(args); };
  return { calls, say };
}

describe('TodoManager 提醒', () => {
  test('到期个人待办 @ 创建者提醒', async () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    const spy = makeSpySay();
    const room = { id: 'r1', say: spy.say };
    mgr.roomCache.set('r1', room);
    mgr.add({ scope: 'personal', content: '交周报', remindAt: Date.now() - 1000, roomId: 'r1', creator });
    await mgr.tick();
    expect(spy.calls.length).toBe(1);
    const [text, contact] = spy.calls[0];
    expect(text).toContain('待办提醒');
    expect(contact.id).toBe('u1');
    fs.unlinkSync(file);
  });

  test('缓存失效时按 name 回退查找创建者并 @', async () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const spy = makeSpySay();
    const found = makeContact('u1', '张三');
    const room = { id: 'r1', say: spy.say, member: async ({ name }) => (name === '张三' ? found : null) };
    mgr.roomCache.set('r1', room);
    mgr.add({ scope: 'personal', content: '交周报', remindAt: Date.now() - 1000, roomId: 'r1', creator: makeContact('u1', '张三') });
    mgr.contactCache.clear();
    await mgr.tick();
    expect(spy.calls.length).toBe(1);
    expect(spy.calls[0][1].id).toBe('u1');
    fs.unlinkSync(file);
  });

  test('按 name 回退查找团体参与成员', async () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    const lisi = makeContact('u2', '李四');
    const spy = makeSpySay();
    const room = {
      id: 'r1',
      say: spy.say,
      member: async ({ name }) => (name === '李四' ? lisi : name === '张三' ? creator : null),
    };
    mgr.roomCache.set('r1', room);
    mgr.add({ scope: 'group', content: '开会', remindAt: Date.now() - 1000, roomId: 'r1', creator, participants: [lisi] });
    mgr.contactCache.clear();
    await mgr.tick();
    expect(spy.calls.length).toBe(1);
    const ids = spy.calls[0].slice(1).map((c) => c.id).sort();
    expect(ids).toEqual(['u1', 'u2']);
    fs.unlinkSync(file);
  });

  test('到期团体待办 @ 参与成员与发起人', async () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    const lisi = makeContact('u2', '李四');
    const spy = makeSpySay();
    const room = { id: 'r1', say: spy.say };
    mgr.roomCache.set('r1', room);
    mgr.add({ scope: 'group', content: '开会', remindAt: Date.now() - 1000, roomId: 'r1', creator, participants: [lisi] });
    await mgr.tick();
    expect(spy.calls.length).toBe(1);
    const [text, ...contacts] = spy.calls[0];
    expect(text).toContain('开会');
    const ids = contacts.map((c) => c.id).sort();
    expect(ids).toEqual(['u1', 'u2']);
    fs.unlinkSync(file);
  });

  test('未到期待办不提醒', async () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const spy = makeSpySay();
    const room = { id: 'r1', say: spy.say };
    mgr.roomCache.set('r1', room);
    mgr.add({ scope: 'personal', content: '交周报', remindAt: Date.now() + 60 * 60 * 1000, roomId: 'r1', creator: makeContact('u1', '张三') });
    await mgr.tick();
    expect(spy.calls.length).toBe(0);
    fs.unlinkSync(file);
  });

  test('add 传入 room 对象时缓存，提醒复用缓存 room', async () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    const spy = makeSpySay();
    const room = { id: 'r1', say: spy.say };
    mgr.add({ scope: 'personal', content: '交周报', remindAt: Date.now() - 1000, roomId: 'r1', room, creator });
    await mgr.tick();
    expect(spy.calls.length).toBe(1);
    expect(mgr.roomCache.has('r1')).toBe(true);
    fs.unlinkSync(file);
  });

  test('roomCache 缺失时按 topic 查找群并提醒', async () => {
    const file = tmpFile();
    const mgr = new TodoManager({ file });
    const creator = makeContact('u1', '张三');
    const spy = makeSpySay();
    const room = { id: 'r1', say: spy.say };
    mgr.bot = { Room: { find: async (q) => (q.topic === '测试群' ? room : null) } };
    mgr.add({ scope: 'personal', content: '交周报', remindAt: Date.now() - 1000, roomId: 'r1', roomTopic: '测试群', creator });
    await mgr.tick();
    expect(spy.calls.length).toBe(1);
    fs.unlinkSync(file);
  });
});

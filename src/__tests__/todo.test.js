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
    expect(parseTodoCommand('完成待办 1')).toEqual({ action: 'done', scope: 'personal', seq: 1 });
    expect(parseTodoCommand('完成团体待办 2')).toEqual({ action: 'done', scope: 'group', seq: 2 });
    expect(parseTodoCommand('删除待办 3')).toEqual({ action: 'remove', scope: 'personal', seq: 3 });
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
});

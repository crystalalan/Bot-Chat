import fs from 'node:fs';
import path from 'node:path';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const DAY_OFFSETS = { '今天': 0, '明天': 1, '后天': 2 };

const SCOPE_MAP = { '个人': 'personal', '团体': 'group' };

export function parseRemindTime(text) {
  const s = String(text || '').trim();
  if (!s) return { remindAt: null, rest: s };
  const now = new Date();

  const mMin = s.match(/^(\d+)\s*分钟后/);
  if (mMin) return { remindAt: Date.now() + parseInt(mMin[1], 10) * MINUTE, rest: s.slice(mMin[0].length).trim() };

  const mHour = s.match(/^(\d+)\s*小时后/);
  if (mHour) return { remindAt: Date.now() + parseInt(mHour[1], 10) * HOUR, rest: s.slice(mHour[0].length).trim() };

  const mDate = s.match(/^((?:(\d{4})年)?\s*(\d{1,2})月\s*(\d{1,2})[日号])\s*(上午|下午|晚上)?\s*(?:(\d{1,2})\s*[:点时]\s*(\d{1,2})?分?)?/);
  if (mDate && mDate[3] && mDate[4]) {
    let year = mDate[2] ? parseInt(mDate[2], 10) : now.getFullYear();
    let month = parseInt(mDate[3], 10) - 1;
    const day = parseInt(mDate[4], 10);
    let hour = mDate[6] ? parseInt(mDate[6], 10) : 9;
    const minute = mDate[7] ? parseInt(mDate[7], 10) : 0;
    if (mDate[5] === '下午' && hour < 12) hour += 12;
    if (mDate[5] === '晚上' && hour < 12) hour += 12;
    let d = new Date(year, month, day, hour, minute, 0, 0);
    if (!mDate[2] && d.getTime() <= now.getTime()) {
      d = new Date(year + 1, month, day, hour, minute, 0, 0);
    }
    return { remindAt: d.getTime(), rest: s.slice(mDate[0].length).trim() };
  }

  const mExact = s.match(/^(今天|明天|后天)\s*(上午|下午|晚上)?\s*(\d{1,2})\s*[:点时]\s*(\d{1,2})?分?/);
  if (mExact) {
    const offset = DAY_OFFSETS[mExact[1]] ?? 0;
    let hour = parseInt(mExact[3], 10);
    const minute = mExact[4] ? parseInt(mExact[4], 10) : 0;
    if (mExact[2] === '下午' && hour < 12) hour += 12;
    if (mExact[2] === '晚上' && hour < 12) hour += 12;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return { remindAt: d.getTime(), rest: s.slice(mExact[0].length).trim() };
  }

  const mDay = s.match(/^(今天|明天|后天)/);
  if (mDay) {
    const offset = DAY_OFFSETS[mDay[1]] ?? 0;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 9, 0, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return { remindAt: d.getTime(), rest: s.slice(mDay[0].length).trim() };
  }

  return { remindAt: null, rest: s };
}

export function parseTodoCommand(text) {
  const t = String(text || '').trim();
  if (!t) return null;

  const addMatch = t.match(/^添加(个人|团体)?待办\s+(.+)$/);
  if (addMatch) {
    return { action: 'add', scope: addMatch[1] ? SCOPE_MAP[addMatch[1]] : 'personal', raw: addMatch[2].trim() };
  }

  const listMatch = t.match(/^(查看|列出|查询)\s*待办$/);
  if (listMatch) return { action: 'list' };

  const opMatch = t.match(/^(完成|删除|移除)\s*(个人|团体)?\s*待办\s*[:#]?\s*(.+)$/);
  if (opMatch) {
    const action = opMatch[1] === '完成' ? 'done' : 'remove';
    const scope = opMatch[2] ? SCOPE_MAP[opMatch[2]] : 'personal';
    const seqs = String(opMatch[3])
      .replace(/[，、]/g, ',')
      .split(/[\s,]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isInteger(n) && n >= 1);
    if (seqs.length === 0) return null;
    return { action, scope, seqs, seq: seqs[0] };
  }

  return null;
}

function formatTime(ts) {
  if (!ts) return '未设置时间';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export class TodoManager {
  constructor({ file = 'data/todos.json', intervalMs = 30000 } = {}) {
    this.file = file;
    this.intervalMs = intervalMs;
    this.todos = [];
    this.bot = null;
    this.timer = null;
    this.contactCache = new Map();
    this.roomCache = new Map();
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf-8');
      const data = JSON.parse(raw);
      this.todos = Array.isArray(data) ? data : [];
    } catch {
      this.todos = [];
    }
  }

  _save() {
    try {
      const dir = path.dirname(this.file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.todos, null, 2), 'utf-8');
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error(`[待办] 持久化失败: ${err.message}`);
    }
  }

  start(bot) {
    this.bot = bot;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    if (this.timer.unref) this.timer.unref();
    console.log(`[待办] 调度器已启动（每 ${this.intervalMs / 1000} 秒扫描一次），当前 ${this.todos.length} 条待办`);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  cacheContacts(contacts) {
    for (const c of contacts || []) {
      if (c && c.id) this.contactCache.set(c.id, c);
    }
  }

  cacheRoom(room) {
    if (room && room.id) this.roomCache.set(room.id, room);
  }

  add({ scope, content, remindAt, roomId, roomTopic, creator, participants, room }) {
    const now = Date.now();
    const todo = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      scope,
      content,
      remindAt,
      createdAt: now,
      done: false,
      reminded: false,
      creatorId: creator?.id || '',
      creatorName: creator?.name ? creator.name() : '',
      roomId: roomId || '',
      roomTopic: roomTopic || '',
      participants: (participants || []).map((c) => ({ id: c.id, name: c.name ? c.name() : '' })),
    };
    this.todos.push(todo);
    if (room) this.cacheRoom(room);
    this.cacheContacts([creator, ...(participants || [])]);
    this._save();
    return todo;
  }

  list(roomId, scope = null, roomTopic = '') {
    return this.todos
      .filter((t) => (t.roomId === roomId || (roomTopic && t.roomTopic && t.roomTopic === roomTopic)) && !t.done)
      .filter((t) => !scope || t.scope === scope);
  }

  findBySeq(roomId, scope, seq, roomTopic = '') {
    const list = this.list(roomId, scope, roomTopic);
    return list[seq - 1] || null;
  }

  markDone(roomId, scope, seq, roomTopic = '') {
    const todo = this.findBySeq(roomId, scope, seq, roomTopic);
    if (!todo) return null;
    todo.done = true;
    this.todos = this.todos.filter((t) => t.id !== todo.id);
    this._save();
    return todo;
  }

  remove(roomId, scope, seq, roomTopic = '') {
    const todo = this.findBySeq(roomId, scope, seq, roomTopic);
    if (!todo) return null;
    this.todos = this.todos.filter((t) => t.id !== todo.id);
    this._save();
    return todo;
  }

  removeMany(roomId, scope, seqs, roomTopic = '') {
    const list = this.list(roomId, scope, roomTopic);
    const unique = [...new Set(seqs.map((n) => Number(n)))].sort((a, b) => a - b);
    const targets = [];
    for (const seq of unique) {
      const todo = list[seq - 1];
      if (todo) targets.push(todo);
    }
    if (targets.length === 0) return [];
    const ids = new Set(targets.map((t) => t.id));
    this.todos = this.todos.filter((t) => !ids.has(t.id));
    this._save();
    return targets;
  }

  formatList(roomId, roomTopic = '') {
    const personal = this.list(roomId, 'personal', roomTopic);
    const group = this.list(roomId, 'group', roomTopic);
    if (personal.length === 0 && group.length === 0) return '当前群没有未完成的待办。';
    const lines = [];
    if (personal.length > 0) {
      lines.push('个人待办：');
      personal.forEach((t, i) => lines.push(`${i + 1}. ${formatTime(t.remindAt)} ${t.content}`));
    }
    if (group.length > 0) {
      lines.push('团体待办：');
      group.forEach((t, i) => {
        const members = t.participants.length > 0 ? `（@ ${t.participants.map((p) => p.name).join('、')}）` : '';
        lines.push(`${i + 1}. ${formatTime(t.remindAt)} ${t.content}${members}`);
      });
    }
    return lines.join('\n');
  }

  formatAdd(todo) {
    const scopeText = todo.scope === 'group' ? '团体待办' : '个人待办';
    const members = todo.scope === 'group' && todo.participants.length > 0
      ? `，参与成员 @ ${todo.participants.map((p) => p.name).join('、')}`
      : '';
    return `已添加${scopeText}：${todo.content}${members}。提醒时间：${formatTime(todo.remindAt)}。`;
  }

  async tick() {
    const now = Date.now();
    const due = this.todos.filter((t) => !t.done && !t.reminded && t.remindAt && t.remindAt <= now);
    for (const todo of due) {
      try {
        await this.remind(todo);
      } catch (err) {
        console.error(`[待办] 提醒失败 id=${todo.id}: ${err.message}`);
      }
    }
  }

  async _resolveRoom(todo) {
    if (this.roomCache.has(todo.roomId)) return this.roomCache.get(todo.roomId);
    if (!this.bot || (!todo.roomId && !todo.roomTopic)) return null;
    try {
      const query = {};
      if (todo.roomTopic) query.topic = todo.roomTopic;
      else if (todo.roomId) query.id = todo.roomId;
      const room = await this.bot.Room.find(query);
      if (room && room.id) {
        this.roomCache.set(todo.roomId || room.id, room);
        return room;
      }
    } catch {
      return null;
    }
    return null;
  }

  async _resolveContact(room, id, name) {
    if (id && this.contactCache.has(id)) return this.contactCache.get(id);
    if (!room) return null;
    try {
      if (id) {
        const member = await room.member({ id });
        if (member) {
          if (id) this.contactCache.set(id, member);
          return member;
        }
      }
      if (name) {
        const member = await room.member({ name });
        if (member) {
          if (id) this.contactCache.set(id, member);
          return member;
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  async remind(todo) {
    const room = await this._resolveRoom(todo);
    if (!room) throw new Error('无法找到所在群');
    const text = `待办提醒：${todo.content}（${formatTime(todo.remindAt)}）`;
    if (todo.scope === 'group') {
      const ids = [...new Set([...(todo.participants || []).map((p) => p.id), todo.creatorId].filter(Boolean))];
      const names = new Map();
      for (const p of todo.participants || []) {
        if (p.id) names.set(p.id, p.name);
      }
      if (todo.creatorId && todo.creatorName) names.set(todo.creatorId, todo.creatorName);
      const contacts = [];
      for (const id of ids) {
        const c = await this._resolveContact(room, id, names.get(id));
        if (c) contacts.push(c);
      }
      if (contacts.length > 0) await room.say(text, ...contacts);
      else await room.say(text);
    } else {
      const c = await this._resolveContact(room, todo.creatorId, todo.creatorName);
      if (c) await room.say(text, c);
      else await room.say(text);
    }
    todo.reminded = true;
    this._save();
    return true;
  }
}

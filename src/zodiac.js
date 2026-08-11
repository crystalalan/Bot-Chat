import 'dotenv/config';

const API_URL = 'http://web.juhe.cn:8080/constellation/getAll';

export const ZODIAC_SIGNS = [
  '白羊座', '金牛座', '双子座', '巨蟹座',
  '狮子座', '处女座', '天秤座', '天蝎座',
  '射手座', '摩羯座', '水瓶座', '双鱼座',
];

export function normalizeSign(arg) {
  const s = String(arg || '').trim();
  if (!s) return null;
  if (ZODIAC_SIGNS.includes(s)) return s;
  if (ZODIAC_SIGNS.includes(`${s}座`)) return `${s}座`;
  return null;
}

export class ZodiacClient {
  constructor() {
    this.apiKey = process.env.USER_JUHE_API_KEY || '';
    this.enabled = Boolean(this.apiKey);
  }

  async getDaily(sign) {
    if (!this.enabled) throw new Error('未配置 USER_JUHE_API_KEY');
    const name = normalizeSign(sign);
    if (!name) return null;
    const url = `${API_URL}?key=${encodeURIComponent(this.apiKey)}&consName=${encodeURIComponent(name)}&type=today`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`星座查询失败 HTTP ${res.status}`);
    const data = await res.json();
    if (data.error_code !== 0 || !data.result) {
      throw new Error(`聚合数据返回错误码 ${data.error_code}: ${data.reason || ''}`);
    }
    return data.result;
  }

  format(d) {
    if (!d) return '未找到该星座，请输入正确的星座名（如：白羊座、金牛座）。';
    const head = `${d.name} 今日运势（${d.date || ''} ${d.week || ''}）`;
    const lines = [
      `综合运势：${d.all || '暂无'}`,
      `爱情：${d.love || '暂无'}`,
      `事业：${d.work || '暂无'}`,
      `财运：${d.money || '暂无'}`,
      `健康：${d.health || '暂无'}`,
      `幸运数字：${d.number || '-'}　幸运颜色：${d.color || '-'}　速配星座：${d.QFriend || '-'}`,
    ];
    return `${head}\n${lines.join('\n')}`;
  }
}

import 'dotenv/config';

const LEGACY_GEO_API = 'https://geoapi.qweather.com/v2/city/lookup';
const LEGACY_NOW_API = 'https://devapi.qweather.com/v7/weather/now';

export const FORECAST_DAYS = {
  '今天': { offset: 0, days: 1 },
  '明天': { offset: 1, days: 1 },
  '后天': { offset: 2, days: 1 },
};

export function parseWeatherArg(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  for (const [key, v] of Object.entries(FORECAST_DAYS)) {
    if (s.endsWith(key)) {
      const city = s.slice(0, -key.length).trim();
      if (!city) return null;
      return { type: 'weather', arg: city, days: v.days, offset: v.offset };
    }
  }
  const mNum = s.match(/(?:未来)?(\d{1,2})\s*天?$/);
  if (mNum && parseInt(mNum[1], 10) >= 1) {
    const n = parseInt(mNum[1], 10);
    const city = s.slice(0, -mNum[0].length).trim();
    if (!city) return null;
    return { type: 'weather', arg: city, days: n, offset: 0 };
  }
  return { type: 'weather', arg: s };
}

export class WeatherClient {
  constructor() {
    this.apiKey = process.env.USER_QWEATHER_API_KEY || '';
    this.apiHost = (process.env.USER_QWEATHER_API_HOST || '').trim();
    this.enabled = Boolean(this.apiKey && this.apiHost);
  }

  baseUrl(geo) {
    if (this.apiHost) {
      const host = this.apiHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      return `https://${host}${geo ? '/geo/v2/city/lookup' : '/v7/weather/now'}`;
    }
    return geo ? LEGACY_GEO_API : LEGACY_NOW_API;
  }

  forecastUrl(days) {
    const ep = days <= 3 ? '3d' : days <= 7 ? '7d' : '15d';
    if (this.apiHost) {
      const host = this.apiHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      return `https://${host}/v7/weather/${ep}`;
    }
    return `https://devapi.qweather.com/v7/weather/${ep}`;
  }

  headers() {
    const h = {};
    if (this.apiHost) h['X-QW-Api-Key'] = this.apiKey;
    return h;
  }

  async fetchWeather(url, useQueryKey) {
    const fullUrl = useQueryKey ? `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(this.apiKey)}` : url;
    const res = await fetch(fullUrl, { headers: this.headers() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== '200') throw new Error(`和风返回码 ${data.code}`);
    return data;
  }

  async lookupCity(cityName) {
    if (!this.enabled) throw new Error('未配置 USER_QWEATHER_API_KEY 与 USER_QWEATHER_API_HOST');
    const url = `${this.baseUrl(true)}?location=${encodeURIComponent(cityName)}`;
    const data = await this.fetchWeather(url, !this.apiHost);
    if (!data.location || data.location.length === 0) return null;
    const loc = data.location[0];
    return { id: loc.id, name: loc.name, adm2: loc.adm2 };
  }

  async queryNow(locationId) {
    if (!this.enabled) throw new Error('未配置 USER_QWEATHER_API_KEY 与 USER_QWEATHER_API_HOST');
    const url = `${this.baseUrl(false)}?location=${locationId}`;
    const data = await this.fetchWeather(url, !this.apiHost);
    if (!data.now) return null;
    return data.now;
  }

  async queryCityWeather(cityName) {
    const city = await this.lookupCity(cityName);
    if (!city) return null;
    const now = await this.queryNow(city.id);
    if (!now) return null;
    return {
      cityName: city.name,
      admin: city.adm2,
      text: now.text,
      temp: now.temp,
      feelsLike: now.feelsLike,
      humidity: now.humidity,
      windDir: now.windDir,
      windScale: now.windScale,
    };
  }

  async queryForecast(locationId, days) {
    if (!this.enabled) throw new Error('未配置 USER_QWEATHER_API_KEY 与 USER_QWEATHER_API_HOST');
    const url = `${this.forecastUrl(days)}?location=${locationId}`;
    const data = await this.fetchWeather(url, !this.apiHost);
    if (!data.daily || data.daily.length === 0) return null;
    return data.daily.slice(0, days);
  }

  async queryCityForecast(cityName, days, offset = 0) {
    const city = await this.lookupCity(cityName);
    if (!city) return null;
    const total = offset + days;
    const daily = await this.queryForecast(city.id, total);
    if (!daily) return null;
    return {
      cityName: city.name,
      admin: city.adm2,
      days: daily.slice(offset, total),
    };
  }

  formatForecast(f) {
    if (!f || !f.days || f.days.length === 0) return '抱歉，未找到该城市的天气预报。';
    const place = f.admin && f.admin !== f.cityName ? `${f.admin} ${f.cityName}` : f.cityName;
    const labels = ['今天', '明天', '后天', '大后天'];
    const lines = f.days.map((d, i) => {
      const label = labels[i] || d.fxDate;
      const wind = d.windDirDay && d.windScaleDay ? `，${d.windDirDay} ${d.windScaleDay} 级` : '';
      return `${label}（${d.fxDate}）：${d.textDay}，${d.tempMin}~${d.tempMax}℃${wind}`;
    });
    return `${place} 未来${f.days.length}天预报：\n${lines.join('\n')}`;
  }

  format(w) {
    if (!w) return '抱歉，未找到该城市的天气信息。';
    const place = w.admin && w.admin !== w.cityName ? `${w.admin} ${w.cityName}` : w.cityName;
    return `${place} 当前天气：${w.text}，温度 ${w.temp}℃，体感 ${w.feelsLike}℃，湿度 ${w.humidity}%，${w.windDir} ${w.windScale} 级`;
  }
}

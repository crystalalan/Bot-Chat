import 'dotenv/config';

const LEGACY_GEO_API = 'https://geoapi.qweather.com/v2/city/lookup';
const LEGACY_NOW_API = 'https://devapi.qweather.com/v7/weather/now';

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

  format(w) {
    if (!w) return '抱歉，未找到该城市的天气信息。';
    const place = w.admin && w.admin !== w.cityName ? `${w.admin} ${w.cityName}` : w.cityName;
    return `${place} 当前天气：${w.text}，温度 ${w.temp}℃，体感 ${w.feelsLike}℃，湿度 ${w.humidity}%，${w.windDir} ${w.windScale} 级`;
  }
}

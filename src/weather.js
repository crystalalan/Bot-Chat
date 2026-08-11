import 'dotenv/config';

const GEO_API = 'https://geoapi.qweather.com/v2/city/lookup';
const NOW_API = 'https://devapi.qweather.com/v7/weather/now';

export class WeatherClient {
  constructor() {
    this.apiKey = process.env.USER_QWEATHER_API_KEY || '';
    this.enabled = Boolean(this.apiKey);
  }

  async lookupCity(cityName) {
    if (!this.enabled) throw new Error('未配置 USER_QWEATHER_API_KEY');
    const url = `${GEO_API}?location=${encodeURIComponent(cityName)}&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`城市查询失败 HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== '200' || !data.location || data.location.length === 0) {
      return null;
    }
    const loc = data.location[0];
    return { id: loc.id, name: loc.name, adm2: loc.adm2 };
  }

  async queryNow(locationId) {
    if (!this.enabled) throw new Error('未配置 USER_QWEATHER_API_KEY');
    const url = `${NOW_API}?location=${locationId}&key=${this.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`天气查询失败 HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== '200' || !data.now) return null;
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

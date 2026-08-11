import { WeatherClient } from '../weather.js';

const OLD_KEY = process.env.USER_QWEATHER_API_KEY;
const OLD_HOST = process.env.USER_QWEATHER_API_HOST;

afterEach(() => {
  if (OLD_KEY === undefined) delete process.env.USER_QWEATHER_API_KEY;
  else process.env.USER_QWEATHER_API_KEY = OLD_KEY;
  if (OLD_HOST === undefined) delete process.env.USER_QWEATHER_API_HOST;
  else process.env.USER_QWEATHER_API_HOST = OLD_HOST;
});

describe('WeatherClient.format', () => {
  test('格式化天气信息', () => {
    const client = new WeatherClient();
    const w = {
      cityName: '北京',
      admin: '北京市',
      text: '多云',
      temp: '25',
      feelsLike: '26',
      humidity: '60',
      windDir: '东南风',
      windScale: '3',
    };
    expect(client.format(w)).toContain('多云');
    expect(client.format(w)).toContain('25℃');
    expect(client.format(w)).toContain('湿度 60%');
  });

  test('空结果返回未找到提示', () => {
    const client = new WeatherClient();
    expect(client.format(null)).toContain('未找到该城市');
  });

  test('admin 与城市名相同时不重复', () => {
    const client = new WeatherClient();
    const w = {
      cityName: '上海',
      admin: '上海',
      text: '晴',
      temp: '30',
      feelsLike: '31',
      humidity: '50',
      windDir: '南风',
      windScale: '2',
    };
    expect(client.format(w)).not.toContain('上海 上海');
    expect(client.format(w)).toContain('上海 当前天气');
  });
});

describe('WeatherClient 配置与 URL 构建', () => {
  test('未配置 Key 或 Host 时 enabled 为 false', () => {
    process.env.USER_QWEATHER_API_KEY = '';
    process.env.USER_QWEATHER_API_HOST = '';
    const client = new WeatherClient();
    expect(client.enabled).toBe(false);
  });

  test('配置 Key 但未配置 Host 时 enabled 为 false', () => {
    process.env.USER_QWEATHER_API_KEY = 'fake-key';
    process.env.USER_QWEATHER_API_HOST = '';
    const client = new WeatherClient();
    expect(client.enabled).toBe(false);
  });

  test('配置 Key 与 Host 时 enabled 为 true', () => {
    process.env.USER_QWEATHER_API_KEY = 'fake-key';
    process.env.USER_QWEATHER_API_HOST = 'abc1234.def.qweatherapi.com';
    const client = new WeatherClient();
    expect(client.enabled).toBe(true);
  });

  test('使用 API Host 构建新版 GeoAPI 路径并走 header 认证', () => {
    process.env.USER_QWEATHER_API_KEY = 'fake-key';
    process.env.USER_QWEATHER_API_HOST = 'abc1234.def.qweatherapi.com';
    const client = new WeatherClient();
    expect(client.baseUrl(true)).toBe('https://abc1234.def.qweatherapi.com/geo/v2/city/lookup');
    expect(client.baseUrl(false)).toBe('https://abc1234.def.qweatherapi.com/v7/weather/now');
    expect(client.headers()).toEqual({ 'X-QW-Api-Key': 'fake-key' });
  });

  test('未配置 Host 时回退旧版域名', () => {
    process.env.USER_QWEATHER_API_KEY = 'fake-key';
    process.env.USER_QWEATHER_API_HOST = '';
    const client = new WeatherClient();
    expect(client.baseUrl(true)).toBe('https://geoapi.qweather.com/v2/city/lookup');
    expect(client.baseUrl(false)).toBe('https://devapi.qweather.com/v7/weather/now');
    expect(client.headers()).toEqual({});
  });

  test('未配置 Key 时 lookupCity 抛错', async () => {
    process.env.USER_QWEATHER_API_KEY = '';
    process.env.USER_QWEATHER_API_HOST = '';
    const client = new WeatherClient();
    await expect(client.lookupCity('北京')).rejects.toThrow(/USER_QWEATHER_API_KEY/);
  });
});

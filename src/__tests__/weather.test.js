import { WeatherClient, parseWeatherArg } from '../weather.js';

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

describe('parseWeatherArg', () => {
  test('无天数参数返回普通天气指令', () => {
    expect(parseWeatherArg('北京')).toEqual({ type: 'weather', arg: '北京' });
  });

  test('解析明天/后天', () => {
    expect(parseWeatherArg('北京 明天')).toEqual({ type: 'weather', arg: '北京', days: 1, offset: 1 });
    expect(parseWeatherArg('北京 后天')).toEqual({ type: 'weather', arg: '北京', days: 1, offset: 2 });
    expect(parseWeatherArg('北京 今天')).toEqual({ type: 'weather', arg: '北京', days: 1, offset: 0 });
  });

  test('解析 N 天', () => {
    expect(parseWeatherArg('北京 3天')).toEqual({ type: 'weather', arg: '北京', days: 3, offset: 0 });
    expect(parseWeatherArg('北京 未来5天')).toEqual({ type: 'weather', arg: '北京', days: 5, offset: 0 });
    expect(parseWeatherArg('上海 7')).toEqual({ type: 'weather', arg: '上海', days: 7, offset: 0 });
  });

  test('仅有天数无城市返回 null', () => {
    expect(parseWeatherArg('明天')).toBeNull();
    expect(parseWeatherArg('3天')).toBeNull();
    expect(parseWeatherArg('')).toBeNull();
    expect(parseWeatherArg(null)).toBeNull();
  });
});

describe('WeatherClient 预报功能', () => {
  test('forecastUrl 按天数选择 3d/7d/15d 接口', () => {
    process.env.USER_QWEATHER_API_KEY = 'fake-key';
    process.env.USER_QWEATHER_API_HOST = 'abc1234.def.qweatherapi.com';
    const client = new WeatherClient();
    expect(client.forecastUrl(1)).toBe('https://abc1234.def.qweatherapi.com/v7/weather/3d');
    expect(client.forecastUrl(3)).toBe('https://abc1234.def.qweatherapi.com/v7/weather/3d');
    expect(client.forecastUrl(7)).toBe('https://abc1234.def.qweatherapi.com/v7/weather/7d');
    expect(client.forecastUrl(10)).toBe('https://abc1234.def.qweatherapi.com/v7/weather/15d');
  });

  test('queryCityForecast 查询并截取指定天数', async () => {
    process.env.USER_QWEATHER_API_KEY = 'fake-key';
    process.env.USER_QWEATHER_API_HOST = 'abc1234.def.qweatherapi.com';
    const client = new WeatherClient();
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes('/geo/v2/city/lookup')) {
        return {
          ok: true,
          json: async () => ({ code: '200', location: [{ id: '101010100', name: '北京', adm2: '北京市' }] }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          code: '200',
          daily: [
            { fxDate: '2026-08-12', textDay: '晴', tempMin: '20', tempMax: '30' },
            { fxDate: '2026-08-13', textDay: '多云', tempMin: '21', tempMax: '31' },
            { fxDate: '2026-08-14', textDay: '雨', tempMin: '22', tempMax: '28' },
          ],
        }),
      };
    };
    const city = await client.queryCityForecast('北京', 2, 1);
    expect(city.cityName).toBe('北京');
    expect(city.days.length).toBe(2);
    expect(city.days[0].fxDate).toBe('2026-08-13');
    global.fetch = originalFetch;
  });

  test('formatForecast 格式化预报信息', () => {
    const client = new WeatherClient();
    const f = {
      cityName: '北京',
      admin: '北京市',
      days: [
        { fxDate: '2026-08-12', textDay: '晴', tempMin: '20', tempMax: '30', windDirDay: '东南风', windScaleDay: '3' },
        { fxDate: '2026-08-13', textDay: '多云', tempMin: '21', tempMax: '31', windDirDay: '南风', windScaleDay: '2' },
      ],
    };
    const out = client.formatForecast(f);
    expect(out).toContain('未来2天预报');
    expect(out).toContain('今天（2026-08-12）：晴，20~30℃');
    expect(out).toContain('明天（2026-08-13）：多云，21~31℃');
    expect(out).toContain('东南风 3 级');
  });

  test('formatForecast 空结果返回未找到提示', () => {
    const client = new WeatherClient();
    expect(client.formatForecast(null)).toContain('未找到该城市');
  });
});

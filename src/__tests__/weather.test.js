import { WeatherClient } from '../weather.js';

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

describe('WeatherClient API 调用', () => {
  test('未配置 Key 时 enabled 为 false', () => {
    const client = new WeatherClient();
    expect(client.enabled).toBe(Boolean(process.env.USER_QWEATHER_API_KEY));
  });

  test('未配置 Key 时 lookupCity 抛错', async () => {
    const client = new WeatherClient();
    if (!client.enabled) {
      await expect(client.lookupCity('北京')).rejects.toThrow(/USER_QWEATHER_API_KEY/);
    }
  });
});

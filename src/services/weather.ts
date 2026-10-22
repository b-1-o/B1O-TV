import type { WeatherSnapshot } from '../types';

interface GeoResult {
  results?: Array<{ name: string; latitude: number; longitude: number; country?: string }>;
}

interface ForecastResult {
  current?: { temperature_2m: number; weather_code: number; is_day: number };
}

export function describeWeather(code: number): string {
  if (code === 0) return 'Ясно';
  if (code <= 2) return 'Переменная облачность';
  if (code === 3) return 'Облачно';
  if (code === 45 || code === 48) return 'Туман';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Морось';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Дождь';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Снег';
  if ([95, 96, 99].includes(code)) return 'Гроза';
  return 'Погода';
}

export async function fetchWeather(city: string, signal?: AbortSignal): Promise<WeatherSnapshot> {
  const cleanCity = city.trim();
  if (!cleanCity) throw new Error('Укажи город в настройках.');

  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geoUrl.search = new URLSearchParams({
    name: cleanCity,
    count: '1',
    language: 'ru',
    format: 'json',
  }).toString();

  const geoResponse = await fetch(geoUrl, { signal });
  if (!geoResponse.ok) throw new Error('Не удалось найти город.');
  const geo = (await geoResponse.json()) as GeoResult;
  const place = geo.results?.[0];
  if (!place) throw new Error('Город не найден. Проверь название в настройках.');

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,weather_code,is_day',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
  }).toString();

  const forecastResponse = await fetch(forecastUrl, { signal });
  if (!forecastResponse.ok) throw new Error('Сервис погоды временно недоступен.');
  const forecast = (await forecastResponse.json()) as ForecastResult;
  if (!forecast.current) throw new Error('Сервис погоды не вернул текущие данные.');

  return {
    city: place.name,
    temperatureC: forecast.current.temperature_2m,
    code: forecast.current.weather_code,
    isDay: forecast.current.is_day === 1,
  };
}
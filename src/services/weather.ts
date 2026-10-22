import type { WeatherSnapshot } from '../types';

interface GeoResult {
  results?: Array<{ name: string; latitude: number; longitude: number; country?: string }>;
}

interface ForecastResult {
  current?: { temperature_2m: number; weather_code: number; is_day: number };
}

export function describeWeather(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Weather';
}

export async function fetchWeather(city: string, signal?: AbortSignal): Promise<WeatherSnapshot> {
  const cleanCity = city.trim();
  if (!cleanCity) throw new Error('Enter a city in Settings.');

  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geoUrl.search = new URLSearchParams({
    name: cleanCity,
    count: '1',
    language: 'en',
    format: 'json',
  }).toString();

  const geoResponse = await fetch(geoUrl, { signal });
  if (!geoResponse.ok) throw new Error('Could not look up the city.');
  const geo = (await geoResponse.json()) as GeoResult;
  const place = geo.results?.[0];
  if (!place) throw new Error('City not found. Check the name in Settings.');

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,weather_code,is_day',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
  }).toString();

  const forecastResponse = await fetch(forecastUrl, { signal });
  if (!forecastResponse.ok) throw new Error('Weather service is temporarily unavailable.');
  const forecast = (await forecastResponse.json()) as ForecastResult;
  if (!forecast.current) throw new Error('Weather service returned no current conditions.');

  return {
    city: place.name,
    temperatureF: forecast.current.temperature_2m,
    code: forecast.current.weather_code,
    isDay: forecast.current.is_day === 1,
  };
}
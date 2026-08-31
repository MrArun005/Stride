/* Weather stamps via Open-Meteo — free, keyless. Recent runs come from the
   forecast API (past_days), older ones from the archive. */
export interface RunWeather { t: number; code: number; wind: number }

const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};
export const weatherLabel = (code: number) => WMO[code] || 'Unknown';
export const weatherEmoji = (code: number) =>
  code === 0 ? '☀️' : code <= 2 ? '🌤️' : code === 3 ? '☁️' : code <= 48 ? '🌫️'
    : code <= 67 ? '🌧️' : code <= 77 ? '🌨️' : code <= 82 ? '🌦️' : code <= 86 ? '🌨️' : '⛈️';

export async function fetchWeather(lat: number, lng: number, ts: number): Promise<RunWeather | null> {
  try {
    const d = new Date(ts);
    const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const ageDays = (Date.now() - ts) / 864e5;
    const base = ageDays < 80
      ? `https://api.open-meteo.com/v1/forecast?past_days=${Math.min(92, Math.ceil(ageDays) + 1)}`
      : `https://archive-api.open-meteo.com/v1/archive?start_date=${day}&end_date=${day}`;
    const url = `${base}&latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}`
      + '&hourly=temperature_2m,weather_code,wind_speed_10m&timezone=auto';
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json() as { hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[]; wind_speed_10m: number[] } };
    const h = j.hourly;
    if (!h || !h.time) return null;
    const hourIso = day + 'T' + String(d.getHours()).padStart(2, '0') + ':00';
    const i = h.time.indexOf(hourIso);
    if (i < 0 || h.temperature_2m[i] == null) return null;
    return { t: Math.round(h.temperature_2m[i]), code: h.weather_code[i], wind: Math.round(h.wind_speed_10m[i]) };
  } catch { return null; }
}

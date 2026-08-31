import { M_PER_UNIT } from './settings';

export const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDur(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}

export function fmtPace(secPerUnit: number): string {
  if (!isFinite(secPerUnit) || secPerUnit <= 0 || secPerUnit > 3600) return '--';
  const m = Math.floor(secPerUnit / 60), s = Math.round(secPerUnit % 60);
  return (s === 60) ? (m + 1) + ':00' : m + ':' + pad(s);
}

export function fmtDist(meters: number, dp?: number): string {
  return (meters / M_PER_UNIT()).toFixed(dp === undefined ? 2 : dp);
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function startOfWeek(ts: number): number {   // Monday
  const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return d.getTime();
}

export function relDate(ts: number): string {
  const d = new Date(ts), now = new Date();
  const k = dayKey(ts), today = dayKey(now.getTime());
  const y = new Date(now.getTime() - 864e5);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (k === today) return 'Today · ' + time;
  if (k === dayKey(y.getTime())) return 'Yesterday · ' + time;
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + time;
}

export function speakDur(sec: number): string {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  const o: string[] = [];
  if (h) o.push(h + ' hour' + (h > 1 ? 's' : ''));
  if (m) o.push(m + ' minute' + (m > 1 ? 's' : ''));
  if (s) o.push(s + ' second' + (s > 1 ? 's' : ''));
  return o.join(' ') || '0 seconds';
}

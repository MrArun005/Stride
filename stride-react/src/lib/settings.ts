import type { Settings } from './types';

export const DEFAULTS: Settings = {
  units: 'km', voice: true, autoPause: true, weeklyGoal: 20, monthlyGoal: 0, annualGoal: 0,
  weightKg: 70, mapStyle: 'dark', keepAwake: true, defaultShoeId: null,
};

export const S: Settings = Object.assign({}, DEFAULTS,
  JSON.parse(localStorage.getItem('stride.settings') || '{}'));

export const saveSettings = () => localStorage.setItem('stride.settings', JSON.stringify(S));

export const M_PER_UNIT = () => S.units === 'km' ? 1000 : 1609.344;
export const UNIT = () => S.units === 'km' ? 'km' : 'mi';
export const PACE_UNIT = () => S.units === 'km' ? '/km' : '/mi';

export const REDUCED = typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Pt {
  lat: number; lng: number;
  t: number;              // wall-clock ms
  d: number;              // cumulative metres
  m: number;              // cumulative moving ms
  alt: number | null;
  acc?: number;
}

export interface Split { n: number; dur: number; pace: number; at?: number }

export interface Run {
  id: number;
  startedAt: number; endedAt: number;
  dist: number;           // metres
  movingSec: number; elapsedSec: number;
  points: Pt[];
  splits: Split[];
  elevGain: number; elevLoss: number;
  unit: string; name: string;
  partialSplit?: { frac: number; dur: number } | null;
  shoeId?: number | null;
  weather?: { t: number; code: number; wind: number } | null;
}

export interface Segment {
  id: number; name: string;
  points: { lat: number; lng: number }[];
  length: number; createdAt: number; fromRunId: number;
  starred?: boolean;
}

export interface Route {
  id: number; name: string;
  points: { lat: number; lng: number }[];
  length: number; createdAt: number;
}

export interface RunPhoto {
  id: string; runId: number; ts: number; blob: Blob;
}

export interface Effort {
  id: string; segId: number; runId: number;
  startedAt: number; dur: number; startD: number; endD: number;
}

export interface Shoe {
  id: number; name: string; addedAt: number; retired: boolean;
}

export interface Settings {
  units: 'km' | 'mi';
  voice: boolean;
  autoPause: boolean;
  weeklyGoal: number;
  monthlyGoal: number;      // 0 = off
  annualGoal: number;       // 0 = off
  weightKg: number;
  mapStyle: 'dark' | 'street';
  keepAwake: boolean;
  defaultShoeId?: number | null;
}

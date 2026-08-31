/* IndexedDB wrapper — same schema as the vanilla app, plus a shoes store. */
const STORES = ['runs', 'active', 'segments', 'efforts', 'shoes'] as const;
export type StoreName = typeof STORES[number];

let _p: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (_p) return _p;
  _p = new Promise((res, rej) => {
    const r = indexedDB.open('stride', 3);
    r.onupgradeneeded = e => {
      const db = (e.target as IDBOpenDBRequest).result;
      for (const s of STORES)
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return _p;
}

async function tx(store: StoreName, mode: IDBTransactionMode) {
  const db = await open();
  return db.transaction(store, mode).objectStore(store);
}

export const DB = {
  async put(store: StoreName, val: unknown): Promise<void> {
    const os = await tx(store, 'readwrite');
    return new Promise((res, rej) => {
      const q = os.put(val); q.onsuccess = () => res(); q.onerror = () => rej(q.error);
    });
  },
  async del(store: StoreName, id: IDBValidKey): Promise<void> {
    const os = await tx(store, 'readwrite');
    return new Promise(res => { os.delete(id).onsuccess = () => res(); });
  },
  async all<T>(store: StoreName): Promise<T[]> {
    const os = await tx(store, 'readonly');
    return new Promise(res => {
      const q = os.getAll();
      q.onsuccess = () => res((q.result || []) as T[]);
      q.onerror = () => res([]);
    });
  },
  async get<T>(store: StoreName, id: IDBValidKey): Promise<T | null> {
    const os = await tx(store, 'readonly');
    return new Promise(res => {
      const q = os.get(id);
      q.onsuccess = () => res((q.result ?? null) as T | null);
      q.onerror = () => res(null);
    });
  },
};

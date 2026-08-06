// Cache local persistente em IndexedDB.
//
// O localStorage tem ~5 MB por origem — com mensagens que carregam imagens e
// áudios em dataURL a cota estoura e o cache acaba sendo descartado, obrigando
// o app a baixar todo o histórico a cada login. O IndexedDB aguenta centenas de
// MB e guarda objetos estruturados, então o histórico fica salvo entre sessões
// (como o WhatsApp Web) e só o que chegou enquanto o usuário estava fora
// precisa ser sincronizado.

const DB_NAME = "svlogistica-cache";
const STORE = "kv";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function idbDel(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
  } catch {
    /* noop */
  }
}

/** Apaga todo o cache local (usado quando a conta é bloqueada/limpa). */
export async function idbClearAll(): Promise<void> {
  if (typeof window === "undefined" || !("indexedDB" in window)) return;
  dbPromise = null;
  try {
    window.indexedDB.deleteDatabase(DB_NAME);
  } catch {
    /* noop */
  }
}

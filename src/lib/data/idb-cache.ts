// Cache local persistente em IndexedDB.
//
// O localStorage tem ~5 MB por origem — com mensagens que carregam imagens e
// áudios em dataURL a cota estoura e o cache acaba sendo descartado, obrigando
// o app a baixar todo o histórico a cada login. O IndexedDB aguenta centenas de
// MB e guarda objetos estruturados, então o histórico fica salvo entre sessões
// (como o WhatsApp Web) e só o que chegou enquanto o usuário estava fora
// precisa ser sincronizado.
//
// IMPORTANTE: toda operação abaixo tem TIMEOUT. Em alguns dispositivos o
// IndexedDB pode ficar travado (outra aba segurando o lock, cota excedida,
// base corrompida) e a requisição nunca resolve nem falha — isso congelava a
// tela em "Carregando conversa...". Com timeout o app simplesmente ignora o
// cache e segue buscando do servidor.

const DB_NAME = "svlogistica-cache";
const STORE = "kv";
const DB_VERSION = 1;

const OPEN_TIMEOUT = 3000;
const READ_TIMEOUT = 3000;
const WRITE_TIMEOUT = 6000;

let dbPromise: Promise<IDBDatabase | null> | null = null;
/** Depois de um travamento, desliga o cache local pelo resto da sessão. */
let disabled = false;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    promise
      .then((value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      });
  });
}

function openDb(): Promise<IDBDatabase | null> {
  if (disabled) return Promise.resolve(null);
  if (typeof window === "undefined" || !("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  const raw = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => {
        const db = req.result;
        // Se outra aba pedir upgrade/exclusão, solta a conexão em vez de travar.
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
            /* noop */
          }
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  dbPromise = withTimeout(raw, OPEN_TIMEOUT, null).then((db) => {
    if (!db) {
      // Abertura travou ou falhou: desiste do cache e tenta limpar a base.
      disabled = true;
      dbPromise = null;
      try {
        window.indexedDB.deleteDatabase(DB_NAME);
      } catch {
        /* noop */
      }
    }
    return db;
  });
  return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  const read = new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
      tx.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return withTimeout(read, READ_TIMEOUT, null);
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  const write = new Promise<boolean>((resolve) => {
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
  return withTimeout(write, WRITE_TIMEOUT, false);
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

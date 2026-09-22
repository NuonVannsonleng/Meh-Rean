/**
 * Uploaded files are kept in IndexedDB so large photos, videos and documents
 * survive a refresh without hitting the small localStorage quota.
 */

const DB_NAME = "meh-rean-files";
const STORE = "files";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error ?? new Error("IndexedDB unavailable"));
      };
    });
  }
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
      }),
  );
}

export async function putFile(id: string, blob: Blob): Promise<void> {
  await run("readwrite", (store) => store.put(blob, id));
}

export async function getFile(id: string): Promise<Blob | null> {
  const result = await run<unknown>("readonly", (store) => store.get(id));
  return result instanceof Blob ? result : null;
}

export async function deleteFiles(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => run("readwrite", (store) => store.delete(id))));
}

import type { ApiRequest } from '../types';

const DB_NAME = 'ApiDebuggerDB';
const DB_VERSION = 2; // Incremented version for schema change
const STORE_NAME = 'requests';

let db: IDBDatabase | null = null;

export function initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve();
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            let store: IDBObjectStore;
            
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                store = dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
            } else {
                store = (event.target as IDBOpenDBRequest).transaction!.objectStore(STORE_NAME);
            }

            // Add index for chronological sorting
            if (!store.indexNames.contains('timestamp')) {
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            db = (event.target as IDBOpenDBRequest).result;
            resolve();
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', (event.target as IDBOpenDBRequest).error);
            reject('Error opening IndexedDB.');
        };
    });
}

function getStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!db) {
        throw new Error('Database is not initialized.');
    }
    const transaction = db.transaction(STORE_NAME, mode);
    return transaction.objectStore(STORE_NAME);
}

export function addRequestToDb(request: ApiRequest): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const store = getStore('readwrite');
            const req = store.put(request);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
}

export function getAllRequestsFromDb(): Promise<ApiRequest[]> {
    return new Promise((resolve, reject) => {
        try {
            const store = getStore('readonly');
            // Use index to ensure chronological order
            const index = store.index('timestamp');
            const req = index.getAll();
            
            req.onsuccess = () => {
                // Re-hydrate Date objects
                const requests = req.result.map(r => ({...r, timestamp: new Date(r.timestamp)}));
                resolve(requests);
            }
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
}

export function clearDb(): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            const store = getStore('readwrite');
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        } catch (e) {
            reject(e);
        }
    });
}

export function trimDb(maxRequests: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
        try {
            const store = getStore('readwrite');
            const countReq = store.count();
            
            countReq.onsuccess = () => {
                const count = countReq.result;
                if (count > maxRequests) {
                    // Use timestamp index to delete oldest records
                    const index = store.index('timestamp');
                    const cursorReq = index.openCursor(null, 'next'); // oldest first
                    let itemsToDelete = count - maxRequests;
                    
                    cursorReq.onsuccess = (e) => {
                        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
                        if (cursor && itemsToDelete > 0) {
                            cursor.delete();
                            itemsToDelete--;
                            cursor.continue();
                        } else {
                            resolve();
                        }
                    };
                    cursorReq.onerror = () => reject(cursorReq.error);
                } else {
                    resolve();
                }
            };
            countReq.onerror = () => reject(countReq.error);
        } catch (e) {
            reject(e);
        }
    });
}

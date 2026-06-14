const DB_NAME = 'smart-learning-assistant'
const STORE_NAME = 'offline-documents'
const DB_VERSION = 1

function openDatabase() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available'))
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'))
  })
}

function withStore(mode, handler) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = handler(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'))
  }))
}

export function getOfflineDocument(id) {
  return withStore('readonly', (store) => store.get(id))
}

export function saveOfflineDocument({ id, blob, metadata, mimeType }) {
  return withStore('readwrite', (store) => store.put({
    id,
    blob,
    mimeType,
    metadata,
    savedAt: new Date().toISOString()
  }))
}

export function deleteOfflineDocument(id) {
  return withStore('readwrite', (store) => store.delete(id))
}

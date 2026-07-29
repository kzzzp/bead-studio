import { validateProjectSnapshot, type ProjectSnapshot } from './projectFormat.ts'

const DATABASE_NAME = 'bead-studio-projects'
const STORE_NAME = 'snapshots'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('本地工程数据库打开失败'))
  })
}

function runRequest<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))
    let result: T
    request.onsuccess = () => { result = request.result }
    request.onerror = () => { database.close(); reject(request.error ?? new Error('本地工程操作失败')) }
    transaction.oncomplete = () => { database.close(); resolve(result) }
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('本地工程写入失败')) }
    transaction.onerror = () => undefined
  }))
}

export async function saveProjectSnapshot(snapshot: ProjectSnapshot) {
  await runRequest('readwrite', (store) => store.put(validateProjectSnapshot(snapshot)))
}

export async function listProjectSnapshots() {
  const projects = await runRequest('readonly', (store) => store.getAll())
  return projects.map(validateProjectSnapshot).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export async function deleteProjectSnapshot(id: string) {
  await runRequest('readwrite', (store) => store.delete(id))
}

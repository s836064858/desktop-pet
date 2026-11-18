interface DeviceEnvelope {
  key: CryptoKey
  iv: Uint8Array<ArrayBuffer>
  ciphertext: ArrayBuffer
}

function transaction<Result>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('sproutkin-device', 1)
    open.onupgradeneeded = () => open.result.createObjectStore('credentials')
    open.onerror = () => reject(new Error('无法打开设备凭证存储。'))
    open.onblocked = () => reject(new Error('设备凭证存储正被其他窗口占用。'))
    open.onsuccess = () => {
      const database = open.result
      try {
        const current = database.transaction('credentials', mode)
        const request = action(current.objectStore('credentials'))
        current.oncomplete = () => { database.close(); resolve(request.result) }
        current.onabort = () => { database.close(); reject(new Error('无法读写设备凭证。')) }
      } catch (error) {
        database.close()
        reject(error)
      }
    }
  })
}

export async function readAiToken(): Promise<string | null> {
  const entry = await transaction<DeviceEnvelope | undefined>('readonly', (store) => store.get('device'))
  if (!entry) return null
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: entry.iv }, entry.key, entry.ciphertext)
  return new TextDecoder().decode(clear)
}

export async function clearAiToken(): Promise<void> {
  await transaction('readwrite', (store) => store.delete('device'))
}

export async function ensureAiToken(): Promise<string> {
  const saved = await readAiToken()
  if (saved) return saved
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, '0')).join('')
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  await transaction('readwrite', (store) => store.put({ key, iv, ciphertext } satisfies DeviceEnvelope, 'device'))
  return token
}

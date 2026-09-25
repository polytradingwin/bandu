// IndexedDB belongs to the extension origin; website content scripts cannot read it.
async function credential(value, slot = 'key') {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('bandu-private', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('config');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本地密钥存储。'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('config', value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('config');
      const request = value === undefined ? store.get(slot) : value ? store.put(value, slot) : store.delete(slot);
      tx.oncomplete = () => resolve(value === undefined ? request.result : undefined);
      tx.onerror = () => reject(new Error('无法保存本地密钥。'));
    });
  } finally { db.close(); }
}

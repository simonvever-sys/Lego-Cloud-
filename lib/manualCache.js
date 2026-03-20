const DB_NAME = "lego-cloud-manual-cache";
const STORE_NAME = "manuals";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB ikke tilgængelig"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction(mode, executor) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = executor(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedManualPdf(setNumber) {
  try {
    return await runTransaction("readonly", (store) => store.get(setNumber));
  } catch {
    return null;
  }
}

export async function cacheManualPdf(setNumber, bytes) {
  try {
    await runTransaction("readwrite", (store) => store.put(bytes, setNumber));
  } catch {
    // Cache er valgfri.
  }
}

export async function cacheUploadedManual(file) {
  const setNumber = String(file.name || "").replace(/\.pdf$/i, "").trim();
  if (!setNumber) {
    return null;
  }

  const bytes = await file.arrayBuffer();
  await cacheManualPdf(setNumber, bytes);
  return setNumber;
}

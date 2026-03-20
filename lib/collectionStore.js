import {
  clearCollectionTable,
  deleteCollectionSet,
  fetchCollectionSets,
  hasSupabaseConfig,
  insertCollectionSet,
  upsertCollectionSet
} from "./supabase.js";

const LOCAL_COLLECTION_KEY = "lego-app:collection-sets";
const COLLECTION_RESET_KEY = "lego-app:collection-reset-v1";

function readLocalCollection() {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(LOCAL_COLLECTION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalCollection(records) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(LOCAL_COLLECTION_KEY, JSON.stringify(records));
}

function markResetDone() {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(COLLECTION_RESET_KEY, "done");
}

function hasResetRun() {
  if (typeof localStorage === "undefined") {
    return false;
  }

  return localStorage.getItem(COLLECTION_RESET_KEY) === "done";
}

export function getInitialCollection() {
  return readLocalCollection();
}

export async function loadCollection() {
  if (hasSupabaseConfig()) {
    try {
      const remote = await fetchCollectionSets();
      writeLocalCollection(remote);
      return remote;
    } catch {
      return readLocalCollection();
    }
  }

  return readLocalCollection();
}

export function persistCollection(records) {
  writeLocalCollection(records);
  return records;
}

export async function saveCollectionSet(setItem, previousSetItem = null) {
  const previousKey =
    previousSetItem?.collectionKey ||
    `${previousSetItem?.ownerProfile || "shared"}:${previousSetItem?.rebrickableSetNumber || previousSetItem?.setNumber || ""}`;
  const targetKey = previousSetItem ? previousKey : setItem.collectionKey || setItem.rebrickableSetNumber || setItem.setNumber;
  const records = updateCollectionSet(targetKey, () => setItem);
  const ownerChanged =
    previousSetItem &&
    (previousSetItem.ownerProfile !== setItem.ownerProfile ||
      (previousSetItem.rebrickableSetNumber || previousSetItem.setNumber) !==
        (setItem.rebrickableSetNumber || setItem.setNumber));

  try {
    if (ownerChanged) {
      await deleteCollectionSet(previousSetItem);
      await insertCollectionSet(setItem);
      return records;
    }

    await upsertCollectionSet(setItem);
  } catch {
    try {
      await insertCollectionSet(setItem);
    } catch {
      // Lokal fallback er allerede gemt.
    }
  }

  return records;
}

export function updateCollectionSet(setNumber, updater) {
  const records = readLocalCollection();
  const nextRecords = records.map((item) => {
    const itemKey = item.collectionKey || `${item.ownerProfile || "shared"}:${item.rebrickableSetNumber || item.setNumber}`;
    if (
      itemKey !== setNumber &&
      (item.rebrickableSetNumber || item.setNumber) !== setNumber &&
      item.setNumber !== setNumber
    ) {
      return item;
    }

    const nextItem = typeof updater === "function" ? updater(item) : { ...item, ...updater };
    return {
      ...nextItem,
      collectionKey:
        nextItem.collectionKey ||
        `${nextItem.ownerProfile || "shared"}:${nextItem.rebrickableSetNumber || nextItem.setNumber}`
    };
  });

  writeLocalCollection(nextRecords);
  return nextRecords;
}

export async function resetCollectionOnce() {
  if (hasResetRun()) {
    return readLocalCollection();
  }

  markResetDone();
  return readLocalCollection();
}

export async function resetCollection() {
  writeLocalCollection([]);

  try {
    await clearCollectionTable();
  } catch {
    // Lokal nulstilling er nok, hvis Supabase ikke er sat op.
  }

  markResetDone();
  return [];
}

export async function addSetToCollection(setItem) {
  const records = readLocalCollection();
  const ownerProfile = setItem.ownerProfile || "shared";
  const recordKey = `${ownerProfile}:${setItem.rebrickableSetNumber || setItem.setNumber}`;
  const exists = records.some(
    (item) =>
      (item.collectionKey || `${item.ownerProfile || "shared"}:${item.rebrickableSetNumber || item.setNumber}`) ===
      recordKey
  );

  if (!exists) {
    records.push({
      ...setItem,
      ownerProfile,
      collectionKey: recordKey
    });
    writeLocalCollection(records);
  }

  try {
    await insertCollectionSet({
      ...setItem,
      ownerProfile,
      collectionKey: recordKey
    });
  } catch (error) {
    console.error("Kunne ikke gemme saet i cloud.", error);
  }

  return records;
}

export async function replaceCollection(records) {
  writeLocalCollection(records);

  if (!hasSupabaseConfig()) {
    return records;
  }

  try {
    await clearCollectionTable();
    await Promise.all(records.map((record) => insertCollectionSet(record)));
  } catch {
    // Lokal import er stadig gemt.
  }

  return records;
}

export async function removeCollectionSet(setItem) {
  const itemKey =
    setItem.collectionKey ||
    `${setItem.ownerProfile || "shared"}:${setItem.rebrickableSetNumber || setItem.setNumber}`;
  const records = readLocalCollection().filter((item) => {
    const recordKey =
      item.collectionKey || `${item.ownerProfile || "shared"}:${item.rebrickableSetNumber || item.setNumber}`;
    return recordKey !== itemKey;
  });

  writeLocalCollection(records);

  try {
    await deleteCollectionSet(setItem);
  } catch {
    // Lokal fallback er allerede gemt.
  }

  return records;
}

import { clearMissingPartsTable, decrementMissingPart, fetchMissingParts, upsertMissingPart } from "./supabase.js";

const LOCAL_STORAGE_KEY = "lego-app:missing-parts";

function readLocalMissingParts() {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalMissingParts(records) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
}

export async function loadMissingParts() {
  try {
    const records = await fetchMissingParts();
    return Array.isArray(records) ? records : [];
  } catch {
    return readLocalMissingParts();
  }
}

export async function addMissingPart(record) {
  try {
    await upsertMissingPart(record);
    return loadMissingParts();
  } catch {
    const records = readLocalMissingParts();
    const index = records.findIndex(
      (item) =>
        item.set_number === record.set_number &&
        (item.owner_profile || "shared") === (record.owner_profile || "shared") &&
        item.part_num === record.part_num &&
        item.color === record.color
    );

    if (index >= 0) {
      records[index].quantity_missing += record.quantity_missing;
      records[index].part_name = record.part_name;
      records[index].part_image = record.part_image;
    } else {
      records.push(record);
    }

    writeLocalMissingParts(records);
    return records;
  }
}

export async function resolveMissingPart(record) {
  try {
    return await decrementMissingPart(record);
  } catch {
    const records = readLocalMissingParts();
    const index = records.findIndex(
      (item) =>
        item.set_number === record.set_number &&
        (item.owner_profile || "shared") === (record.owner_profile || "shared") &&
        item.part_num === record.part_num &&
        item.color === record.color
    );

    if (index < 0) {
      return records;
    }

    records[index].quantity_missing = Math.max(0, records[index].quantity_missing - (record.quantity_missing || 1));

    if (records[index].quantity_missing === 0) {
      records.splice(index, 1);
    }

    writeLocalMissingParts(records);
    return records;
  }
}

export async function resetMissingParts() {
  writeLocalMissingParts([]);

  try {
    await clearMissingPartsTable();
  } catch {
    // Lokal nulstilling er nok, hvis Supabase ikke er sat op.
  }

  return [];
}

const PICKUP_STORAGE_KEY = "lego-app:pickup-list";

function readPickupList() {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(PICKUP_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePickupList(items) {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(PICKUP_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignorer skrivefejl til localStorage.
  }
}

function buildPickupId(setItem) {
  const ownerProfile = setItem?.ownerProfile || "shared";
  const setNumber = setItem?.rebrickableSetNumber || setItem?.setNumber || "";
  return `${ownerProfile}:${setNumber}`;
}

function normalizePickupItem(setItem, existing = null) {
  const now = new Date().toISOString();
  const rebrickableSetNumber = setItem.rebrickableSetNumber || setItem.setNumber || "";
  return {
    id: buildPickupId(setItem),
    ownerProfile: setItem.ownerProfile || "shared",
    setNumber: String(setItem.setNumber || "").split("-")[0],
    rebrickableSetNumber,
    name: setItem.name || `LEGO sæt ${String(rebrickableSetNumber || "").split("-")[0]}`,
    image: setItem.image || "",
    storageLocation: setItem.storageLocation || "",
    checked: false,
    addedAt: existing?.addedAt || now,
    updatedAt: now,
    checkedAt: null
  };
}

export function loadPickupList() {
  return readPickupList();
}

export function upsertPickupItem(setItem) {
  const items = readPickupList();
  const id = buildPickupId(setItem);
  const index = items.findIndex((item) => item.id === id);
  const nextItem = normalizePickupItem(setItem, index >= 0 ? items[index] : null);

  if (index >= 0) {
    items[index] = nextItem;
  } else {
    items.push(nextItem);
  }

  writePickupList(items);
  return items;
}

export function togglePickupItemChecked(itemId) {
  const now = new Date().toISOString();
  const items = readPickupList().map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    const checked = !item.checked;
    return {
      ...item,
      checked,
      checkedAt: checked ? now : null,
      updatedAt: now
    };
  });

  writePickupList(items);
  return items;
}

export function removePickupItem(itemId) {
  const items = readPickupList().filter((item) => item.id !== itemId);
  writePickupList(items);
  return items;
}

export function clearPickedPickupItems() {
  const items = readPickupList().filter((item) => !item.checked);
  writePickupList(items);
  return items;
}

export function syncPickupItemFromSet(setItem) {
  if (!setItem) {
    return readPickupList();
  }

  const id = buildPickupId(setItem);
  const items = readPickupList().map((item) => {
    if (item.id !== id) {
      return item;
    }

    return {
      ...item,
      setNumber: String(setItem.setNumber || item.setNumber || "").split("-")[0],
      rebrickableSetNumber: setItem.rebrickableSetNumber || item.rebrickableSetNumber || item.setNumber,
      name: setItem.name || item.name,
      image: setItem.image || item.image,
      storageLocation: setItem.storageLocation || "",
      updatedAt: new Date().toISOString()
    };
  });

  writePickupList(items);
  return items;
}

export function clearPickupList() {
  writePickupList([]);
  return [];
}

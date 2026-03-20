import { clearSalesTable } from "./supabase.js";

const LOCAL_SALES_KEY = "lego-app:sales";

function writeLocalSales(records) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify(records));
}

export function getInitialSales() {
  if (typeof localStorage === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(LOCAL_SALES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function syncSalesWithSet(setItem, sales) {
  const withoutCurrent = sales.filter((entry) => entry.setNumber !== setItem.setNumber);

  if (setItem.sellingStatus === "Sold") {
    const next = [
      ...withoutCurrent,
      {
        setNumber: setItem.setNumber,
        name: setItem.name,
        status: "Sold",
        price: 0,
        date: new Date().toISOString().slice(0, 10),
        soldTo: ""
      }
    ];
    writeLocalSales(next);
    return next;
  }

  if (setItem.sellingStatus === "For sale") {
    const next = [
      ...withoutCurrent,
      {
        setNumber: setItem.setNumber,
        name: setItem.name,
        status: "For sale",
        price: 0,
        date: new Date().toISOString().slice(0, 10),
        soldTo: ""
      }
    ];
    writeLocalSales(next);
    return next;
  }

  writeLocalSales(withoutCurrent);
  return withoutCurrent;
}

export function deriveSalesFromSets(sets) {
  return sets
    .filter((setItem) => setItem.sellingStatus === "For sale" || setItem.sellingStatus === "Sold")
    .map((setItem) => ({
      setNumber: setItem.setNumber,
      name: setItem.name,
      status: setItem.sellingStatus,
      price: Number(setItem.askingPrice) || 0,
      date: new Date().toISOString().slice(0, 10),
      soldTo: "",
      platforms: Array.isArray(setItem.salePlatforms) ? setItem.salePlatforms : []
    }));
}

export async function resetSales() {
  writeLocalSales([]);

  try {
    await clearSalesTable();
  } catch {
    // Lokal nulstilling er nok, hvis Supabase ikke er sat op.
  }

  return [];
}

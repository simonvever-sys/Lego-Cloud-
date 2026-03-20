import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getLegoInstructionsUrl, getSetImageUrl } from "./rebrickable.js";

function getSupabaseConfig() {
  if (typeof window !== "undefined" && window.LEGO_APP_CONFIG?.supabase) {
    return window.LEGO_APP_CONFIG.supabase;
  }

  return {
    url: "SUPABASE_URL",
    anonKey: "SUPABASE_ANON_KEY"
  };
}

export function hasSupabaseConfig() {
  const config = getSupabaseConfig();
  return (
    config.url &&
    config.anonKey &&
    config.url !== "SUPABASE_URL" &&
    config.anonKey !== "SUPABASE_ANON_KEY"
  );
}

let supabaseClient;

function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  if (!supabaseClient) {
    const config = getSupabaseConfig();
    supabaseClient = createClient(config.url, config.anonKey);
  }

  return supabaseClient;
}

function mapSetToRow(setItem) {
  const parsedYear = Number.parseInt(setItem.year, 10);
  const parsedPieces = Number.parseInt(setItem.pieces, 10);
  const parsedMissingPieces = Number.parseInt(setItem.missingPieces, 10);

  return {
    set_number: setItem.rebrickableSetNumber || setItem.setNumber,
    owner_profile: setItem.ownerProfile || "shared",
    name: setItem.name,
    year: Number.isFinite(parsedYear) ? parsedYear : null,
    theme: setItem.theme,
    num_parts: Number.isFinite(parsedPieces) ? parsedPieces : 0,
    set_img_url: setItem.image,
    manual_url: setItem.manualUrl || "",
    storage_location: setItem.storageLocation || "",
    owned: Boolean(setItem.owned),
    has_box: Boolean(setItem.hasBox),
    has_manual: Boolean(setItem.hasManual),
    missing_pieces: Number.isFinite(parsedMissingPieces) ? parsedMissingPieces : 0,
    selling_status: setItem.sellingStatus || null,
    asking_price: Number(setItem.askingPrice) || 0,
    sale_platforms: Array.isArray(setItem.salePlatforms) ? setItem.salePlatforms : [],
    build_status: setItem.buildStatus || null,
    seal_status: setItem.sealStatus || "Åbnet",
    notes: setItem.notes || ""
  };
}

function getManualBucket() {
  if (typeof window !== "undefined" && window.LEGO_APP_CONFIG?.supabase?.manualBucket) {
    return window.LEGO_APP_CONFIG.supabase.manualBucket;
  }

  return "manuals";
}

async function request(path, options = {}) {
  const config = getSupabaseConfig();
  const hasRealConfig = hasSupabaseConfig();

  if (!hasRealConfig) {
    throw new Error("Supabase er ikke konfigureret.");
  }

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase API-fejl: ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

export function createSupabaseConfig() {
  return {
    ...getSupabaseConfig(),
    tables: {
      sets: "sets",
      collection: "collection",
      parts: "parts",
      sales: "sales",
      missingParts: "missing_parts"
    }
  };
}

export async function fetchMissingParts() {
  return request(
    "missing_parts?select=set_number,owner_profile,part_num,color,quantity_missing,part_name,part_image&order=set_number.asc"
  );
}

export async function clearMissingPartsTable() {
  return request("missing_parts?id=not.is.null", {
    method: "DELETE",
    headers: {
      Prefer: "return=representation"
    }
  });
}

export async function upsertMissingPart(record) {
  const setNumber = record.set_number;
  const ownerProfile = record.owner_profile || "shared";
  const partNum = record.part_num;
  const color = record.color;

  const existing = await request(
    `missing_parts?select=id,quantity_missing&set_number=eq.${encodeURIComponent(setNumber)}&owner_profile=eq.${encodeURIComponent(ownerProfile)}&part_num=eq.${encodeURIComponent(partNum)}&color=eq.${encodeURIComponent(color)}`
  );

  if (Array.isArray(existing) && existing.length > 0) {
    const current = existing[0];
    return request(`missing_parts?id=eq.${current.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        quantity_missing: current.quantity_missing + record.quantity_missing,
        part_name: record.part_name,
        part_image: record.part_image
      })
    });
  }

  return request("missing_parts", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(record)
  });
}

export async function decrementMissingPart(record) {
  const setNumber = record.set_number;
  const ownerProfile = record.owner_profile || "shared";
  const partNum = record.part_num;
  const color = record.color;

  const existing = await request(
    `missing_parts?select=id,quantity_missing&set_number=eq.${encodeURIComponent(setNumber)}&owner_profile=eq.${encodeURIComponent(ownerProfile)}&part_num=eq.${encodeURIComponent(partNum)}&color=eq.${encodeURIComponent(color)}`
  );

  if (!Array.isArray(existing) || existing.length === 0) {
    return [];
  }

  const current = existing[0];
  const nextQuantity = Math.max(0, Number(current.quantity_missing || 0) - (record.quantity_missing || 1));

  if (nextQuantity === 0) {
    await request(`missing_parts?id=eq.${current.id}`, {
      method: "DELETE",
      headers: {
        Prefer: "return=representation"
      }
    });
    return fetchMissingParts();
  }

  await request(`missing_parts?id=eq.${current.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      quantity_missing: nextQuantity
    })
  });

  return fetchMissingParts();
}

export async function insertCollectionSet(setItem) {
  return request("collection", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(mapSetToRow(setItem))
  });
}

export async function upsertCollectionSet(setItem) {
  const key = encodeURIComponent(setItem.rebrickableSetNumber || setItem.setNumber);
  const ownerProfile = encodeURIComponent(setItem.ownerProfile || "shared");
  return request(`collection?set_number=eq.${key}&owner_profile=eq.${ownerProfile}`, {
    method: "PATCH",
    body: JSON.stringify(mapSetToRow(setItem))
  });
}

export async function fetchCollectionSets() {
  const rows = await request(
    "collection?select=set_number,owner_profile,name,year,theme,num_parts,set_img_url,manual_url,storage_location,owned,has_box,has_manual,missing_pieces,selling_status,asking_price,sale_platforms,build_status,seal_status,notes&order=owner_profile.asc,set_number.asc"
  );

  return (rows || []).map((row) => ({
    collectionKey: `${row.owner_profile || "shared"}:${row.set_number}`,
    setNumber: row.set_number.split("-")[0],
    rebrickableSetNumber: row.set_number,
    ownerProfile: row.owner_profile || "shared",
    name: row.name,
    theme: row.theme,
    year: row.year,
    pieces: row.num_parts,
    image: row.set_img_url || getSetImageUrl(row.set_number),
    manualUrl: row.manual_url || getLegoInstructionsUrl(row.set_number),
    storageLocation: row.storage_location || "",
    owned: Boolean(row.owned),
    hasBox: Boolean(row.has_box),
    hasManual: Boolean(row.has_manual),
    missingPieces: row.missing_pieces || 0,
    sellingStatus: row.selling_status || "Not for sale",
    askingPrice: Number(row.asking_price) || 0,
    salePlatforms: Array.isArray(row.sale_platforms) ? row.sale_platforms : [],
    buildStatus: row.build_status || "Ikke bygget",
    sealStatus: row.seal_status || "Åbnet",
    notes: row.notes || "",
    wanted: false
  }));
}

export async function clearCollectionTable() {
  return request("collection?id=not.is.null", {
    method: "DELETE",
    headers: {
      Prefer: "return=representation"
    }
  });
}

export async function deleteCollectionSet(setItem) {
  const key = encodeURIComponent(setItem.rebrickableSetNumber || setItem.setNumber);
  const ownerProfile = encodeURIComponent(setItem.ownerProfile || "shared");
  const deleted = await request(`collection?set_number=eq.${key}&owner_profile=eq.${ownerProfile}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=representation"
    }
  });

  // Backward compatibility for rows created before owner_profile existed.
  if (Array.isArray(deleted) && deleted.length === 0) {
    return request(`collection?set_number=eq.${key}&owner_profile=is.null`, {
      method: "DELETE",
      headers: {
        Prefer: "return=representation"
      }
    });
  }

  return deleted;
}

export async function clearSalesTable() {
  return request("sales?id=not.is.null", {
    method: "DELETE",
    headers: {
      Prefer: "return=representation"
    }
  });
}

export function subscribeToCollectionChanges(onChange) {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  const channel = client
    .channel("lego-cloud-collection")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "collection" },
      async () => {
        onChange(await fetchCollectionSets());
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function subscribeToMissingPartsChanges(onChange) {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  const channel = client
    .channel("lego-cloud-missing-parts")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "missing_parts" },
      async () => {
        onChange(await fetchMissingParts());
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

export function getManualStorageUrl(setNumber) {
  const client = getSupabaseClient();
  if (!client || !setNumber) {
    return "";
  }

  const normalizedSetNumber = String(setNumber || "")
    .replace(/\.pdf$/i, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-")
    .split("-")[0];
  if (!normalizedSetNumber) {
    return "";
  }

  const bucket = getManualBucket();
  const path = `${normalizedSetNumber}.pdf`;
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || "";
}

export async function uploadManualToStorage(file, explicitSetNumber = "") {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("Supabase er ikke konfigureret.");
  }

  const setNumber = String(explicitSetNumber || file.name || "")
    .replace(/\.pdf$/i, "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[–—]/g, "-")
    .split("-")[0];
  if (!setNumber) {
    throw new Error("Kunne ikke finde et gyldigt sætnummer til manualen.");
  }

  const bucket = getManualBucket();
  const path = `${setNumber}.pdf`;
  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "application/pdf",
    upsert: true
  });

  if (error) {
    throw error;
  }

  return {
    setNumber,
    publicUrl: getManualStorageUrl(setNumber)
  };
}

export const schemaBlueprint = {
  sets: ["set_number", "name", "theme", "year", "pieces", "image", "manual_url"],
  collection: [
    "set_number",
    "owner_profile",
    "storage_location",
    "owned",
    "has_box",
    "has_manual",
    "missing_pieces",
    "selling_status",
    "asking_price",
    "sale_platforms",
    "build_status",
    "seal_status",
    "notes"
  ],
  parts: ["part_id", "name", "color", "image"],
  sales: ["set_number", "price", "date", "sold_to"],
  missing_parts: [
    "set_number",
    "owner_profile",
    "part_num",
    "color",
    "quantity_missing",
    "part_name",
    "part_image"
  ]
};

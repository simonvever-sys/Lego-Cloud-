import { getManualStorageUrl, hasSupabaseConfig } from "./supabase.js";

export function normalizeSetNumber(setNumber) {
  return String(setNumber || "").split("-")[0].trim();
}

export function getManualUrl(setNumber) {
  const normalized = normalizeSetNumber(setNumber);
  return normalized
    ? `https://www.lego.com/service/buildinginstructions/${encodeURIComponent(normalized)}`
    : "";
}

export function getManualPdfUrl(setNumber) {
  const normalized = normalizeSetNumber(setNumber);
  return normalized
    ? `https://www.lego.com/cdn/product-assets/product.bi.core.pdf/${encodeURIComponent(normalized)}.pdf`
    : "";
}

export function getCloudManualUrl(setNumber) {
  const normalized = normalizeSetNumber(setNumber);
  if (!normalized || !hasSupabaseConfig()) {
    return "";
  }

  return getManualStorageUrl(normalized);
}

export function isPdfUrl(url) {
  return /\.pdf($|\?)/i.test(String(url || ""));
}

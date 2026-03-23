const API_BASE = "https://rebrickable.com/api/v3/lego";
const PARTS_PAGE_SIZE = 50;
const INCLUDE_SPARE_PARTS = true;
const INCLUDE_MINIFIG_PARTS = true;
const SET_PLACEHOLDER = "/images/lego-placeholder.png";
const PART_PLACEHOLDER = "/images/part-placeholder.png";
const REQUEST_TIMEOUT_MS = 10000;
const REQUEST_RETRY_ATTEMPTS = 2;
const RETRY_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const REQUEST_MIN_INTERVAL_MS = 650;
const API_CACHE_PREFIX = "api-response";
const DEFAULT_API_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export function normalizeSetNumber(setNumber) {
  const compact = String(setNumber || "").trim().replace(/\s+/g, "");
  return compact.includes("-") ? compact : `${compact}-1`;
}

export function getSetImageUrl(setNumber) {
  const normalized = normalizeSetNumber(setNumber);
  return normalized ? `https://cdn.rebrickable.com/media/sets/${normalized}.jpg` : SET_PLACEHOLDER;
}

export function getLegoInstructionsUrl(setNumber) {
  const normalized = normalizeSetNumber(setNumber);
  const baseNumber = normalized.split("-")[0];
  return baseNumber ? `https://www.lego.com/da-dk/service/buildinginstructions/${baseNumber}` : "";
}

function getDefaultApiKey() {
  if (typeof window !== "undefined" && window.LEGO_APP_CONFIG?.rebrickableApiKey) {
    return window.LEGO_APP_CONFIG.rebrickableApiKey;
  }

  return "";
}

function getProxyBaseUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  if (window.LEGO_APP_CONFIG?.rebrickableProxyUrl) {
    return window.LEGO_APP_CONFIG.rebrickableProxyUrl;
  }

  const supabaseUrl = window.LEGO_APP_CONFIG?.supabase?.url;
  return supabaseUrl ? `${supabaseUrl}/functions/v1/rebrickable-proxy` : "";
}

function getCacheKey(prefix, identifier) {
  return `lego-app:${prefix}:${identifier}`;
}

function readCache(key) {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(key, payload) {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignorer cache-fejl, UI'et kan stadig fungere uden lokal cache.
  }
}

export function createRebrickableClient(apiKey = getDefaultApiKey()) {
  let proxyState = "unknown";
  let requestQueue = Promise.resolve();
  let lastRequestStartedAt = 0;
  const inFlightRequestCache = new Map();

  function getRequestCacheKey(path) {
    return getCacheKey(API_CACHE_PREFIX, path);
  }

  function readTimedCache(key) {
    const payload = readCache(key);
    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (payload.expiresAt && Date.now() > payload.expiresAt) {
      return null;
    }

    return payload.data;
  }

  function writeTimedCache(key, data, ttlMs = DEFAULT_API_CACHE_TTL_MS) {
    writeCache(key, {
      data,
      expiresAt: Date.now() + Math.max(0, Number(ttlMs) || 0)
    });
  }

  function enqueueRequest(task) {
    const runTask = async () => {
      const elapsed = Date.now() - lastRequestStartedAt;
      const waitMs = Math.max(0, REQUEST_MIN_INTERVAL_MS - elapsed);
      if (waitMs > 0) {
        await delay(waitMs);
      }
      lastRequestStartedAt = Date.now();
      return task();
    };

    const scheduled = requestQueue.then(runTask, runTask);
    requestQueue = scheduled.catch(() => {});
    return scheduled;
  }

  function resolveCacheTtl(path) {
    if (
      path.startsWith("/sets/?search=") ||
      path.startsWith("/parts/?search=") ||
      path.startsWith("/themes/?search=")
    ) {
      return 1000 * 60 * 20;
    }
    return DEFAULT_API_CACHE_TTL_MS;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchWithRetry(url, options = {}, retries = REQUEST_RETRY_ATTEMPTS) {
    let attempt = 0;
    let lastError = null;

    while (attempt <= retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (RETRY_STATUS_CODES.has(response.status) && attempt < retries) {
          attempt += 1;
          await delay(200 * attempt);
          continue;
        }

        return response;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (attempt >= retries) {
          break;
        }
        attempt += 1;
        await delay(200 * attempt);
      }
    }

    throw lastError || new Error("Forbindelsen til LEGO databasen fejlede.");
  }

  function getPathFromAbsoluteUrl(url) {
    if (!url) {
      return "";
    }

    try {
      const parsed = new URL(url);
      if (!parsed.pathname.startsWith("/api/v3/lego/")) {
        return "";
      }
      return `${parsed.pathname.replace("/api/v3/lego", "")}${parsed.search}`;
    } catch {
      return "";
    }
  }

  async function request(path, options = {}) {
    const {
      cache = true,
      cacheTtlMs = resolveCacheTtl(path)
    } = options;
    const cacheKey = getRequestCacheKey(path);
    if (cache) {
      const cached = readTimedCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const inFlightKey = `${path}:${cache ? "cache" : "no-cache"}`;
    if (inFlightRequestCache.has(inFlightKey)) {
      return inFlightRequestCache.get(inFlightKey);
    }

    const responsePromise = enqueueRequest(async () => {
      const proxyBaseUrl = getProxyBaseUrl();
      const anonKey =
        typeof window !== "undefined" ? window.LEGO_APP_CONFIG?.supabase?.anonKey || "" : "";

      async function requestViaProxy() {
        const headers = {};
        if (anonKey) {
          headers.apikey = anonKey;
          headers.Authorization = `Bearer ${anonKey}`;
        }

        const response = await fetchWithRetry(`${proxyBaseUrl}?path=${encodeURIComponent(path)}`, {
          headers
        });
        if (response.status === 404) {
          proxyState = "missing";
          throw new Error("LEGO proxyen mangler i Supabase.");
        }
        proxyState = "ok";
        return response;
      }

      async function requestDirect() {
        if (!apiKey) {
          throw new Error("LEGO API-nøglen mangler.");
        }

        // Prøv først standard auth-header.
        const headerResponse = await fetchWithRetry(`${API_BASE}${path}`, {
          headers: {
            Authorization: "key " + apiKey
          }
        });
        if (headerResponse.ok) {
          return headerResponse;
        }
        if (headerResponse.status !== 401 && headerResponse.status !== 403) {
          return headerResponse;
        }

        // Fallback: nogle miljøer fungerer bedre med key i query-string.
        const delimiter = path.includes("?") ? "&" : "?";
        return fetchWithRetry(`${API_BASE}${path}${delimiter}key=${encodeURIComponent(apiKey)}`);
      }

      let response;
      let lastFailure = null;

      try {
        if (proxyBaseUrl && proxyState !== "missing") {
          try {
            response = await requestViaProxy();
          } catch (error) {
            lastFailure = error;
            if (apiKey) {
              response = await requestDirect();
            } else {
              throw error;
            }
          }

          if (!response.ok && apiKey) {
            try {
              const directResponse = await requestDirect();
              response = directResponse;
            } catch (error) {
              lastFailure = error;
              // Behold proxy-responsen, så den normale fejlhåndtering kan vise korrekt status.
            }
          }
        } else {
          response = await requestDirect();
        }
      } catch (error) {
        const reason = String(error?.message || "").trim();
        if (reason) {
          throw new Error(reason);
        }
        throw lastFailure || new Error("Forbindelsen til LEGO databasen fejlede.");
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (proxyState === "missing") {
            throw new Error("LEGO proxyen mangler, og direkte adgang til LEGO databasen blev afvist.");
          }
          throw new Error("LEGO databasen afviste forbindelsen.");
        }

        if (response.status === 404) {
          throw new Error("Sæt ikke fundet i LEGO databasen.");
        }

        throw new Error("Kunne ikke hente LEGO data.");
      }

      const data = await response.json();
      if (cache) {
        writeTimedCache(cacheKey, data, cacheTtlMs);
      }
      return data;
    }).finally(() => {
      inFlightRequestCache.delete(inFlightKey);
    });

    inFlightRequestCache.set(inFlightKey, responsePromise);
    return responsePromise;
  }

  function normalizeSetPart(item, setNumber) {
    const partNum = String(item?.part?.part_num || "").trim();
    const colorName = String(item?.color?.name || "").trim();
    const elementId = String(item?.element_id || "").trim();
    const isSpare = item?.is_spare ? "spare" : "main";

    return {
      cacheKey: `${setNumber}:${partNum}:${colorName}:${elementId}:${isSpare}`,
      setNumber,
      partNum,
      name: item?.part?.name || "Ukendt klods",
      image: item?.part?.part_img_url || PART_PLACEHOLDER,
      color: colorName || "Ukendt farve",
      colorRgb: item?.color?.rgb ? `#${item.color.rgb}` : "#d9d3c7",
      quantity: item?.quantity
    };
  }

  function normalizePartSet(item) {
    return {
      setNumber: item.set.set_num,
      name: item.set.name,
      year: item.set.year,
      theme: item.set.theme?.name || "",
      image: item.set.set_img_url || getSetImageUrl(item.set.set_num),
      numParts: item.num_parts
    };
  }

  function normalizeSearchPart(item, colors = []) {
    return {
      partId: item.part_num,
      name: item.name,
      image: item.part_img_url || PART_PLACEHOLDER,
      availableColors: colors
    };
  }

  async function getPartColors(partNum) {
    const cacheKey = getCacheKey("part-colors", partNum);
    const cached = readCache(cacheKey);

    if (cached) {
      return cached;
    }

    const data = await request(`/parts/${encodeURIComponent(partNum)}/colors/`);
    const payload = (data.results || []).map((item) => ({
      id: `${partNum}-${item.color_id}`,
      name: item.color_name || item.name || "Ukendt",
      rgb: item.color_rgb ? `#${item.color_rgb}` : "#d9d3c7"
    }));
    writeCache(cacheKey, payload);
    return payload;
  }

  function resolveThemeNameFromItem(item) {
    const rawTheme = item?.theme_name || item?.theme?.name || item?.theme || "";
    return typeof rawTheme === "string" ? rawTheme : "";
  }

  function normalizeSearchSet(item) {
    const resolvedTheme = resolveThemeNameFromItem(item);
    const resolvedThemeId = item?.theme_id || item?.theme?.id || null;
    return {
      collectionKey: "",
      setNumber: item.set_num,
      rebrickableSetNumber: item.set_num,
      ownerProfile: "",
      name: item.name,
      theme: resolvedTheme,
      themeName: resolvedTheme,
      themeId: resolvedThemeId,
      year: item.year,
      pieces: item.num_parts,
      image: item.set_img_url || getSetImageUrl(item.set_num),
      manualUrl: item.instructions_url || getLegoInstructionsUrl(item.set_num),
      storageLocation: "",
      owned: false,
      hasBox: false,
      hasManual: false,
      missingPieces: 0,
      sellingStatus: "Not for sale",
      askingPrice: 0,
      salePlatforms: [],
      buildStatus: "Ikke bygget",
      sealStatus: "Åbnet",
      notes: "",
      wanted: false
    };
  }

  async function resolveThemeName(item) {
    const directName = resolveThemeNameFromItem(item);
    if (directName) {
      return directName;
    }

    const themeId = item?.theme_id || item?.theme?.id;
    if (!themeId) {
      return "";
    }

    const cacheKey = getCacheKey("theme-name", themeId);
    const cached = readCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const themeData = await request(`/themes/${encodeURIComponent(themeId)}/`);
      const resolved = String(themeData?.name || "").trim();
      if (resolved) {
        writeCache(cacheKey, resolved);
      }
      return resolved;
    } catch {
      return "";
    }
  }

  async function getSetPartsPage(setNumber, page = 1, pageSize = PARTS_PAGE_SIZE) {
    const normalizedSet = normalizeSetNumber(setNumber);
    const includeSpare = INCLUDE_SPARE_PARTS ? 1 : 0;
    const includeMinifig = INCLUDE_MINIFIG_PARTS ? 1 : 0;
    const cacheKey = getCacheKey(
      "set-parts",
      `${normalizedSet}:page:${page}:size:${pageSize}:spare:${includeSpare}:minifig:${includeMinifig}:v2`
    );
    const cached = readCache(cacheKey);

    if (cached) {
      return cached;
    }

    const data = await request(
      `/sets/${encodeURIComponent(normalizedSet)}/parts/?page=${page}&page_size=${pageSize}&inc_spares=${includeSpare}&inc_minifig_parts=${includeMinifig}`
    );

    const payload = {
      count: data.count,
      next: data.next,
      previous: data.previous,
      results: data.results.map((item) => normalizeSetPart(item, normalizedSet))
    };

    writeCache(cacheKey, payload);
    return payload;
  }

  async function getSetsForPart(partNum) {
    const cacheKey = getCacheKey("part-sets", partNum);
    const cached = readCache(cacheKey);

    if (cached) {
      return cached;
    }

    const data = await request(`/parts/${encodeURIComponent(partNum)}/sets/?page_size=50`);
    const payload = data.results.map(normalizePartSet);
    writeCache(cacheKey, payload);
    return payload;
  }

  return {
    async getSet(setNumber) {
      const item = await request(`/sets/${encodeURIComponent(normalizeSetNumber(setNumber))}/`);
      const resolvedTheme = await resolveThemeName(item);
      return {
        ...normalizeSearchSet(item),
        theme: resolvedTheme,
        themeName: resolvedTheme
      };
    },
    async findSetBySpreadsheetNumber(setNumber) {
      const raw = String(setNumber || "").trim();
      const compact = raw.replace(/\s+/g, "");
      const baseNumber = compact.split("-")[0];

      try {
        return await this.getSet(compact);
      } catch {
        // Fall through to search-based matching below.
      }

      const data = await request(`/sets/?search=${encodeURIComponent(baseNumber)}&page_size=20`);
      const results = data.results || [];
      const exact = results.find((item) => item.set_num === compact || item.set_num === `${baseNumber}-1`);
      const prefixMatch = exact || results.find((item) => String(item.set_num || "").startsWith(`${baseNumber}-`));

      if (!prefixMatch) {
        throw new Error("Kunne ikke hente LEGO data.");
      }

      const resolvedTheme = await resolveThemeName(prefixMatch);
      return {
        ...normalizeSearchSet(prefixMatch),
        setNumber: prefixMatch.set_num,
        rebrickableSetNumber: prefixMatch.set_num,
        theme: resolvedTheme,
        themeName: resolvedTheme
      };
    },
    async searchSets(query, pageSize = 30) {
      const normalizedQuery = String(query || "").trim();
      if (!normalizedQuery) {
        return [];
      }

      const aggregatedResults = [];
      let nextPath = `/sets/?search=${encodeURIComponent(normalizedQuery)}&page_size=${pageSize}`;
      let page = 0;

      while (nextPath && page < 4) {
        try {
          const data = await request(nextPath);
          aggregatedResults.push(...(data.results || []));
          nextPath = getPathFromAbsoluteUrl(data.next);
          page += 1;
        } catch {
          // Returnér de resultater vi allerede har i stedet for at fejle hele søgningen.
          break;
        }
      }

      const results = aggregatedResults;
      const normalizedResults = await Promise.all(
        results.map(async (item) => {
          const normalizedItem = normalizeSearchSet(item);
          if (normalizedItem.theme) {
            return normalizedItem;
          }

          const resolvedTheme = await resolveThemeName(item);
          return {
            ...normalizedItem,
            theme: resolvedTheme,
            themeName: resolvedTheme
          };
        })
      );

      return normalizedResults;
    },
    async searchSetsByThemeName(query, perThemeLimit = 80) {
      const normalizedQuery = String(query || "").trim();
      if (!normalizedQuery) {
        return [];
      }

      const normalizeText = (value) =>
        String(value || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();
      const queryTokens = normalizeText(normalizedQuery)
        .split(/\s+/)
        .filter((token) => token.length >= 3);
      const aliasMap = {
        teknik: "technic",
        creator3in1: "creator",
        starwars: "star wars",
        ninjago: "ninjago",
        city: "city",
        friends: "friends",
        duplo: "duplo",
        icons: "icons",
        ideas: "ideas"
      };

      let themeSearch;
      try {
        themeSearch = await request(`/themes/?search=${encodeURIComponent(normalizedQuery)}&page_size=20`);
      } catch {
        return [];
      }
      const themes = (themeSearch.results || [])
        .map((theme) => {
          const themeName = normalizeText(theme.name || "");
          let score = 0;

          if (themeName === normalizeText(normalizedQuery)) {
            score += 20;
          }

          queryTokens.forEach((token) => {
            if (themeName.includes(token)) {
              score += 8;
            }

            const alias = aliasMap[token];
            if (alias && themeName.includes(alias)) {
              score += 10;
            }
          });

          if (!queryTokens.length && themeName.includes(normalizeText(normalizedQuery))) {
            score += 8;
          }

          return { ...theme, _score: score };
        })
        .filter((theme) => theme._score > 0)
        .sort((left, right) => right._score - left._score);

      if (!themes.length) {
        return [];
      }

      const allThemeSets = await Promise.all(
        themes.slice(0, 4).map(async (theme) => {
          const results = [];
          let nextPath = `/themes/${encodeURIComponent(theme.id)}/sets/?page_size=${Math.min(perThemeLimit, 100)}`;
          let page = 0;

          while (nextPath && page < 3 && results.length < perThemeLimit) {
            try {
              const data = await request(nextPath);
              const themedResults = (data.results || []).map((item) => ({
                ...item,
                theme_name: item.theme_name || theme.name
              }));
              results.push(...themedResults);
              nextPath = getPathFromAbsoluteUrl(data.next);
              page += 1;
            } catch {
              // Delvis data er bedre end total fejl.
              break;
            }
          }

          return results.slice(0, perThemeLimit);
        })
      );

      const deduped = new Map();
      allThemeSets.flat().forEach((item) => {
        const key = item.set_num;
        if (!key || deduped.has(key)) {
          return;
        }
        deduped.set(key, item);
      });

      const normalizedResults = await Promise.all(
        [...deduped.values()].map(async (item) => {
          const normalizedItem = normalizeSearchSet(item);
          if (normalizedItem.theme) {
            return normalizedItem;
          }
          const resolvedTheme = await resolveThemeName(item);
          return {
            ...normalizedItem,
            theme: resolvedTheme,
            themeName: resolvedTheme
          };
        })
      );

      return normalizedResults;
    },
    async searchParts(query) {
      const data = await request(`/parts/?search=${encodeURIComponent(query)}`);
      const results = data.results || [];
      const normalizedResults = await Promise.all(
        results.slice(0, 12).map(async (item) => {
          try {
            const colors = await getPartColors(item.part_num);
            return normalizeSearchPart(item, colors);
          } catch {
            return normalizeSearchPart(item, []);
          }
        })
      );
      return normalizedResults;
    },
    getSetPartsPage,
    getSetsForPart,
    normalizeSetNumber,
    pageSize: PARTS_PAGE_SIZE
  };
}

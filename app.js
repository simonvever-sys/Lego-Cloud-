import { createApp } from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import {
  addSetToCollection,
  getInitialCollection,
  loadCollection,
  removeCollectionSet,
  replaceCollection,
  saveCollectionSet,
  resetCollection,
  resetCollectionOnce
} from "./lib/collectionStore.js";
import { createRebrickableClient, getLegoInstructionsUrl, getSetImageUrl, normalizeSetNumber } from "./lib/rebrickable.js";
import { addMissingPart, loadMissingParts, resetMissingParts, resolveMissingPart } from "./lib/missingPartsStore.js";
import { deriveSalesFromSets, resetSales } from "./lib/salesStore.js";
import {
  getManualStorageUrl,
  hasSupabaseConfig,
  subscribeToCollectionChanges,
  subscribeToMissingPartsChanges,
  uploadManualToStorage
} from "./lib/supabase.js";
import { HomePage } from "./pages/HomePage.js";
import { CollectionPage } from "./pages/CollectionPage.js";
import { SetDetailPage } from "./pages/SetDetailPage.js";
import { PartsPage } from "./pages/PartsPage.js";
import { SearchSetsPage } from "./pages/SearchSetsPage.js";
import { SalesPage } from "./pages/SalesPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { StatsPage } from "./pages/StatsPage.js";
import { MissingPartsPage } from "./pages/MissingPartsPage.js";
import { ProfileSelectPage } from "./pages/ProfileSelectPage.js";
import { ImportCollectionPage } from "./pages/ImportCollectionPage.js";
import { PickupListPage } from "./pages/PickupListPage.js";
import { BuildPage } from "./pages/BuildPage.js";

const rebrickableClient = createRebrickableClient();
const ROUTE_KEY = "lego-cloud:route";
const PROFILE_KEY = "lego-cloud:active-profile";
const SEARCH_QUERY_KEY = "lego-cloud:search-query";
const SEARCH_RESULTS_KEY = "lego-cloud:search-results";
const CLOUD_REFRESH_INTERVAL_MS = 45000;
const CLOUD_REFRESH_MIN_GAP_MS = 15000;
const SEARCH_TERM_DELAY_MS = 350;
const CLOUD_FETCH_DELAY_MS = 180;
const COLLECTION_METADATA_SYNC_DELAY_MS = 140;
const PROFILES = [
  {
    id: "family",
    name: "Familie",
    emoji: "🏡",
    accent: "#c43d2b",
    softAccent: "rgba(196, 61, 43, 0.16)",
    description: "Se hele familiens samling samlet ét sted."
  },
  {
    id: "simon",
    name: "Simon",
    emoji: "🧱",
    accent: "#f0b400",
    softAccent: "rgba(240, 180, 0, 0.18)",
    description: "Dine egne sæt og din personlige status."
  },
  {
    id: "dad",
    name: "Claus",
    emoji: "🛠️",
    accent: "#2f7bd1",
    softAccent: "rgba(47, 123, 209, 0.16)",
    description: "Claus' samling og projekter."
  },
  {
    id: "little-brother",
    name: "August",
    emoji: "🚀",
    accent: "#35a86b",
    softAccent: "rgba(53, 168, 107, 0.16)",
    description: "Augusts hurtige builds og vilde sæt."
  },
  {
    id: "william",
    name: "William",
    emoji: "🏎️",
    accent: "#8f57d9",
    softAccent: "rgba(143, 87, 217, 0.16)",
    description: "Williams egne sæt og favoritter."
  },
  {
    id: "leonora",
    name: "Leonora",
    emoji: "🌸",
    accent: "#e36ca5",
    softAccent: "rgba(227, 108, 165, 0.18)",
    description: "Leonoras samling og små universer."
  }
];

function getRoutePath() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash || localStorage.getItem(ROUTE_KEY) || "/home";
}

function readStoredSearchQuery() {
  try {
    return localStorage.getItem(SEARCH_QUERY_KEY) || "";
  } catch {
    return "";
  }
}

function readStoredSearchResults() {
  try {
    const raw = localStorage.getItem(SEARCH_RESULTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

createApp({
  components: {
    HomePage,
    CollectionPage,
    SetDetailPage,
    PartsPage,
    SearchSetsPage,
    SalesPage,
    SettingsPage,
    StatsPage,
    MissingPartsPage,
    ProfileSelectPage,
    ImportCollectionPage,
    PickupListPage,
    BuildPage
  },
  data() {
    return {
      profiles: PROFILES,
      activeProfileId: localStorage.getItem(PROFILE_KEY) || "",
      sets: getInitialCollection(),
      parts: [],
      sales: deriveSalesFromSets(getInitialCollection()),
      currentView: "home",
      appVersion: "1.0.0",
      activeSet: null,
      bottomNavItems: [
        { id: "home", label: "Forside", icon: "🏠" },
        { id: "collection", label: "Samling", icon: "📦" },
        { id: "search", label: "Søg", icon: "🔍" },
        { id: "pickup", label: "Til afhentning", icon: "📥" },
        { id: "drawer", label: "Menu", icon: "☰" }
      ],
      drawerItems: [
        { id: "parts", label: "Klodser", icon: "🧩" },
        { id: "missing-parts", label: "Manglende klodser", icon: "🟧" },
        { id: "sales", label: "Salg", icon: "💰" },
        { id: "stats", label: "Statistik", icon: "📊" },
        { id: "settings", label: "Indstillinger", icon: "⚙️" }
      ],
      collectionQuery: "",
      searchQuery: readStoredSearchQuery(),
      partsQuery: "",
      collectionFilter: "Alle",
      collectionTheme: "Alle temaer",
      collectionSortBy: "set-number-asc",
      searchResults: readStoredSearchResults(),
      searchLoading: false,
      searchError: "",
      partsLoading: false,
      partsError: "",
      inventoryParts: [],
      inventoryLoading: false,
      inventoryError: "",
      inventoryProgress: { done: 0, total: 0 },
      missingParts: [],
      setParts: [],
      setPartsPage: 0,
      hasMoreSetParts: false,
      setPartsLoading: false,
      setPartsError: "",
      setPartsRequested: false,
      relatedPartSets: {},
      relatedPartSetsLoading: {},
      importState: {
        file: null,
        fileName: "",
        running: false,
        finished: false,
        total: 0,
        completed: 0,
        currentSetNumber: "",
        imported: [],
        errors: []
      },
      manualOpeningSetNumber: "",
      manualOpenError: "",
      drawerOpen: false,
      resolvedPartsSetNumbers: {},
      lastCollectionScrollY: 0,
      lastViewBeforeDetail: "collection",
      stopCollectionSync: null,
      stopMissingPartsSync: null,
      cloudRefreshTimer: null,
      cloudRefreshInFlight: false,
      cloudLastRefreshAt: 0,
      metadataSyncRunning: false
    };
  },
  computed: {
    currentProfile() {
      return this.profiles.find((profile) => profile.id === this.activeProfileId) || null;
    },
    visibleSets() {
      const ownerLookup = Object.fromEntries(this.profiles.map((profile) => [profile.id, profile.name]));
      const source =
        this.activeProfileId && this.activeProfileId !== "family"
          ? this.sets.filter((setItem) => setItem.ownerProfile === this.activeProfileId)
          : this.sets;

      return source.map((setItem) => ({
        ...setItem,
        ownerName: ownerLookup[setItem.ownerProfile] || "Profil"
      }));
    },
    visibleMissingParts() {
      if (!this.activeProfileId || this.activeProfileId === "family") {
        return this.missingParts;
      }

      const visibleSetNumbers = new Set(
        this.visibleSets.map((setItem) => setItem.rebrickableSetNumber || setItem.setNumber)
      );

      return this.missingParts.filter(
        (item) => item.owner_profile === this.activeProfileId || visibleSetNumbers.has(item.set_number)
      );
    },
    collectionStats() {
      const ownedSets = this.visibleSets.filter((setItem) => setItem.owned);
      const totalPieces = ownedSets.reduce((sum, setItem) => {
        const piecesPerSet = Math.max(0, Number(setItem.pieces) || 0);
        const quantityOwned = Math.max(1, Number(setItem.quantityOwned) || 1);
        return sum + piecesPerSet * quantityOwned;
      }, 0);
      const themeMap = ownedSets.reduce((map, setItem) => {
        const current = map.get(setItem.theme) || { name: setItem.theme, count: 0, pieces: 0 };
        const quantityOwned = Math.max(1, Number(setItem.quantityOwned) || 1);
        const piecesPerSet = Math.max(0, Number(setItem.pieces) || 0);
        current.count += quantityOwned;
        current.pieces += piecesPerSet * quantityOwned;
        map.set(setItem.theme, current);
        return map;
      }, new Map());

      return {
        totalSets: ownedSets.length,
        totalPieces,
        totalThemes: themeMap.size,
        estimatedValue: "8.620 kr.",
        themes: [...themeMap.values()].sort((left, right) => right.count - left.count)
      };
    },
    profileSummaries() {
      return this.profiles.reduce((accumulator, profile) => {
        const profileSets =
          profile.id === "family"
            ? this.sets
            : this.sets.filter((setItem) => setItem.ownerProfile === profile.id);
        accumulator[profile.id] = {
          count: profileSets.reduce((sum, setItem) => sum + Math.max(1, Number(setItem.quantityOwned) || 1), 0),
          pieces: profileSets.reduce((sum, setItem) => {
            const piecesPerSet = Math.max(0, Number(setItem.pieces) || 0);
            const quantityOwned = Math.max(1, Number(setItem.quantityOwned) || 1);
            return sum + piecesPerSet * quantityOwned;
          }, 0)
        };
        return accumulator;
      }, {});
    },
    familyProfileSummaries() {
      return this.profiles
        .filter((profile) => profile.id !== "family")
        .map((profile) => ({
          ...profile,
          count: this.profileSummaries[profile.id]?.count || 0,
          pieces: this.profileSummaries[profile.id]?.pieces || 0
        }));
    },
    homePreviewSets() {
      return this.visibleSets
        .map((setItem, index) => ({ setItem, index }))
        .sort((left, right) => {
          const leftFavorite = left.setItem.favorite ? 1 : 0;
          const rightFavorite = right.setItem.favorite ? 1 : 0;
          if (rightFavorite !== leftFavorite) {
            return rightFavorite - leftFavorite;
          }

          const leftInProgress = left.setItem.buildStatus === "I gang" ? 1 : 0;
          const rightInProgress = right.setItem.buildStatus === "I gang" ? 1 : 0;
          if (rightInProgress !== leftInProgress) {
            return rightInProgress - leftInProgress;
          }

          const yearDiff = Number(right.setItem.year || 0) - Number(left.setItem.year || 0);
          if (yearDiff !== 0) {
            return yearDiff;
          }

          return right.index - left.index;
        })
        .map((entry) => entry.setItem)
        .slice(0, 8);
    },
    visibleSales() {
      if (!this.activeProfileId || this.activeProfileId === "family") {
        return this.sales;
      }

      const visibleSetNumbers = new Set(this.visibleSets.map((setItem) => setItem.setNumber));
      return this.sales.filter((sale) => visibleSetNumbers.has(sale.setNumber));
    },
    statsPayload() {
      return {
        cards: [
          { label: "Sæt", value: this.collectionStats.totalSets.toLocaleString("da-DK") },
          { label: "Klodser", value: this.collectionStats.totalPieces.toLocaleString("da-DK") },
          { label: "Temaer", value: this.collectionStats.totalThemes.toLocaleString("da-DK") },
          { label: "Værdi", value: this.collectionStats.estimatedValue }
        ],
        themes: this.collectionStats.themes
      };
    },
    collectionThemeOptions() {
      return [...new Set(this.visibleSets.map((item) => String(item.theme || "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "da")
      );
    },
    collectionSetNumbers() {
      return this.visibleSets.map((item) => item.rebrickableSetNumber || item.setNumber);
    },
    currentPageTitle() {
      if (!this.activeProfileId) {
        return "Vælg profil";
      }

      const titles = {
        home: "Forside",
        collection: "Min samling",
        search: "Søg",
        parts: "Klodser",
        pickup: "Til afhentning",
        "missing-parts": "Manglende klodser",
        sales: "Salg",
        stats: "Statistik",
        settings: "Indstillinger",
        "import-collection": "Importer samling",
        detail: "Sæt",
        build: "Byg"
      };
      return titles[this.currentView] || this.currentProfile?.name || "LEGO Cloud";
    },
    activeSetManualOpening() {
      if (!this.activeSet) {
        return false;
      }
      const activeSetBase = this.getBaseSetNumber(this.activeSet.rebrickableSetNumber || this.activeSet.setNumber);
      return Boolean(activeSetBase && this.manualOpeningSetNumber === activeSetBase);
    },
    activeSetInPickupList() {
      if (!this.activeSet) {
        return false;
      }
      return this.isSetMarkedForPickup(this.activeSet) && !this.isSetMarkedAsPicked(this.activeSet);
    },
    visiblePickupList() {
      const source =
        this.activeProfileId && this.activeProfileId !== "family"
          ? this.sets.filter((item) => item.ownerProfile === this.activeProfileId)
          : this.sets;

      return [...source].sort((left, right) => {
        const leftChecked = this.isSetMarkedAsPicked(left);
        const rightChecked = this.isSetMarkedAsPicked(right);
        if (leftChecked !== rightChecked) {
          return leftChecked ? 1 : -1;
        }
        return String(left.setNumber || "").localeCompare(String(right.setNumber || ""), "da");
      })
        .filter((item) => this.isSetMarkedForPickup(item))
        .map((item) => {
          const setNumber = item.rebrickableSetNumber || item.setNumber;
          return {
            id: item.collectionKey || this.profileCollectionKey(item.ownerProfile, setNumber),
            ownerProfile: item.ownerProfile || "shared",
            setNumber: item.setNumber,
            rebrickableSetNumber: setNumber,
            name: item.name,
            image: item.image,
            storageLocation: this.resolvePickupStorageLocation(item),
            checked: this.isSetMarkedAsPicked(item)
          };
        });
    }
  },
  watch: {
    searchQuery(value) {
      try {
        localStorage.setItem(SEARCH_QUERY_KEY, value || "");
      } catch {
        // Ignorer lokal storage-fejl.
      }
    },
    searchResults: {
      deep: true,
      handler(value) {
        try {
          localStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(Array.isArray(value) ? value : []));
        } catch {
          // Ignorer lokal storage-fejl.
        }
      }
    }
  },
  async mounted() {
    if (this.activeProfileId && !this.currentProfile) {
      this.activeProfileId = "";
      localStorage.removeItem(PROFILE_KEY);
    }
    await resetCollectionOnce();
    await this.refreshCloudState(true);
    this.syncCollectionMetadataFromApi();
    this.startRealtimeSync();
    await this.restoreRoute();
    window.addEventListener("hashchange", this.restoreRoute);
    document.addEventListener("visibilitychange", this.handleVisibilitySync);
  },
  beforeUnmount() {
    this.stopRealtimeSync();
    window.removeEventListener("hashchange", this.restoreRoute);
    document.removeEventListener("visibilitychange", this.handleVisibilitySync);
  },
  methods: {
    scrollToTop() {
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    restoreScrollPosition(y = 0) {
      const targetY = Math.max(0, Number(y) || 0);
      this.$nextTick(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: "auto" });
          // En ekstra frame gør restore mere robust efter route/render-opdateringer.
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: targetY, behavior: "auto" });
          });
        });
      });
    },
    delay(ms) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
    },
    async refreshCloudState(force = false) {
      if (this.cloudRefreshInFlight) {
        return;
      }

      const now = Date.now();
      if (!force && now - this.cloudLastRefreshAt < CLOUD_REFRESH_MIN_GAP_MS) {
        return;
      }

      this.cloudRefreshInFlight = true;

      try {
        const collection = await loadCollection();
        await this.delay(CLOUD_FETCH_DELAY_MS);
        const missingParts = await loadMissingParts();
        this.sets = collection.map((setItem) => this.normalizeSetOwnership(setItem, setItem.ownerProfile));
        this.syncActiveSet(this.sets);
        this.sales = deriveSalesFromSets(this.sets);
        this.missingParts = Array.isArray(missingParts) ? missingParts : [];
        this.cloudLastRefreshAt = Date.now();
      } finally {
        this.cloudRefreshInFlight = false;
      }
    },
    async syncCollectionMetadataFromApi() {
      if (this.metadataSyncRunning || !this.sets.length) {
        return;
      }

      this.metadataSyncRunning = true;
      let changed = false;

      try {
        // Snapshot så vi kan opdatere stabilt, selv om listen ændres undervejs.
        const snapshot = [...this.sets];

        for (const currentSet of snapshot) {
          const setNumber = currentSet.rebrickableSetNumber || currentSet.setNumber;
          if (!setNumber) {
            continue;
          }

          const remoteSet = await this.fetchBestRemoteSet(setNumber);
          if (!remoteSet) {
            continue;
          }

          const merged = this.normalizeSetOwnership(
            this.mergeSetWithRemoteMetadata(currentSet, remoteSet),
            currentSet.ownerProfile
          );

          if (!this.hasMetadataDiff(currentSet, merged)) {
            continue;
          }

          const key = this.getSetCollectionKey(currentSet);
          await this.savePatchedSetByKey(key, () => merged);
          changed = true;
          await this.delay(COLLECTION_METADATA_SYNC_DELAY_MS);
        }
      } finally {
        this.metadataSyncRunning = false;
      }

      if (changed) {
        await this.refreshCloudState(true);
      }
    },
    profileCollectionKey(ownerProfile, setNumber) {
      return `${ownerProfile || "shared"}:${setNumber}`;
    },
    parseQuantityFromNotes(notes) {
      const match = String(notes || "").match(/\[QTY:(\d+)\]/i);
      const value = match ? Number(match[1]) : 0;
      return value > 0 ? value : 1;
    },
    extractMetaTokenFromNotes(notes, key) {
      const match = String(notes || "").match(new RegExp(`\\[${key}:([^\\]]+)\\]`, "i"));
      return match ? String(match[1] || "").trim() : "";
    },
    isTruthyMetaValue(value) {
      return ["1", "true", "yes", "ja", "done"].includes(String(value || "").trim().toLowerCase());
    },
    withMetaTokenInNotes(notes, key, value) {
      const cleaned = String(notes || "")
        .replace(new RegExp(`\\s*\\[${key}:[^\\]]*\\]\\s*`, "gi"), " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      const normalizedValue = String(value || "").trim();
      if (!normalizedValue) {
        return cleaned;
      }
      return `${cleaned}${cleaned ? " " : ""}[${key}:${normalizedValue}]`.trim();
    },
    normalizeBuildChecklist(value) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
      }

      return Object.entries(value).reduce((accumulator, [key, checked]) => {
        const safeKey = String(key || "").trim();
        if (safeKey && checked) {
          accumulator[safeKey] = true;
        }
        return accumulator;
      }, {});
    },
    parseBuildChecklistFromNotes(notes) {
      const raw = this.extractMetaTokenFromNotes(notes, "BUILD_CHK");
      if (!raw) {
        return {};
      }

      return raw
        .split(",")
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .reduce((accumulator, key) => {
          accumulator[key] = true;
          return accumulator;
        }, {});
    },
    serializeBuildChecklist(checklist) {
      const keys = Object.entries(this.normalizeBuildChecklist(checklist))
        .filter(([, checked]) => Boolean(checked))
        .map(([key]) => key)
        .sort((left, right) => left.localeCompare(right, "da"));
      return keys.join(",");
    },
    withBuildChecklistInNotes(notes, checklist) {
      const token = this.serializeBuildChecklist(checklist);
      return this.withMetaTokenInNotes(notes, "BUILD_CHK", token);
    },
    getSetCollectionKey(setItem) {
      return (
        setItem.collectionKey ||
        this.profileCollectionKey(setItem.ownerProfile, setItem.rebrickableSetNumber || setItem.setNumber)
      );
    },
    isSetMarkedForPickup(setItem) {
      const token = this.extractMetaTokenFromNotes(setItem?.notes || "", "PICKUP");
      return this.isTruthyMetaValue(token);
    },
    isSetMarkedAsPicked(setItem) {
      const token = this.extractMetaTokenFromNotes(setItem?.notes || "", "PICKED");
      return this.isTruthyMetaValue(token);
    },
    resolvePickupStorageLocation(setItem) {
      const boxFromNotes = this.extractMetaTokenFromNotes(setItem?.notes || "", "BOX_LOC");
      return boxFromNotes || this.normalizeLegacyBoxLocation(setItem?.storageLocation) || "Hjemme";
    },
    findSetByCollectionKey(collectionKey) {
      return this.sets.find((item) => this.getSetCollectionKey(item) === collectionKey) || null;
    },
    async savePatchedSetByKey(collectionKey, patcher) {
      const current = this.findSetByCollectionKey(collectionKey);
      if (!current) {
        return;
      }

      const previousSet = { ...current };
      const nextCandidate = typeof patcher === "function" ? patcher(current) : { ...current, ...patcher };
      const nextSet = this.normalizeSetOwnership(nextCandidate, current.ownerProfile);
      const nextSets = this.sets.map((item) => (this.getSetCollectionKey(item) === collectionKey ? nextSet : item));

      this.sets = nextSets;
      this.syncActiveSet(nextSets);
      this.sales = deriveSalesFromSets(nextSets);

      await saveCollectionSet(nextSet, previousSet);
    },
    normalizeLegacyBoxLocation(storageLocation) {
      const raw = String(storageLocation || "").trim();
      if (!raw) {
        return "";
      }

      if (/^hjemme$/i.test(raw)) {
        return "Hjemme";
      }

      const poseMatch =
        raw.match(/^pose\s*(\d{1,3})$/i) ||
        raw.match(/^pose[-\s]*(\d{1,3})$/i) ||
        raw.match(/^(s[æa]k|kasse)\s*(nr)?[-\s:]*?(\d{1,3})$/i) ||
        raw.match(/^(\d{1,3})$/);
      if (poseMatch) {
        const number = Number(poseMatch[poseMatch.length - 1]);
        return number > 0 ? `Pose ${number}` : "";
      }

      return "";
    },
    stripQuantityToken(notes) {
      return String(notes || "")
        .replace(/\s*\[QTY:\d+\]\s*/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    },
    embedQuantityInNotes(notes, quantityOwned) {
      const clean = this.stripQuantityToken(notes);
      const quantity = Math.max(1, Number(quantityOwned) || 1);
      return quantity > 1 ? `${clean}${clean ? " " : ""}[QTY:${quantity}]` : clean;
    },
    normalizeSetOwnership(setItem, fallbackOwnerProfile = "shared") {
      const ownerProfile = setItem.ownerProfile || fallbackOwnerProfile;
      const setNumber = setItem.rebrickableSetNumber || setItem.setNumber;
      const quantityOwned = Math.max(1, Number(setItem.quantityOwned) || this.parseQuantityFromNotes(setItem.notes));
      const parsedPieces = Math.max(0, Number(setItem.pieces) || 0);
      const parsedYear = Number(setItem.year) || "";
      const existingNotes = String(setItem.notes || "");
      const explicitChecklist = this.normalizeBuildChecklist(setItem.buildChecklist);
      const checklistFromNotes = this.parseBuildChecklistFromNotes(existingNotes);
      const buildChecklist = Object.keys(explicitChecklist).length ? explicitChecklist : checklistFromNotes;
      const boxFromNotes = this.extractMetaTokenFromNotes(existingNotes, "BOX_LOC");
      const legacyBoxLocation = boxFromNotes || this.normalizeLegacyBoxLocation(setItem.storageLocation);
      let normalizedNotes = this.embedQuantityInNotes(existingNotes, quantityOwned);
      if (legacyBoxLocation) {
        normalizedNotes = this.withMetaTokenInNotes(normalizedNotes, "BOX_LOC", legacyBoxLocation);
      }
      normalizedNotes = this.withBuildChecklistInNotes(normalizedNotes, buildChecklist);
      return {
        ...setItem,
        ownerProfile,
        collectionKey: setItem.collectionKey || this.profileCollectionKey(ownerProfile, setNumber),
        storageLocation: /^lager$/i.test(String(setItem.storageLocation || "").trim()) ? "Lager" : "Hjemme",
        pieces: parsedPieces,
        year: parsedYear,
        image: this.resolveSetImage(setItem),
        askingPrice: Number(setItem.askingPrice) || 0,
        salePlatforms: Array.isArray(setItem.salePlatforms) ? setItem.salePlatforms : [],
        quantityOwned,
        buildChecklist,
        notes: normalizedNotes
      };
    },
    findSetInCollection(requestedSetNumber, profileId = "") {
      const normalized = String(requestedSetNumber || "")
        .trim()
        .replace(/\s+/g, "");
      const baseNumber = normalized.split("-")[0];
      const variantNumber = normalized.includes("-") ? normalized : `${normalized}-1`;

      return this.sets.find(
        (item) =>
          (!profileId || item.ownerProfile === profileId) &&
          [item.rebrickableSetNumber, item.setNumber].some((value) => {
            const current = String(value || "")
              .trim()
              .replace(/\s+/g, "");
            return current === normalized || current === baseNumber || current === variantNumber;
          })
      );
    },
    selectProfile(profileId) {
      this.activeProfileId = profileId;
      localStorage.setItem(PROFILE_KEY, profileId);
      this.currentView = "home";
      this.activeSet = null;
      this.drawerOpen = false;
      this.setRoute("/home");
    },
    clearProfile() {
      this.activeProfileId = "";
      localStorage.removeItem(PROFILE_KEY);
      this.drawerOpen = false;
    },
    syncActiveSet(records) {
      if (!this.activeSet) {
        return;
      }

      const key =
        this.activeSet.collectionKey ||
        this.profileCollectionKey(
          this.activeSet.ownerProfile,
          this.activeSet.rebrickableSetNumber || this.activeSet.setNumber
        );
      const nextActiveSet = records.find(
        (item) =>
          (item.collectionKey || this.profileCollectionKey(item.ownerProfile, item.rebrickableSetNumber || item.setNumber)) ===
          key
      );

      if (nextActiveSet) {
        this.activeSet = this.normalizeSetOwnership({ ...this.activeSet, ...nextActiveSet }, nextActiveSet.ownerProfile);
      }
    },
    startRealtimeSync() {
      if (!hasSupabaseConfig()) {
        return;
      }

      this.stopRealtimeSync();

      this.stopCollectionSync = subscribeToCollectionChanges((records) => {
        this.sets = (Array.isArray(records) ? records : []).map((setItem) =>
          this.normalizeSetOwnership(setItem, setItem.ownerProfile)
        );
        this.syncActiveSet(this.sets);
        this.sales = deriveSalesFromSets(this.sets);
      });

      this.stopMissingPartsSync = subscribeToMissingPartsChanges((records) => {
        this.missingParts = Array.isArray(records) ? records : [];
      });

      this.cloudRefreshTimer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          this.refreshCloudState();
        }
      }, CLOUD_REFRESH_INTERVAL_MS);
    },
    stopRealtimeSync() {
      if (typeof this.stopCollectionSync === "function") {
        this.stopCollectionSync();
      }
      if (typeof this.stopMissingPartsSync === "function") {
        this.stopMissingPartsSync();
      }
      this.stopCollectionSync = null;
      this.stopMissingPartsSync = null;
      if (this.cloudRefreshTimer) {
        window.clearInterval(this.cloudRefreshTimer);
      }
      this.cloudRefreshTimer = null;
    },
    async handleVisibilitySync() {
      if (document.visibilityState === "visible") {
        await this.refreshCloudState(true);
      }
    },
    setRoute(path) {
      const next = `#${path}`;
      localStorage.setItem(ROUTE_KEY, path);
      if (window.location.hash !== next) {
        window.location.hash = next;
      }
    },
    async restoreRoute() {
      const path = getRoutePath();
      const buildMatchWithProfile = path.match(/^\/set\/([^/]+)\/(.+)\/build$/);
      const buildLegacyMatch = path.match(/^\/set\/(.+)\/build$/);
      const buildMatch = buildMatchWithProfile || buildLegacyMatch;
      if (buildMatch) {
        const profileId = buildMatchWithProfile ? buildMatch[1] : "";
        const requestedSetNumber = buildMatchWithProfile ? buildMatch[2] : buildMatch[1];
        const localSet = this.findSetInCollection(requestedSetNumber, profileId);

        try {
          const remoteSet = await rebrickableClient.getSet(requestedSetNumber);
          const setItem = localSet ? this.mergeSetWithRemoteMetadata(localSet, remoteSet) : remoteSet;
          this.activeSet = this.normalizeSetOwnership(setItem, localSet?.ownerProfile || this.activeProfileId || "shared");
          this.currentView = "build";
          this.$nextTick(() => this.scrollToTop());
          await this.ensureSetMetadataFromApi(this.activeSet);
        } catch {
          if (localSet) {
            this.activeSet = this.normalizeSetOwnership(localSet, localSet.ownerProfile || this.activeProfileId || "shared");
            this.currentView = "build";
            this.$nextTick(() => this.scrollToTop());
            await this.ensureSetMetadataFromApi(this.activeSet);
          } else {
            this.currentView = "search";
          }
        }
        return;
      }

      const matchWithProfile = path.match(/^\/set\/([^/]+)\/(.+)$/);
      const legacyMatch = path.match(/^\/set\/(.+)$/);
      const match = matchWithProfile || legacyMatch;
      if (match) {
        const profileId = matchWithProfile ? match[1] : "";
        const requestedSetNumber = matchWithProfile ? match[2] : match[1];
        const localSet = this.findSetInCollection(requestedSetNumber, profileId);

        try {
          const remoteSet = await rebrickableClient.getSet(requestedSetNumber);
          const setItem = localSet ? this.mergeSetWithRemoteMetadata(localSet, remoteSet) : remoteSet;
          this.activeSet = this.normalizeSetOwnership(setItem, localSet?.ownerProfile || this.activeProfileId || "shared");
          this.currentView = "detail";
          this.$nextTick(() => this.scrollToTop());
          this.setPartsRequested = false;
          this.setParts = [];
          this.setPartsPage = 0;
          this.hasMoreSetParts = false;
          this.setPartsError = "";
          await this.ensureSetMetadataFromApi(this.activeSet);
        } catch {
          if (localSet) {
            this.activeSet = this.normalizeSetOwnership(localSet, localSet.ownerProfile || this.activeProfileId || "shared");
            this.currentView = "detail";
            this.$nextTick(() => this.scrollToTop());
            this.setPartsRequested = false;
            this.setParts = [];
            this.setPartsPage = 0;
            this.hasMoreSetParts = false;
            this.setPartsError = "";
            await this.ensureSetMetadataFromApi(this.activeSet);
          } else {
            this.currentView = "search";
          }
        }
        return;
      }

      const routeMap = new Set([
        "/home",
        "/collection",
        "/search",
        "/parts",
        "/pickup",
        "/missing-parts",
        "/sales",
        "/stats",
        "/settings",
        "/import-collection"
      ]);

      const resolved = routeMap.has(path) ? path.slice(1) : "home";
      this.currentView = resolved;
    },
    navigate(viewId) {
      if (viewId === "drawer") {
        this.drawerOpen = !this.drawerOpen;
        return;
      }

      this.drawerOpen = false;
      this.currentView = viewId;
      this.setRoute(`/${viewId}`);
    },
    addActiveSetToPickup() {
      if (!this.activeSet) {
        return;
      }
      const key = this.getSetCollectionKey(this.activeSet);
      this.savePatchedSetByKey(key, (setItem) => {
        let notes = setItem.notes || "";
        notes = this.withMetaTokenInNotes(notes, "PICKUP", "1");
        notes = this.withMetaTokenInNotes(notes, "PICKED", "0");
        return {
          ...setItem,
          notes
        };
      }).then(() => this.refreshCloudState(true));
    },
    togglePickupChecked(itemId) {
      this.savePatchedSetByKey(itemId, (setItem) => {
        const currentlyPicked = this.isSetMarkedAsPicked(setItem);
        let notes = setItem.notes || "";
        notes = this.withMetaTokenInNotes(notes, "PICKUP", "1");
        notes = this.withMetaTokenInNotes(notes, "PICKED", currentlyPicked ? "0" : "1");
        return {
          ...setItem,
          notes
        };
      }).then(() => this.refreshCloudState(true));
    },
    removePickupEntry(itemId) {
      this.savePatchedSetByKey(itemId, (setItem) => {
        let notes = setItem.notes || "";
        notes = this.withMetaTokenInNotes(notes, "PICKUP", "");
        notes = this.withMetaTokenInNotes(notes, "PICKED", "");
        return {
          ...setItem,
          notes
        };
      }).then(() => this.refreshCloudState(true));
    },
    async clearCheckedPickupEntries() {
      const checkedItems = this.visiblePickupList.filter((item) => item.checked);
      for (const item of checkedItems) {
        await this.savePatchedSetByKey(item.id, (setItem) => {
          let notes = setItem.notes || "";
          notes = this.withMetaTokenInNotes(notes, "PICKUP", "");
          notes = this.withMetaTokenInNotes(notes, "PICKED", "");
          return {
            ...setItem,
            notes
          };
        });
      }
      await this.refreshCloudState(true);
    },
    openPickupSet(item) {
      if (!item) {
        return;
      }

      const match = this.findSetInCollection(item.rebrickableSetNumber || item.setNumber, item.ownerProfile);
      if (match) {
        this.openSet(match);
        return;
      }

      this.currentView = "collection";
      this.setRoute("/collection");
    },
    getBaseSetNumber(setNumber) {
      return String(setNumber || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/[–—]/g, "-")
        .split("-")[0];
    },
    buildOfficialManualUrl(setNumber) {
      const normalized = this.getBaseSetNumber(setNumber);
      return normalized ? `https://www.lego.com/en-us/service/buildinginstructions/${normalized}` : "";
    },
    openManual(setNumber) {
      const baseSetNumber = this.getBaseSetNumber(setNumber);
      if (!baseSetNumber) {
        this.manualOpenError = "Manual ikke fundet.";
        return;
      }
      const url = this.buildOfficialManualUrl(baseSetNumber);
      if (!url) {
        this.manualOpenError = "Manual ikke fundet.";
        return;
      }
      this.manualOpenError = "";
      this.manualOpeningSetNumber = baseSetNumber;
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => {
        if (this.manualOpeningSetNumber === baseSetNumber) {
          this.manualOpeningSetNumber = "";
        }
      }, 700);
    },
    goBackFromSetDetail() {
      this.currentView = "collection";
      this.setRoute("/collection");
      const targetScroll = Number(this.lastCollectionScrollY) || 0;
      this.restoreScrollPosition(targetScroll);
    },
    openBuildForActiveSet() {
      if (!this.activeSet) {
        return;
      }
      this.currentView = "build";
      this.setRoute(`/set/${this.activeSet.ownerProfile || "shared"}/${this.activeSet.setNumber}/build`);
      this.$nextTick(() => this.scrollToTop());
    },
    goBackFromBuild() {
      if (!this.activeSet) {
        this.currentView = "collection";
        this.setRoute("/collection");
        return;
      }

      this.currentView = "detail";
      this.setRoute(`/set/${this.activeSet.ownerProfile || "shared"}/${this.activeSet.setNumber}`);
      this.$nextTick(() => this.scrollToTop());
    },
    updateBuildChecklist(nextChecklist) {
      if (!this.activeSet) {
        return;
      }

      const key = this.getSetCollectionKey(this.activeSet);
      this.savePatchedSetByKey(key, (setItem) => ({
        ...setItem,
        buildChecklist: nextChecklist && typeof nextChecklist === "object" ? nextChecklist : {}
      })).then(() => this.refreshCloudState(true));
    },
    normalizeImagePath(imageUrl) {
      return String(imageUrl || "")
        .trim()
        .replace(/^https?:\/\/cdn\.rebrickable\.com/i, "")
        .replace(/\?.*$/, "")
        .toLowerCase();
    },
    isSetImageMismatch(setItem) {
      const image = String(setItem?.image || "").trim();
      if (!image || image === "/images/lego-placeholder.png") {
        return true;
      }

      const setNumber = setItem?.rebrickableSetNumber || setItem?.setNumber;
      if (!setNumber) {
        return false;
      }

      const normalizedSetNumber = normalizeSetNumber(setNumber).toLowerCase();
      const normalizedImage = this.normalizeImagePath(image);

      // Only validate Rebrickable image URLs - custom images should be preserved.
      if (!normalizedImage.includes("/media/sets/")) {
        return false;
      }

      return !normalizedImage.includes(`/media/sets/${normalizedSetNumber}.`);
    },
    resolveSetImage(setItem, remoteSet = null) {
      const currentImage = String(setItem?.image || "").trim();
      const remoteImage = String(remoteSet?.image || "").trim();
      const referenceSetNumber =
        remoteSet?.rebrickableSetNumber || remoteSet?.setNumber || setItem?.rebrickableSetNumber || setItem?.setNumber || "";
      const fallbackImage = referenceSetNumber ? getSetImageUrl(referenceSetNumber) : "";

      if (!currentImage || currentImage === "/images/lego-placeholder.png") {
        return remoteImage || fallbackImage || currentImage;
      }

      if (this.isSetImageMismatch(setItem)) {
        return remoteImage || fallbackImage || currentImage;
      }

      return currentImage;
    },
    isSetMetadataMissing(setItem) {
      if (!setItem) {
        return false;
      }

      const hasName = String(setItem.name || "").trim();
      const hasTheme = String(setItem.theme || "").trim();
      const hasYear = Number(setItem.year) > 0;
      const hasPieces = Number(setItem.pieces) > 0;
      const hasMatchingImage = !this.isSetImageMismatch(setItem);
      return !(hasName && hasTheme && hasYear && hasPieces && hasMatchingImage);
    },
    mergeSetWithRemoteMetadata(setItem, remoteSet) {
      const currentName = String(setItem?.name || "").trim();
      const currentTheme = String(setItem?.theme || "").trim();
      const currentYear = Number(setItem?.year) || 0;
      const isPlaceholderName = /^lego s[æa]t\s+\d+/i.test(currentName);
      const resolvedTheme = String(remoteSet?.theme || remoteSet?.themeName || "").trim();
      const fallbackSetNumber = String(setItem?.setNumber || remoteSet?.setNumber || "").split("-")[0];
      const remotePieces = Math.max(0, Number(remoteSet?.pieces) || 0);
      const remoteYear = Number(remoteSet?.year) || 0;

      return {
        ...setItem,
        setNumber: setItem?.setNumber || fallbackSetNumber,
        rebrickableSetNumber:
          setItem?.rebrickableSetNumber || remoteSet?.rebrickableSetNumber || remoteSet?.setNumber || "",
        name: !currentName || isPlaceholderName ? remoteSet?.name || currentName : currentName,
        theme: currentTheme || resolvedTheme,
        year: remoteYear > 0 ? remoteYear : currentYear || "",
        pieces: remotePieces > 0 ? remotePieces : Math.max(0, Number(setItem?.pieces) || 0),
        image: this.resolveSetImage(setItem, remoteSet),
        manualUrl: setItem?.manualUrl || remoteSet?.manualUrl || ""
      };
    },
    hasMetadataDiff(currentSet, nextSet) {
      const fields = ["name", "theme", "manualUrl", "image", "rebrickableSetNumber", "setNumber"];
      const hasPrimitiveDiff = fields.some((field) => String(currentSet?.[field] || "") !== String(nextSet?.[field] || ""));
      if (hasPrimitiveDiff) {
        return true;
      }

      const currentYear = Number(currentSet?.year) || 0;
      const nextYear = Number(nextSet?.year) || 0;
      if (currentYear !== nextYear) {
        return true;
      }

      const currentPieces = Math.max(0, Number(currentSet?.pieces) || 0);
      const nextPieces = Math.max(0, Number(nextSet?.pieces) || 0);
      return currentPieces !== nextPieces;
    },
    async fetchBestRemoteSet(setNumber) {
      if (!setNumber) {
        return null;
      }

      try {
        return await rebrickableClient.getSet(setNumber);
      } catch {
        try {
          return await rebrickableClient.findSetBySpreadsheetNumber(setNumber);
        } catch {
          return null;
        }
      }
    },
    async resolveSetNumberForParts(setNumber) {
      const raw = String(setNumber || "").trim();
      if (!raw) {
        return "";
      }

      const cached = this.resolvedPartsSetNumbers[raw];
      if (cached) {
        return cached;
      }

      const normalized = normalizeSetNumber(raw);
      const candidates = new Set([normalized, raw]);

      // Try base number variant as fallback if needed.
      const base = normalized.split("-")[0];
      if (base) {
        candidates.add(`${base}-1`);
        candidates.add(base);
      }

      for (const candidate of candidates) {
        try {
          await rebrickableClient.getSetPartsPage(candidate, 1);
          this.resolvedPartsSetNumbers = {
            ...this.resolvedPartsSetNumbers,
            [raw]: candidate
          };
          return candidate;
        } catch {
          // Try next candidate.
        }
      }

      try {
        const resolvedSet = await rebrickableClient.findSetBySpreadsheetNumber(normalized);
        const resolvedNumber = resolvedSet.rebrickableSetNumber || resolvedSet.setNumber || normalized;
        await rebrickableClient.getSetPartsPage(resolvedNumber, 1);
        this.resolvedPartsSetNumbers = {
          ...this.resolvedPartsSetNumbers,
          [raw]: resolvedNumber
        };
        return resolvedNumber;
      } catch {
        return normalized;
      }
    },
    async ensureSetMetadataFromApi(setItem = this.activeSet) {
      if (!setItem) {
        return;
      }

      const setNumber = setItem.rebrickableSetNumber || setItem.setNumber;
      if (!setNumber) {
        return;
      }

      const remoteSet = await this.fetchBestRemoteSet(setNumber);
      if (!remoteSet) {
        // Hvis API'et ikke svarer, beholder vi den eksisterende lokale data.
        return;
      }

      const hydratedSet = this.mergeSetWithRemoteMetadata(setItem, remoteSet);
      if (this.hasMetadataDiff(setItem, hydratedSet) || this.isSetMetadataMissing(setItem)) {
        this.updateSet(hydratedSet);
      }
    },
    async openSet(setItem) {
      this.lastViewBeforeDetail = this.currentView || "collection";
      if (this.currentView === "collection") {
        this.lastCollectionScrollY = window.scrollY || window.pageYOffset || 0;
      }
      this.manualOpenError = "";
      this.manualOpeningSetNumber = "";
      this.activeSet = this.normalizeSetOwnership(setItem, setItem.ownerProfile);
      this.drawerOpen = false;
      this.currentView = "detail";
      this.$nextTick(() => this.scrollToTop());
      this.setPartsRequested = false;
      this.setParts = [];
      this.setPartsPage = 0;
      this.hasMoreSetParts = false;
      this.setPartsError = "";
      this.setRoute(`/set/${setItem.ownerProfile || "shared"}/${setItem.setNumber}`);
      await this.ensureSetMetadataFromApi(this.activeSet);
    },
    async performGlobalSearch() {
      const query = this.searchQuery.trim();
      const compact = query.replace(/\s+/g, "").replace(/[–—]/g, "-");
      const isNumericQuery = /^\d{2,6}(?:-\d+)?$/.test(compact);

      if (!query) {
        this.searchResults = [];
        this.searchError = "";
        return;
      }

      this.searchLoading = true;
      this.searchError = "";
      this.searchResults = [];

      if (isNumericQuery) {
        const normalized = compact;
        try {
          const directSet = await rebrickableClient.getSet(normalized);
          this.searchResults = [directSet];
        } catch {
          try {
            const matchedSet = await rebrickableClient.findSetBySpreadsheetNumber(normalized);
            this.searchResults = [matchedSet];
            this.searchError = "";
          } catch {
            const fallbackSet = this.findLocalSetByNumber(normalized);
            if (fallbackSet) {
              this.searchResults = [this.createSearchResultFromLocalSet(fallbackSet, normalized)];
              this.searchError = "";
            } else {
              this.searchResults = [this.createManualSearchResult(normalized)];
              this.searchError = "";
            }
          }
        } finally {
          this.searchLoading = false;
        }
        return;
      }

      try {
        const terms = this.expandSetSearchTerms(query);
        const termResults = [];
        let hadTermRequestFailure = false;

        for (const term of terms) {
          try {
            termResults.push(await rebrickableClient.searchSets(term, 45));
          } catch {
            hadTermRequestFailure = true;
          }
          await this.delay(SEARCH_TERM_DELAY_MS);
        }

        let themeResults = [];
        if (termResults.flat().length < 40) {
          themeResults = await rebrickableClient.searchSetsByThemeName(query, 90).catch(() => []);
        }

        const deduped = new Map();
        [...termResults.flat(), ...themeResults].forEach((item) => {
          const key = item.rebrickableSetNumber || item.setNumber;
          if (key && !deduped.has(key)) {
            deduped.set(key, item);
          } else {
            const current = deduped.get(key);
            if (current && !current.theme && item.theme) {
              deduped.set(key, item);
            }
          }
        });

        this.searchResults = this.rankSetResultsByQuery([...deduped.values()], query).slice(0, 80);
        if (!this.searchResults.length && hadTermRequestFailure) {
          this.searchError = "Søgningen havde forbindelsesfejl. Prøv igen om et øjeblik.";
        }
      } catch {
        this.searchError = "Kunne ikke søge i LEGO databasen.";
      } finally {
        this.searchLoading = false;
      }
    },
    normalizeSearchText(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    },
    levenshteinDistance(left, right) {
      const a = String(left || "");
      const b = String(right || "");
      if (!a.length) {
        return b.length;
      }
      if (!b.length) {
        return a.length;
      }

      const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
      for (let i = 1; i <= a.length; i += 1) {
        let diagonal = previous[0];
        previous[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
          const temp = previous[j];
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + cost);
          diagonal = temp;
        }
      }
      return previous[b.length];
    },
    similarityScore(left, right) {
      const a = this.normalizeSearchText(left);
      const b = this.normalizeSearchText(right);
      if (!a || !b) {
        return 0;
      }
      if (a === b) {
        return 1;
      }
      const distance = this.levenshteinDistance(a, b);
      return 1 - distance / Math.max(a.length, b.length, 1);
    },
    expandSetSearchTerms(query) {
      const normalized = this.normalizeSearchText(query);
      const rawQuery = String(query || "").trim();
      const terms = new Set([rawQuery]);
      const synonymMap = {
        brandbil: ["fire truck", "fire engine", "city fire"],
        brand: ["fire", "city fire", "fire station"],
        city: ["lego city"],
        teknik: ["technic", "lego technic"],
        technic: ["lego technic"],
        friends: ["lego friends"],
        politi: ["police", "city police"],
        tog: ["train", "city train"],
        fly: ["airplane", "plane"],
        helikopter: ["helicopter"],
        lastbil: ["truck"],
        cykel: ["bike", "bicycle"],
        borg: ["castle"],
        hus: ["house"],
        rum: ["space"],
        traktor: ["tractor"],
        gravko: ["excavator"],
        monstertruck: ["monster truck"],
        racerbil: ["race car", "racing car"],
        feriehjem: ["holiday", "vacation"]
      };

      Object.entries(synonymMap).forEach(([token, relatedTerms]) => {
        if (normalized.includes(token)) {
          relatedTerms.forEach((term) => terms.add(term));
        }
      });

      const withoutLegoPrefix = rawQuery.replace(/^lego\s+/i, "").trim();
      if (withoutLegoPrefix) {
        terms.add(withoutLegoPrefix);
      }

      normalized
        .split(/\s+/)
        .filter((token) => token.length >= 3)
        .forEach((token) => terms.add(token));

      return [...terms].filter(Boolean).slice(0, 5);
    },
    rankSetResultsByQuery(results, query) {
      const normalizedQuery = this.normalizeSearchText(query);
      const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
      const compactQuery = normalizedQuery.replace(/\s+/g, "");

      const scoreForItem = (item) => {
        const name = this.normalizeSearchText(item.name);
        const theme = this.normalizeSearchText(item.theme || item.themeName || "");
        const setNumber = this.normalizeSearchText(item.setNumber || item.rebrickableSetNumber || "");
        const compactName = name.replace(/\s+/g, "");
        let score = 0;

        if (setNumber === compactQuery) {
          score += 200;
        } else if (setNumber.startsWith(compactQuery) && compactQuery.length >= 3) {
          score += 80;
        }

        if (name === normalizedQuery) {
          score += 120;
        }

        if (theme === normalizedQuery) {
          score += 140;
        }

        if (name.startsWith(normalizedQuery) && normalizedQuery.length >= 3) {
          score += 40;
        }

        if (theme.startsWith(normalizedQuery) && normalizedQuery.length >= 3) {
          score += 50;
        }

        queryTokens.forEach((token) => {
          if (name.includes(token)) {
            score += 5;
          }
          if (theme.includes(token)) {
            score += 7;
          }
          if (setNumber.includes(token)) {
            score += 10;
          }
        });

        if (theme && normalizedQuery && theme.includes(normalizedQuery)) {
          score += 10;
        }

        const fuzzyName = this.similarityScore(normalizedQuery, name);
        const fuzzyTheme = this.similarityScore(normalizedQuery, theme);
        if (fuzzyName > 0.55) {
          score += Math.round(fuzzyName * 35);
        }
        if (fuzzyTheme > 0.55) {
          score += Math.round(fuzzyTheme * 45);
        }

        if (compactQuery && compactName.includes(compactQuery)) {
          score += 15;
        }

        return score;
      };

      return [...results].sort((left, right) => {
        const scoreDiff = scoreForItem(right) - scoreForItem(left);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        const yearDiff = Number(right.year || 0) - Number(left.year || 0);
        if (yearDiff !== 0) {
          return yearDiff;
        }

        return String(left.name || "").localeCompare(String(right.name || ""), "da");
      });
    },
    findLocalSetByNumber(setNumber) {
      const normalized = String(setNumber || "")
        .trim()
        .replace(/\s+/g, "");
      const withVariant = normalized.includes("-") ? normalized : `${normalized}-1`;

      return this.sets.find(
        (item) =>
          String(item.rebrickableSetNumber || "")
            .trim()
            .replace(/\s+/g, "") === withVariant ||
          String(item.setNumber || "")
            .trim()
            .replace(/\s+/g, "") === normalized
      );
    },
    createSearchResultFromLocalSet(setItem, fallbackSetNumber = "") {
      const setNumber = setItem.setNumber || String(fallbackSetNumber || "").replace(/-1$/, "");
      const rebrickableSetNumber = setItem.rebrickableSetNumber || (setNumber ? `${setNumber}-1` : "");

      return {
        collectionKey: "",
        setNumber,
        rebrickableSetNumber,
        ownerProfile: "",
        name: setItem.name || "Ukendt LEGO sæt",
        theme: setItem.theme || "",
        themeName: setItem.theme || "",
        year: setItem.year || "",
        pieces: Number(setItem.pieces) || 0,
        image: setItem.image || getSetImageUrl(rebrickableSetNumber || setNumber),
        manualUrl: setItem.manualUrl || getLegoInstructionsUrl(rebrickableSetNumber || setNumber),
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
        wanted: false,
        isManualFallback: false,
        fallbackReason: ""
      };
    },
    createManualSearchResult(setNumber) {
      const rawSetNumber = String(setNumber || "")
        .trim()
        .replace(/\s+/g, "");
      const normalizedSetNumber = normalizeSetNumber(rawSetNumber);
      const baseSetNumber = normalizedSetNumber.split("-")[0];

      return {
        collectionKey: "",
        setNumber: baseSetNumber,
        rebrickableSetNumber: normalizedSetNumber,
        ownerProfile: "",
        name: `LEGO sæt ${baseSetNumber}`,
        theme: "",
        themeName: "",
        year: "",
        pieces: 0,
        image: getSetImageUrl(normalizedSetNumber),
        manualUrl: getLegoInstructionsUrl(normalizedSetNumber),
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
        wanted: false,
        isManualFallback: true,
        fallbackReason: "LEGO databasen svarer ikke lige nu. Du kan stadig tilføje sættet manuelt."
      };
    },
    selectImportFile(file) {
      this.importState = {
        ...this.importState,
        file,
        fileName: file?.name || "",
        finished: false,
        total: 0,
        completed: 0,
        currentSetNumber: "",
        imported: [],
        errors: []
      };
    },
    parseBooleanCell(value) {
      const normalized = String(value || "").trim().toLowerCase();
      return ["1", "true", "ja", "yes", "x"].includes(normalized);
    },
    normalizeSpreadsheetSetNumber(value) {
      const normalized = String(value || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/[–—]/g, "-")
        .replace(/\.0$/, "");
      if (!normalized) {
        return "";
      }

      return normalized.includes("-") ? normalized : `${normalized}-1`;
    },
    normalizeSpreadsheetHeaderKey(value) {
      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/æ/g, "ae")
        .replace(/ø/g, "oe")
        .replace(/å/g, "aa")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
    },
    getSpreadsheetCell(row, aliases) {
      const normalizedEntries = Object.entries(row || {}).map(([key, value]) => [
        this.normalizeSpreadsheetHeaderKey(key),
        value
      ]);

      for (const alias of aliases) {
        const match = normalizedEntries.find(([key]) => key === this.normalizeSpreadsheetHeaderKey(alias));
        if (match) {
          return match[1];
        }
      }

      return "";
    },
    looksLikeSetNumber(value) {
      const normalized = String(value || "")
        .trim()
        .replace(/\s+/g, "")
        .replace(/[–—]/g, "-")
        .replace(/\.0$/, "");
      return /^\d{2,6}(-\d+)?$/.test(normalized);
    },
    extractSetNumberCandidatesFromValue(value) {
      const raw = String(value || "").trim();
      if (!raw) {
        return [];
      }

      const candidates = new Set();
      const compact = raw.replace(/[–—]/g, "-").replace(/\.0$/, "");

      if (this.looksLikeSetNumber(compact)) {
        candidates.add(compact.replace(/\s+/g, ""));
      }

      const explicitMatches = compact.match(/\b\d{2,6}(?:-\d+)?\b/g) || [];
      explicitMatches.forEach((match) => candidates.add(match));

      const spacedDigits = compact.match(/\b\d(?:[\s.-]?\d){1,7}\b/g) || [];
      spacedDigits.forEach((match) => {
        const collapsed = match.replace(/[^\d-]/g, "");
        if (this.looksLikeSetNumber(collapsed)) {
          candidates.add(collapsed);
        }
        const onlyDigits = match.replace(/\D/g, "");
        if (/^\d{2,6}$/.test(onlyDigits)) {
          candidates.add(onlyDigits);
        }
      });

      return [...candidates];
    },
    extractSpreadsheetRows(worksheet, XLSX) {
      const aliasSet = new Set(["setnumber", "setnum", "setnr", "setid", "number", "saetnummer", "set"]);
      const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      const nonEmptyRows = grid.filter((row) => Array.isArray(row) && row.some((cell) => String(cell || "").trim()));

      if (!nonEmptyRows.length) {
        return [];
      }

      let headerRowIndex = -1;
      let headerScore = 0;

      nonEmptyRows.slice(0, 8).forEach((row, index) => {
        const score = row.reduce((sum, cell) => {
          const normalized = this.normalizeSpreadsheetHeaderKey(cell);
          return sum + (aliasSet.has(normalized) ? 1 : 0);
        }, 0);

        if (score > headerScore) {
          headerScore = score;
          headerRowIndex = index;
        }
      });

      if (headerScore > 0 && headerRowIndex >= 0) {
        const headers = nonEmptyRows[headerRowIndex].map((cell, index) => {
          const normalized = String(cell || "").trim();
          return normalized || `column${index + 1}`;
        });

        return nonEmptyRows.slice(headerRowIndex + 1).map((row) =>
          headers.reduce((mapped, header, index) => {
            mapped[header] = row[index] ?? "";
            return mapped;
          }, {})
        );
      }

      return nonEmptyRows.map((row) =>
        row.reduce((mapped, cell, index) => {
          mapped[`column${index + 1}`] = cell;
          return mapped;
        }, {})
      );
    },
    getSetNumberFromRow(row) {
      const direct = this.getSpreadsheetCell(row, [
        "setnumber",
        "setnum",
        "setnr",
        "setid",
        "number",
        "saetnummer",
        "set",
        "lego set nr",
        "lego saet nr",
        "lego saet aeske nr",
        "legosetaskenr",
        "legosaetaeskenr",
        "legosaetaskenr",
        "legosaetnr",
        "legosætnr",
        "æske nr",
        "askenr"
      ]);

      const directCandidates = this.extractSetNumberCandidatesFromValue(direct);
      if (directCandidates.length) {
        return directCandidates[0];
      }

      const values = Object.values(row || {});
      for (const value of values) {
        const candidates = this.extractSetNumberCandidatesFromValue(value);
        if (candidates.length) {
          return candidates[0];
        }
      }

      return "";
    },
    parseSpreadsheetYear(value) {
      const normalized = String(value || "").match(/\d{4}/);
      return normalized ? Number(normalized[0]) : "";
    },
    parseSpreadsheetPieces(row) {
      const raw = this.getSpreadsheetCell(row, ["antal klodser", "antal klodser:", "klodser", "pieces", "num parts"]);
      const normalized = String(raw || "")
        .replace(/\./g, "")
        .replace(/,/g, "")
        .match(/\d+/);
      return normalized ? Number(normalized[0]) : 0;
    },
    parseSpreadsheetQuantity(row) {
      const raw = this.getSpreadsheetCell(row, ["antal", "qty", "quantity", "antal sæt", "antal saet"]);
      const normalized = String(raw || "").match(/\d+/);
      const quantity = normalized ? Number(normalized[0]) : 1;
      return quantity > 0 ? quantity : 1;
    },
    parseSpreadsheetBuildStatus(row) {
      const assembled = this.parseBooleanCell(this.getSpreadsheetCell(row, ["samlet"]));
      if (assembled) {
        return "Bygget";
      }

      return "Ikke bygget";
    },
    parseSpreadsheetManual(row) {
      return this.parseBooleanCell(this.getSpreadsheetCell(row, ["tegning", "manual"]));
    },
    parseSpreadsheetStorage(row) {
      const raw = String(this.getSpreadsheetCell(row, ["saeknr", "sæk nr", "saek", "sæk", "lager", "pose"]) || "").trim();
      if (!raw) {
        return "";
      }

      if (/^hjemme$/i.test(raw)) {
        return "Hjemme";
      }

      if (/^lager$/i.test(raw)) {
        return "Lager";
      }

      const poseMatch =
        raw.match(/^pose\s*(\d{1,3})$/i) ||
        raw.match(/^pose[-\s]*(\d{1,3})$/i) ||
        raw.match(/^(s[æa]k|kasse)\s*(nr)?[-\s:]*?(\d{1,3})$/i) ||
        raw.match(/^(\d{1,3})$/);

      if (poseMatch) {
        const number = Number(poseMatch[poseMatch.length - 1]);
        if (number > 0) {
          return `Pose ${number}`;
        }
      }

      return raw;
    },
    createImportedSetFromFile(row, rawSetNumber, remoteSet = null) {
      const setNumberFromFile = this.normalizeSpreadsheetSetNumber(rawSetNumber);
      const fileName = this.getSpreadsheetCell(row, ["indhold", "navn", "name"]);
      const fileTheme = this.getSpreadsheetCell(row, ["tema", "theme"]);
      const fileYear = this.parseSpreadsheetYear(this.getSpreadsheetCell(row, ["argang", "årgang", "year"]));
      const hasBox = this.parseBooleanCell(this.getSpreadsheetCell(row, ["aske", "æske", "kasse", "box"]));
      const hasManual = this.parseSpreadsheetManual(row);
      const builtStatus = this.parseSpreadsheetBuildStatus(row);
      const storageLocation = this.parseSpreadsheetStorage(row);
      const filePieces = this.parseSpreadsheetPieces(row);
      const fileQuantity = this.parseSpreadsheetQuantity(row);
      const notes = [
        this.getSpreadsheetCell(row, ["specielt", "special"]),
        this.getSpreadsheetCell(row, ["kobt", "købt", "bought"])
      ]
        .filter(Boolean)
        .join(" | ");

      const base = remoteSet || {
        collectionKey: "",
        setNumber: setNumberFromFile.split("-")[0],
        rebrickableSetNumber: setNumberFromFile,
        ownerProfile: "",
        name: fileName || `LEGO ${setNumberFromFile}`,
        theme: fileTheme || "",
        year: fileYear || "",
        pieces: 0,
        image: getSetImageUrl(setNumberFromFile),
        manualUrl: getLegoInstructionsUrl(setNumberFromFile),
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

      return this.normalizeSetOwnership(
        {
          ...base,
          ownerProfile: "dad",
          owned: true,
          hasBox,
          hasManual,
          buildStatus: builtStatus || base.buildStatus,
          storageLocation,
        notes: notes || base.notes || "",
        theme: remoteSet?.theme || fileTheme || base.theme || "",
        name: remoteSet?.name || fileName || base.name,
        year: remoteSet?.year || fileYear || base.year,
        pieces: Number(remoteSet?.pieces) || filePieces || Number(base.pieces) || 0,
        quantityOwned: Number(base.quantityOwned) || fileQuantity || 1
        },
        "dad"
      );
    },
    async startBulkImport() {
      if (!this.importState.file || this.importState.running) {
        return;
      }

      const XLSX = await import("https://cdn.sheetjs.com/xlsx-0.20.2/package/xlsx.mjs");
      const file = this.importState.file;
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = this.extractSpreadsheetRows(worksheet, XLSX);
      const validRows = rows.filter((row) => this.getSetNumberFromRow(row));

      this.importState = {
        ...this.importState,
        running: true,
        finished: false,
        total: validRows.length,
        completed: 0,
        currentSetNumber: "",
        imported: [],
        errors: []
      };

      const imported = [];
      const errors = [];

      for (const row of validRows) {
        const rawSetNumber = this.getSetNumberFromRow(row);
        const rebrickableSetNumber = this.normalizeSpreadsheetSetNumber(rawSetNumber);
        this.importState = {
          ...this.importState,
          currentSetNumber: rebrickableSetNumber
        };

        try {
          const remoteSet = await rebrickableClient.findSetBySpreadsheetNumber(rebrickableSetNumber);
          const mergedSet = this.createImportedSetFromFile(row, rawSetNumber, remoteSet);

          await saveCollectionSet(mergedSet);
          imported.push(mergedSet);
        } catch {
          try {
            const fallbackSet = this.createImportedSetFromFile(row, rawSetNumber, null);
            await saveCollectionSet(fallbackSet);
            imported.push(fallbackSet);
            errors.push({
              setNumber: rebrickableSetNumber || String(rawSetNumber || "").trim(),
              reason: "Importeret uden API-match"
            });
          } catch {
            errors.push({ setNumber: rebrickableSetNumber || String(rawSetNumber || "").trim() });
          }
        } finally {
          this.importState = {
            ...this.importState,
            completed: this.importState.completed + 1
          };
        }

        if (this.importState.completed % 10 === 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 120));
        }
      }

      await this.refreshCloudState();
      this.importState = {
        ...this.importState,
        running: false,
        finished: true,
        currentSetNumber: "",
        imported,
        errors
      };
    },
    async addSearchResultToCollection(setItem) {
      if (!this.activeProfileId || this.activeProfileId === "family") {
        return;
      }

      let enrichedSetItem = setItem;
      if (this.isSetMetadataMissing(setItem)) {
        const remoteSet = await this.fetchBestRemoteSet(setItem.rebrickableSetNumber || setItem.setNumber);
        if (remoteSet) {
          enrichedSetItem = this.mergeSetWithRemoteMetadata(setItem, remoteSet);
        }
      }

      const key = enrichedSetItem.rebrickableSetNumber || enrichedSetItem.setNumber;
      const ownerKey = this.profileCollectionKey(this.activeProfileId, key);
      const existingSet = this.sets.find(
        (item) =>
          (item.collectionKey || this.profileCollectionKey(item.ownerProfile, item.rebrickableSetNumber || item.setNumber)) ===
          ownerKey
      );

      if (existingSet) {
        const updatedExistingSet = this.normalizeSetOwnership(
          {
            ...existingSet,
            owned: true,
            storageLocation: enrichedSetItem.storageLocation || existingSet.storageLocation || ""
          },
          existingSet.ownerProfile
        );

        this.updateSet(updatedExistingSet);
        this.currentView = "collection";
        this.collectionFilter = "Alle";
        this.setRoute("/collection");
        return;
      }

      const nextSet = this.normalizeSetOwnership({
        ...enrichedSetItem,
        ownerProfile: this.activeProfileId,
        collectionKey: ownerKey,
        owned: true,
        hasBox: false,
        hasManual: false,
        storageLocation: enrichedSetItem.storageLocation || "",
        missingPieces: 0,
        sellingStatus: "Not for sale",
        askingPrice: 0,
        salePlatforms: [],
        buildStatus: "Ikke bygget",
        sealStatus: "Åbnet",
        notes: ""
      });

      this.sets = await addSetToCollection(nextSet);
      this.sales = deriveSalesFromSets(this.sets);
      await this.refreshCloudState();
      this.currentView = "collection";
      this.collectionFilter = "Alle";
      this.setRoute("/collection");
    },
    updateSet(updatedSet) {
      const previousSet = this.activeSet ? { ...this.activeSet } : null;
      const normalizedUpdatedSet = this.normalizeSetOwnership(
        updatedSet,
        updatedSet.ownerProfile || this.activeSet?.ownerProfile || this.activeProfileId || "shared"
      );
      const previousKey =
        previousSet?.collectionKey ||
        this.profileCollectionKey(
          previousSet?.ownerProfile || normalizedUpdatedSet.ownerProfile,
          previousSet?.rebrickableSetNumber || previousSet?.setNumber || normalizedUpdatedSet.rebrickableSetNumber || normalizedUpdatedSet.setNumber
        );
      const nextKey =
        normalizedUpdatedSet.collectionKey || normalizedUpdatedSet.rebrickableSetNumber || normalizedUpdatedSet.setNumber;
      const nextSets = this.sets.map((item) =>
        (item.collectionKey || this.profileCollectionKey(item.ownerProfile, item.rebrickableSetNumber || item.setNumber)) ===
          previousKey
          ? normalizedUpdatedSet
          : item
      );
      const exists = nextSets.some(
        (item) =>
          (item.collectionKey || this.profileCollectionKey(item.ownerProfile, item.rebrickableSetNumber || item.setNumber)) ===
          nextKey
      );
      const finalSets = exists ? nextSets : [...nextSets, normalizedUpdatedSet];

      this.sets = finalSets;
      this.activeSet =
        finalSets.find(
          (item) =>
            (item.collectionKey || this.profileCollectionKey(item.ownerProfile, item.rebrickableSetNumber || item.setNumber)) ===
            nextKey
        ) || normalizedUpdatedSet;
      this.sales = deriveSalesFromSets(finalSets);
      saveCollectionSet(this.activeSet, previousSet).then(() => this.refreshCloudState());
    },
    async performPartsSearch() {
      const query = this.partsQuery.trim();
      if (!query) {
        this.parts = [];
        this.partsError = "";
        return;
      }

      this.partsLoading = true;
      this.partsError = "";

      try {
        this.parts = await rebrickableClient.searchParts(query);
      } catch (error) {
        this.parts = [];
        this.partsError = error?.message || "Kunne ikke hente klodser fra LEGO databasen.";
      } finally {
        this.partsLoading = false;
      }
    },
    async fetchAllPartsForSet(setNumber) {
      const allParts = [];
      let page = 1;
      let hasMore = true;
      const resolvedSetNumber = await this.resolveSetNumberForParts(setNumber);

      while (hasMore) {
        const response = await rebrickableClient.getSetPartsPage(resolvedSetNumber, page);
        allParts.push(...(response.results || []));
        hasMore = Boolean(response.next);
        page += 1;
      }

      return allParts;
    },
    async fetchSetPartsPageWithRetry(setNumber, page, retries = 2) {
      let attempt = 0;
      let lastError = null;

      while (attempt <= retries) {
        try {
          return await rebrickableClient.getSetPartsPage(setNumber, page);
        } catch (error) {
          lastError = error;
          if (attempt >= retries) {
            break;
          }
          attempt += 1;
          await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
        }
      }

      throw lastError || new Error("Kunne ikke hente LEGO data.");
    },
    async loadOwnedPartsInventory(forceRefresh = false) {
      if (this.inventoryLoading) {
        return;
      }

      if (!forceRefresh && this.inventoryParts.length) {
        return;
      }

      const sourceSets = this.visibleSets.filter((setItem) => setItem.owned);
      const setNumbers = sourceSets
        .map((setItem) => setItem.rebrickableSetNumber || setItem.setNumber)
        .filter(Boolean);

      if (!setNumbers.length) {
        this.inventoryParts = [];
        this.inventoryError = "";
        this.inventoryProgress = { done: 0, total: 0 };
        return;
      }

      this.inventoryLoading = true;
      this.inventoryError = "";
      this.inventoryProgress = { done: 0, total: setNumbers.length };

      const aggregated = new Map();
      let failedSets = 0;

      for (const setNumber of setNumbers) {
        try {
          const parts = await this.fetchAllPartsForSet(setNumber);
          parts.forEach((part) => {
            const key = `${part.partNum}::${part.color}`;
            const existing = aggregated.get(key) || {
              id: key,
              partNum: part.partNum,
              name: part.name,
              image: part.image,
              color: part.color,
              colorRgb: part.colorRgb,
              quantity: 0,
              setCount: 0,
              setNumbers: new Set()
            };

            existing.quantity += Number(part.quantity) || 0;
            existing.setNumbers.add(setNumber);
            existing.setCount = existing.setNumbers.size;
            aggregated.set(key, existing);
          });
        } catch {
          failedSets += 1;
        } finally {
          this.inventoryProgress = {
            done: this.inventoryProgress.done + 1,
            total: this.inventoryProgress.total
          };
        }
      }

      this.inventoryParts = [...aggregated.values()]
        .map((item) => ({
          ...item,
          setNumbers: undefined
        }))
        .sort((left, right) => {
          const quantityDiff = Number(right.quantity || 0) - Number(left.quantity || 0);
          if (quantityDiff !== 0) {
            return quantityDiff;
          }
          return String(left.name || "").localeCompare(String(right.name || ""), "da");
        });

      this.inventoryError =
        failedSets > 0 ? `Kunne ikke hente klodser for ${failedSets} sæt. Resten vises stadig.` : "";
      this.inventoryLoading = false;
    },
    exportCollection() {
      const payload = {
        version: this.appVersion,
        exportedAt: new Date().toISOString(),
        sets: this.sets
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "lego-cloud-samling.json";
      link.click();
      URL.revokeObjectURL(url);
    },
    async importCollection(file) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const fallbackOwner =
          this.activeProfileId && this.activeProfileId !== "family" ? this.activeProfileId : "shared";
        const importedSets = (Array.isArray(parsed.sets) ? parsed.sets : []).map((setItem) =>
          this.normalizeSetOwnership(setItem, fallbackOwner)
        );
        this.sets = await replaceCollection(importedSets);
        this.sales = deriveSalesFromSets(this.sets);
        await this.refreshCloudState();
        this.currentView = "collection";
        this.setRoute("/collection");
      } catch {
        // Enkel fallback uden UI-crash.
      }
    },
    normalizeManualFileName(fileName) {
      return String(fileName || "")
        .replace(/\.pdf$/i, "")
        .trim();
    },
    extractSetNumberFromManualFileName(fileName) {
      const baseName = this.normalizeManualFileName(fileName)
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ");
      const compact = baseName.replace(/\s+/g, "");

      const directMatch = compact.match(/^(\d{3,6})(?:-\d+)?$/);
      if (directMatch) {
        return directMatch[1];
      }

      const embeddedMatch = baseName.match(/(^|[^0-9])(\d{3,6})(?:-\d+)?([^0-9]|$)/);
      return embeddedMatch ? embeddedMatch[2] : "";
    },
    getManualImportScopeSets() {
      return this.sets.filter(
        (item) => this.activeProfileId === "family" || item.ownerProfile === this.activeProfileId
      );
    },
    resolveManualTargetSet(file, scopeSets = []) {
      const detectedSetNumber = this.extractSetNumberFromManualFileName(file?.name || "");
      if (detectedSetNumber) {
        const byNumber = scopeSets.find((item) => {
          const baseSetNumber = String(item.setNumber || "").split("-")[0];
          const rebrickableBase = String(item.rebrickableSetNumber || "").split("-")[0];
          return baseSetNumber === detectedSetNumber || rebrickableBase === detectedSetNumber;
        });
        if (byNumber) {
          return byNumber;
        }
      }

      const normalizedFileName = this.normalizeSearchText(this.normalizeManualFileName(file?.name || ""))
        .replace(/\b(lego|manual|instruction|instructions|book|booklet|pdf|bi)\b/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!normalizedFileName) {
        return null;
      }

      const exactNameMatches = scopeSets.filter(
        (item) => this.normalizeSearchText(item.name || "") === normalizedFileName
      );
      if (exactNameMatches.length === 1) {
        return exactNameMatches[0];
      }

      const containsMatches = scopeSets.filter((item) => {
        const normalizedSetName = this.normalizeSearchText(item.name || "");
        return (
          normalizedSetName &&
          (normalizedSetName.includes(normalizedFileName) || normalizedFileName.includes(normalizedSetName))
        );
      });
      if (containsMatches.length === 1) {
        return containsMatches[0];
      }

      return null;
    },
    async importManuals(files) {
      const scopeSets = this.getManualImportScopeSets();
      for (const file of files) {
        const matchingSet = this.resolveManualTargetSet(file, scopeSets);
        if (!matchingSet) {
          continue;
        }

        const uploaded = await uploadManualToStorage(file, matchingSet.setNumber);
        const updatedSet = {
          ...matchingSet,
          hasManual: true,
          manualUrl: uploaded.publicUrl || getManualStorageUrl(matchingSet.setNumber)
        };

        const saved = await saveCollectionSet(updatedSet);
        this.sets = saved.map((setItem) => this.normalizeSetOwnership(setItem, setItem.ownerProfile));
        this.syncActiveSet(this.sets);
      }

      await this.refreshCloudState();
    },
    async removeSetFromCollection(setItem) {
      this.sets = await removeCollectionSet(setItem);
      this.sales = deriveSalesFromSets(this.sets);
      await this.refreshCloudState();
      this.activeSet = null;
      this.currentView = "collection";
      this.setRoute("/collection");
    },
    async resetSystem() {
      this.sets = [];
      this.sales = [];
      this.missingParts = [];
      this.activeSet = null;
      this.currentView = "collection";
      this.collectionQuery = "";
      this.searchQuery = "";
      this.searchResults = [];
      this.partsQuery = "";
      this.parts = [];
      this.partsError = "";
      this.inventoryParts = [];
      this.inventoryError = "";
      this.inventoryProgress = { done: 0, total: 0 };
      this.setParts = [];
      this.setPartsError = "";
      this.relatedPartSets = {};
      this.relatedPartSetsLoading = {};
      try {
        localStorage.removeItem(SEARCH_QUERY_KEY);
        localStorage.removeItem(SEARCH_RESULTS_KEY);
      } catch {
        // Ignorer lokal storage-fejl.
      }
      await Promise.all([resetCollection(), resetSales(), resetMissingParts()]);
      this.setRoute("/collection");
    },
    async loadInitialSetParts(setItem) {
      this.setPartsRequested = true;
      this.setParts = [];
      this.setPartsPage = 0;
      this.hasMoreSetParts = true;
      this.setPartsError = "";
      await this.loadMoreSetParts(setItem);
    },
    async loadMoreSetParts(setItem = this.activeSet) {
      if (this.setPartsLoading || !this.hasMoreSetParts || !setItem) {
        return;
      }

      this.setPartsLoading = true;
      this.setPartsError = "";
      const nextPage = this.setPartsPage + 1;

      try {
        const resolvedSetNumber = await this.resolveSetNumberForParts(
          setItem.rebrickableSetNumber || setItem.setNumber
        );
        const response = await this.fetchSetPartsPageWithRetry(
          resolvedSetNumber || setItem.rebrickableSetNumber || setItem.setNumber,
          nextPage,
          2
        );

        this.setParts = [...this.setParts, ...response.results];
        this.setPartsPage = nextPage;
        this.hasMoreSetParts = Boolean(response.next);
      } catch (error) {
        const message = String(error?.message || "");
        if (nextPage === 1 && message.includes("Sæt ikke fundet")) {
          try {
            const resolvedSet = await rebrickableClient.findSetBySpreadsheetNumber(
              setItem.rebrickableSetNumber || setItem.setNumber
            );
            const fallbackResponse = await this.fetchSetPartsPageWithRetry(
              resolvedSet.rebrickableSetNumber || resolvedSet.setNumber,
              1,
              2
            );
            this.setParts = [...this.setParts, ...fallbackResponse.results];
            this.setPartsPage = 1;
            this.hasMoreSetParts = Boolean(fallbackResponse.next);
            this.setPartsError = "";
            return;
          } catch {
            this.hasMoreSetParts = false;
            this.setPartsError = "LEGO databasen har ikke klodseliste for dette sæt endnu.";
            return;
          }
        }

        this.setPartsError = error.message || "Kunne ikke hente LEGO data.";
      } finally {
        this.setPartsLoading = false;
      }
    },
    async markPartAsMissing(part) {
      const updated = await addMissingPart({
        set_number: this.activeSet.rebrickableSetNumber || this.activeSet.setNumber,
        owner_profile: this.activeSet.ownerProfile || "shared",
        part_num: part.partNum,
        color: part.color,
        quantity_missing: 1,
        part_name: part.name,
        part_image: part.image
      });

      this.missingParts = updated;
    },
    async incrementMissingPart(item) {
      const updated = await addMissingPart({
        set_number: item.set_number,
        owner_profile: item.owner_profile || "shared",
        part_num: item.part_num,
        color: item.color,
        quantity_missing: 1,
        part_name: item.part_name,
        part_image: item.part_image
      });

      this.missingParts = updated;
    },
    async decrementMissingPart(item) {
      const updated = await resolveMissingPart({
        set_number: item.set_number,
        owner_profile: item.owner_profile || "shared",
        part_num: item.part_num,
        color: item.color,
        quantity_missing: 1
      });

      this.missingParts = updated;
    },
    async showRelatedSetsForPart(part) {
      const partNum = part.partNum || part.partId;
      if (this.relatedPartSets[partNum]) {
        return;
      }

      this.relatedPartSetsLoading = {
        ...this.relatedPartSetsLoading,
        [partNum]: true
      };

      try {
        const relatedSets = await rebrickableClient.getSetsForPart(partNum);
        this.relatedPartSets = {
          ...this.relatedPartSets,
          [partNum]: relatedSets
        };
      } catch {
        this.relatedPartSets = {
          ...this.relatedPartSets,
          [partNum]: []
        };
      } finally {
        this.relatedPartSetsLoading = {
          ...this.relatedPartSetsLoading,
          [partNum]: false
        };
      }
    }
  },
  template: `
    <div class="app-shell">
      <template v-if="!activeProfileId">
        <ProfileSelectPage
          :profiles="profiles"
          :summaries="profileSummaries"
          @select-profile="selectProfile"
        />
      </template>

      <template v-else>
        <header class="app-header">
          <div class="app-header__brand">
            <strong>LEGO Cloud</strong>
            <span class="active-profile-pill">{{ currentProfile?.emoji }} {{ currentProfile?.name }}</span>
          </div>
          <button class="secondary-btn switch-profile-btn" @click="clearProfile">Skift profil</button>
        </header>

        <div class="page-label">{{ currentPageTitle }}</div>

        <aside v-if="drawerOpen" class="drawer-backdrop" @click.self="drawerOpen = false">
          <div class="drawer-sheet">
            <div class="drawer-sheet__header">
              <strong>Menu</strong>
              <button class="icon-btn" @click="drawerOpen = false" aria-label="Luk menu">✕</button>
            </div>
            <div class="drawer-list">
              <button
                v-for="item in drawerItems"
                :key="item.id"
                class="drawer-item"
                @click="navigate(item.id)"
              >
                <span>{{ item.icon }}</span>
                <strong>{{ item.label }}</strong>
              </button>
            </div>
          </div>
        </aside>

        <main class="app-content">
          <HomePage
            v-if="currentView === 'home'"
            :stats="statsPayload"
            :sales-count="visibleSales.length"
            :profile="currentProfile"
            :family-profiles="familyProfileSummaries"
            :preview-sets="homePreviewSets"
            @open-set="openSet"
            @open-collection="navigate('collection')"
            @open-parts="navigate('parts')"
            @open-themes="navigate('stats')"
          />
          <CollectionPage
            v-else-if="currentView === 'collection'"
            :sets="visibleSets"
            :query="collectionQuery"
            :active-filter="collectionFilter"
            :selected-theme="collectionTheme"
            :sort-by="collectionSortBy"
            :theme-options="collectionThemeOptions"
            @update:query="collectionQuery = $event"
            @set-filter="collectionFilter = $event"
            @update:selected-theme="collectionTheme = $event"
            @update:sort-by="collectionSortBy = $event"
            @open-set="openSet"
            @go-search="navigate('search')"
          />
          <SearchSetsPage
            v-else-if="currentView === 'search'"
            :query="searchQuery"
            :results="searchResults"
            :loading="searchLoading"
            :error="searchError"
            :collection-set-numbers="collectionSetNumbers"
            :active-profile-name="currentProfile?.name || ''"
            :can-add-to-profile="currentProfile?.id !== 'family'"
            @update:query="searchQuery = $event"
            @search="performGlobalSearch"
            @open-set="openSet"
            @add-set="addSearchResultToCollection"
          />
          <PartsPage
            v-else-if="currentView === 'parts'"
            :parts="parts"
            :query="partsQuery"
            :loading="partsLoading"
            :error="partsError"
            :inventory-parts="inventoryParts"
            :inventory-loading="inventoryLoading"
            :inventory-error="inventoryError"
            :inventory-progress="inventoryProgress"
            :related-part-sets="relatedPartSets"
            :related-part-sets-loading="relatedPartSetsLoading"
            @update:query="partsQuery = $event"
            @search="performPartsSearch"
            @load-inventory="loadOwnedPartsInventory(true)"
            @show-related-sets="showRelatedSetsForPart"
          />
          <PickupListPage
            v-else-if="currentView === 'pickup'"
            :items="visiblePickupList"
            :profile-name="currentProfile?.name || ''"
            @toggle-item="togglePickupChecked"
            @remove-item="removePickupEntry"
            @open-set="openPickupSet"
            @clear-checked="clearCheckedPickupEntries"
          />
          <MissingPartsPage
            v-else-if="currentView === 'missing-parts'"
            :missing-parts="visibleMissingParts"
            @increment-missing="incrementMissingPart"
            @decrement-missing="decrementMissingPart"
          />
          <SalesPage v-else-if="currentView === 'sales'" :sales="visibleSales" />
          <StatsPage v-else-if="currentView === 'stats'" :stats="statsPayload" />
          <SettingsPage
            v-else-if="currentView === 'settings'"
            :version="appVersion"
            @reset-system="resetSystem"
            @export-collection="exportCollection"
            @import-collection="importCollection"
            @import-manuals="importManuals"
            @open-bulk-import="navigate('import-collection')"
          />
          <ImportCollectionPage
            v-else-if="currentView === 'import-collection'"
            :state="importState"
            @select-file="selectImportFile"
            @start-import="startBulkImport"
          />
          <BuildPage
            v-else-if="currentView === 'build'"
            :set-item="activeSet"
            :set-parts="setParts"
            :parts-loading="setPartsLoading"
            :parts-error="setPartsError"
            :parts-requested="setPartsRequested"
            @back-to-detail="goBackFromBuild"
            @request-parts="loadInitialSetParts"
            @update-checklist="updateBuildChecklist"
            @open-manual="openManual"
          />
          <SetDetailPage
            v-else-if="currentView === 'detail'"
            :set-item="activeSet"
            :set-parts="setParts"
            :parts-loading="setPartsLoading"
            :parts-error="setPartsError"
            :has-more-parts="hasMoreSetParts"
            :parts-requested="setPartsRequested"
            :related-part-sets="relatedPartSets"
            :related-part-sets-loading="relatedPartSetsLoading"
            :manual-opening="activeSetManualOpening"
            :manual-error="manualOpenError"
            :in-pickup-list="activeSetInPickupList"
            @load-more-parts="loadMoreSetParts"
            @request-parts="loadInitialSetParts"
            @mark-missing="markPartAsMissing"
            @show-related-sets="showRelatedSetsForPart"
            @open-manual="openManual"
            @open-build="openBuildForActiveSet"
            @go-back="goBackFromSetDetail"
            @add-to-pickup="addActiveSetToPickup"
            @update-set="updateSet"
            @remove-set="removeSetFromCollection"
          />
        </main>

        <nav class="bottom-nav">
          <button
            v-for="item in bottomNavItems"
            :key="item.id"
            class="bottom-nav__item"
            :class="{ active: currentView === item.id || (item.id === 'drawer' && drawerOpen) }"
            @click="navigate(item.id)"
          >
            <span class="bottom-nav__icon">{{ item.icon }}</span>
            <span class="bottom-nav__label">{{ item.label }}</span>
          </button>
        </nav>
      </template>
    </div>
  `
}).mount("#app");

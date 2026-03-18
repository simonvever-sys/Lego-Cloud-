import { SetPartCard } from "../components/SetPartCard.js";

export const SetDetailPage = {
  components: { SetPartCard },
  props: {
    setItem: { type: Object, required: true },
    setParts: { type: Array, required: true },
    partsLoading: { type: Boolean, default: false },
    partsError: { type: String, default: "" },
    hasMoreParts: { type: Boolean, default: false },
    partsRequested: { type: Boolean, default: false },
    relatedPartSets: { type: Object, required: true },
    relatedPartSetsLoading: { type: Object, required: true },
    manualOpening: { type: Boolean, default: false },
    manualError: { type: String, default: "" }
  },
  emits: [
    "load-more-parts",
    "request-parts",
    "mark-missing",
    "show-related-sets",
    "open-manual",
    "go-back",
    "update-set",
    "remove-set"
  ],
  computed: {
    statusButtons() {
      return [
        { key: "owned", label: "Har sættet", active: this.setItem.owned, tone: "status-green" },
        { key: "hasBox", label: "Har kasse", active: this.setItem.hasBox, tone: "status-green" },
        { key: "hasManual", label: "Har manual", active: this.setItem.hasManual, tone: "status-green" }
      ];
    },
    buildStatuses() {
      return ["Ikke bygget", "I gang", "Bygget"];
    },
    sealStatuses() {
      return ["Åbnet", "Uåbnet"];
    },
    salesStatuses() {
      return [
        { label: "Ikke til salg", value: "Not for sale" },
        { label: "Til salg", value: "For sale" },
        { label: "Solgt", value: "Sold" }
      ];
    },
    salePlatforms() {
      return ["Facebook Marketplace", "DBA", "Reshopper", "Loppemarked"];
    },
    storageOptions() {
      const bagOptions = Array.from({ length: 80 }, (_, index) => `Pose ${index + 1}`);
      return ["Hjemme", ...bagOptions];
    },
    displayNotes() {
      return String(this.setItem.notes || "")
        .replace(/\s*\[QTY:\d+\]\s*/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    }
  },
  mounted() {
    window.addEventListener("scroll", this.handleScroll, { passive: true });
  },
  beforeUnmount() {
    window.removeEventListener("scroll", this.handleScroll);
  },
  methods: {
    toggleBoolean(field) {
      this.$emit("update-set", {
        ...this.setItem,
        [field]: !this.setItem[field]
      });
    },
    setBuildStatus(buildStatus) {
      if ((this.setItem.sealStatus || "Åbnet") === "Uåbnet" && buildStatus !== "Ikke bygget") {
        return;
      }

      this.$emit("update-set", {
        ...this.setItem,
        buildStatus
      });
    },
    setSealStatus(sealStatus) {
      this.$emit("update-set", {
        ...this.setItem,
        sealStatus,
        buildStatus: sealStatus === "Uåbnet" ? "Ikke bygget" : this.setItem.buildStatus
      });
    },
    setSellingStatus(sellingStatus) {
      this.$emit("update-set", {
        ...this.setItem,
        sellingStatus,
        askingPrice: sellingStatus === "Not for sale" ? 0 : this.setItem.askingPrice || 0,
        salePlatforms: sellingStatus === "Not for sale" ? [] : this.setItem.salePlatforms || []
      });
    },
    setAskingPrice(event) {
      this.$emit("update-set", {
        ...this.setItem,
        askingPrice: Number(event.target.value) || 0
      });
    },
    toggleSalePlatform(platform) {
      const current = Array.isArray(this.setItem.salePlatforms) ? this.setItem.salePlatforms : [];
      const salePlatforms = current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform];

      this.$emit("update-set", {
        ...this.setItem,
        salePlatforms
      });
    },
    setStorageLocation(event) {
      this.$emit("update-set", {
        ...this.setItem,
        storageLocation: event.target.value
      });
    },
    setNotes(event) {
      this.$emit("update-set", {
        ...this.setItem,
        notes: event.target.value
      });
    },
    handleScroll() {
      if (!this.partsRequested || !this.hasMoreParts || this.partsLoading) {
        return;
      }

      const remaining = document.documentElement.scrollHeight - (window.innerHeight + window.scrollY);
      if (remaining < 220) {
        this.$emit("load-more-parts");
      }
    }
  },
  template: `
    <div class="view-stack">
      <div class="detail-layout">
        <section class="detail-card">
          <div class="detail-image">
            <img :src="setItem.image" :alt="setItem.name" />
          </div>
        </section>

        <section class="detail-card">
          <div style="margin-bottom: 12px;">
            <button class="secondary-btn" @click="$emit('go-back')">← Tilbage til samling</button>
          </div>
          <div class="detail-heading">
            <div class="card-kicker">{{ setItem.setNumber }}</div>
            <h2>{{ setItem.name }}</h2>
            <p>{{ setItem.theme || 'Kategori mangler' }}</p>
          </div>

          <div class="detail-meta">
            <div>
              <p>Klodser</p>
              <strong>{{ setItem.pieces.toLocaleString('da-DK') }}</strong>
            </div>
            <div>
              <p>Antal</p>
              <strong>{{ setItem.quantityOwned || 1 }}</strong>
            </div>
            <div>
              <p>År</p>
              <strong>{{ setItem.year }}</strong>
            </div>
            <div>
              <p>Byggestatus</p>
              <strong>{{ setItem.buildStatus }}</strong>
            </div>
            <div>
              <p>Kategori</p>
              <strong>{{ setItem.theme || 'Ukendt' }}</strong>
            </div>
            <div>
              <p>Stand</p>
              <strong>{{ setItem.sealStatus || 'Åbnet' }}</strong>
            </div>
            <div>
              <p>Lager</p>
              <strong>{{ setItem.storageLocation || 'Ikke angivet' }}</strong>
            </div>
          </div>

          <div class="status-grid" style="margin-bottom: 16px;">
            <button
              v-for="status in statusButtons"
              :key="status.key"
              class="status-chip"
              :class="status.active ? status.tone : ''"
              @click="toggleBoolean(status.key)"
            >
              {{ status.active ? '✔' : '○' }} {{ status.label }}
            </button>
          </div>

          <div class="detail-section">
            <p class="detail-section-title">Byggestatus</p>
            <div class="status-grid">
              <button
                v-for="status in buildStatuses"
                :key="status"
                class="status-chip"
                :class="{ 'status-green': setItem.buildStatus === status }"
                :disabled="(setItem.sealStatus || 'Åbnet') === 'Uåbnet' && status !== 'Ikke bygget'"
                @click="setBuildStatus(status)"
              >
                {{ status }}
              </button>
            </div>
          </div>

          <div class="detail-section">
            <p class="detail-section-title">Stand</p>
            <div class="status-grid">
              <button
                v-for="status in sealStatuses"
                :key="status"
                class="status-chip"
                :class="{ 'status-orange': (setItem.sealStatus || 'Åbnet') === status }"
                @click="setSealStatus(status)"
              >
                {{ status }}
              </button>
            </div>
          </div>

          <div class="detail-section">
            <p class="detail-section-title">Kategori</p>
            <input
              class="detail-input"
              type="text"
              :value="setItem.theme || 'Hentes automatisk fra LEGO data'"
              placeholder="Hentes automatisk"
              disabled
            />
          </div>

          <div class="detail-section">
            <p class="detail-section-title">Lager / pose</p>
            <select
              class="detail-input"
              :value="setItem.storageLocation || ''"
              @change="setStorageLocation"
            >
              <option value="">Vælg placering</option>
              <option v-for="option in storageOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>

          <div class="detail-section">
            <p class="detail-section-title">Salg</p>
            <div class="status-grid">
              <button
                v-for="status in salesStatuses"
                :key="status.value"
                class="status-chip"
                :class="{
                  'status-blue': setItem.sellingStatus === status.value && status.value === 'For sale',
                  'status-gray': setItem.sellingStatus === status.value && status.value === 'Sold',
                  'status-green': setItem.sellingStatus === status.value && status.value === 'Not for sale'
                }"
                @click="setSellingStatus(status.value)"
              >
                {{ status.label }}
              </button>
            </div>
            <div v-if="setItem.sellingStatus === 'For sale'" class="sales-editor">
              <label>
                Pris
                <input
                  type="number"
                  min="0"
                  step="1"
                  :value="setItem.askingPrice || 0"
                  @input="setAskingPrice"
                />
              </label>

              <div class="sales-editor__platforms">
                <button
                  v-for="platform in salePlatforms"
                  :key="platform"
                  class="status-chip"
                  :class="{ 'status-blue': (setItem.salePlatforms || []).includes(platform) }"
                  @click="toggleSalePlatform(platform)"
                >
                  {{ platform }}
                </button>
              </div>
            </div>
          </div>

          <div class="manual-grid" style="margin-bottom: 16px;">
            <span class="badge"><strong>Sætnummer:</strong> {{ setItem.setNumber }}</span>
            <span class="badge">Tjek at sætnummer matcher</span>
          </div>

          <div class="manual-grid" style="margin-bottom: 16px;">
            <button
              class="manual-link"
              :class="{ 'manual-link--loading': manualOpening }"
              :disabled="manualOpening"
              @click="$emit('open-manual', setItem.setNumber)"
            >
              <span class="manual-link__icon">📘</span>
              <span>{{ manualOpening ? 'Åbner manual...' : 'Åbn manual' }}</span>
              <span v-if="manualOpening" class="manual-link__spinner" aria-hidden="true"></span>
            </button>
          </div>
          <p v-if="manualError" class="inline-info">{{ manualError }}</p>

          <div class="empty-state">
            <strong>Noter</strong>
            <textarea
              class="detail-textarea"
              style="margin-top: 8px;"
              :value="displayNotes"
              placeholder="Skriv en note om sættet her"
              @input="setNotes"
            ></textarea>
          </div>

          <div class="part-actions">
            <button class="secondary-btn full-width-btn" @click="$emit('remove-set', setItem)">
              Fjern sæt fra samling
            </button>
          </div>
        </section>
      </div>

      <section class="panel">
        <div v-if="!partsRequested && !partsLoading && !setParts.length && !partsError" class="empty-state">
          <strong>Klodslisten er ikke hentet endnu.</strong>
          <p>Tryk på knappen herunder for at hente klodser til dette sæt.</p>
          <button class="primary-btn" @click="$emit('request-parts', setItem)">Hent klodsliste</button>
        </div>

        <div v-if="partsError" class="empty-state">
          <strong>Kunne ikke hente klodser.</strong>
          <p>{{ partsError }}</p>
          <button class="secondary-btn" @click="$emit('request-parts', setItem)">Prøv igen</button>
        </div>

        <div v-else-if="setParts.length" class="card-grid">
          <SetPartCard
            v-for="part in setParts"
            :key="part.cacheKey"
            :part="part"
            :loading-sets="Boolean(relatedPartSetsLoading[part.partNum])"
            :related-sets="relatedPartSets[part.partNum] || []"
            @mark-missing="$emit('mark-missing', $event)"
            @show-related-sets="$emit('show-related-sets', $event)"
          />
        </div>

        <div v-else-if="partsLoading" class="empty-state">
          <strong>Henter klodser...</strong>
          <p>Første batch bliver hentet nu.</p>
        </div>

        <div v-if="partsLoading && setParts.length" class="inline-info">Henter næste batch...</div>
        <div v-if="hasMoreParts && !partsLoading" class="inline-info">Rul ned for at hente de næste 50 klodser.</div>
      </section>
    </div>
  `
};

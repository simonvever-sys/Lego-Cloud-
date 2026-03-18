import { SetCard } from "../components/SetCard.js";
import { SearchBar } from "../components/SearchBar.js";

export const CollectionPage = {
  components: { SetCard, SearchBar },
  props: {
    sets: { type: Array, required: true },
    query: { type: String, required: true },
    activeFilter: { type: String, required: true },
    selectedTheme: { type: String, required: true },
    sortBy: { type: String, required: true },
    themeOptions: { type: Array, default: () => [] }
  },
  emits: ["update:query", "set-filter", "open-set", "go-search", "update:selectedTheme", "update:sortBy"],
  data() {
    return {
      filters: [
        "Alle",
        "Har sættet",
        "Mangler klodser",
        "Har kasse",
        "Mangler kasse",
        "Har manual",
        "Mangler manual",
        "I gang",
        "Til salg",
        "Solgt"
      ]
    };
  },
  computed: {
    filteredSets() {
      const normalizedQuery = this.query.trim().toLowerCase();

      const filtered = this.sets.filter((setItem) => {
        const matchesQuery =
          !normalizedQuery ||
          [setItem.setNumber, setItem.name, setItem.theme, String(setItem.year)]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);

        const matchesFilter =
          this.activeFilter === "Alle" ||
          (this.activeFilter === "Har sættet" &&
            setItem.owned &&
            setItem.missingPieces === 0 &&
            setItem.sellingStatus === "Not for sale") ||
          (this.activeFilter === "Mangler klodser" && setItem.missingPieces > 0) ||
          (this.activeFilter === "Har kasse" && setItem.hasBox) ||
          (this.activeFilter === "Mangler kasse" && !setItem.hasBox) ||
          (this.activeFilter === "Har manual" && setItem.hasManual) ||
          (this.activeFilter === "Mangler manual" && !setItem.hasManual) ||
          (this.activeFilter === "I gang" && setItem.buildStatus === "I gang") ||
          (this.activeFilter === "Til salg" && setItem.sellingStatus === "For sale") ||
          (this.activeFilter === "Solgt" && setItem.sellingStatus === "Sold");

        const matchesTheme = this.selectedTheme === "Alle temaer" || (setItem.theme || "") === this.selectedTheme;
        return matchesQuery && matchesFilter && matchesTheme;
      });

      const parseSetSortKey = (setItem) => {
        const raw = String(setItem.rebrickableSetNumber || setItem.setNumber || "");
        const [base, variant = "1"] = raw.split("-");
        return {
          base: Number(base) || 0,
          variant: Number(variant) || 1
        };
      };

      return [...filtered].sort((left, right) => {
        if (this.sortBy === "set-number-asc" || this.sortBy === "set-number-desc") {
          const leftKey = parseSetSortKey(left);
          const rightKey = parseSetSortKey(right);
          const baseDiff = leftKey.base - rightKey.base;
          const variantDiff = leftKey.variant - rightKey.variant;
          const numericDiff = baseDiff !== 0 ? baseDiff : variantDiff;
          return this.sortBy === "set-number-asc" ? numericDiff : -numericDiff;
        }

        if (this.sortBy === "year-desc") {
          return Number(right.year || 0) - Number(left.year || 0);
        }

        if (this.sortBy === "name-asc") {
          return String(left.name || "").localeCompare(String(right.name || ""), "da");
        }

        return 0;
      });
    }
  },
  template: `
    <div class="view-stack">
      <section v-if="sets.length" class="panel">
        <div class="toolbar">
          <SearchBar
            :model-value="query"
            placeholder="Søg på sætnummer, navn, tema eller år"
            button-label="Søg"
            @update:model-value="$emit('update:query', $event)"
            @submit="$emit('set-filter', activeFilter)"
          />
          <div class="filters">
            <button
              v-for="filter in filters"
              :key="filter"
              class="filter-pill"
              :class="{ active: activeFilter === filter }"
              @click="$emit('set-filter', filter)"
            >
              {{ filter }}
            </button>
          </div>
          <div class="filters" style="margin-top: 10px;">
            <select class="detail-input" :value="selectedTheme" @change="$emit('update:selectedTheme', $event.target.value)">
              <option value="Alle temaer">Alle temaer</option>
              <option v-for="theme in themeOptions" :key="theme" :value="theme">{{ theme }}</option>
            </select>
            <select class="detail-input" :value="sortBy" @change="$emit('update:sortBy', $event.target.value)">
              <option value="set-number-asc">Sætnummer stigende</option>
              <option value="set-number-desc">Sætnummer faldende</option>
              <option value="year-desc">Nyeste år først</option>
              <option value="name-asc">Navn A-Å</option>
            </select>
          </div>
        </div>
      </section>

      <section v-if="sets.length && filteredSets.length" class="card-grid">
        <SetCard
          v-for="setItem in filteredSets"
          :key="setItem.collectionKey || (setItem.ownerProfile + ':' + (setItem.rebrickableSetNumber || setItem.setNumber))"
          :set-item="setItem"
          @open="$emit('open-set', $event)"
        />
      </section>

      <section v-else-if="!sets.length" class="empty-state">
        <strong>Din samling er tom.</strong>
        <div class="part-actions" style="margin-top: 16px;">
          <button class="primary-btn full-width-btn" @click="$emit('go-search')">Tilføj LEGO sæt</button>
        </div>
      </section>

      <section v-else class="empty-state">
        <strong>Ingen sæt matcher.</strong>
        <p>Prøv et andet filter eller en kortere søgning.</p>
      </section>
    </div>
  `
};

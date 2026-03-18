import { SearchBar } from "../components/SearchBar.js";
import { SearchResultCard } from "../components/SearchResultCard.js";

export const SearchSetsPage = {
  components: { SearchBar, SearchResultCard },
  props: {
    query: { type: String, required: true },
    results: { type: Array, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String, default: "" },
    collectionSetNumbers: { type: Array, required: true },
    activeProfileName: { type: String, required: true },
    canAddToProfile: { type: Boolean, default: true }
  },
  emits: ["update:query", "open-set", "search", "add-set"],
  template: `
    <div class="view-stack">
      <section class="panel">
        <SearchBar
          :model-value="query"
          placeholder="Søg på sætnummer, tema eller navn (fx 42110, City brandbil)"
          button-label="Søg"
          @update:model-value="$emit('update:query', $event)"
          @submit="$emit('search')"
        />
      </section>

      <section v-if="error" class="empty-state">
        <strong>Kunne ikke søge i LEGO databasen.</strong>
        <p>{{ error }}</p>
      </section>

      <section v-else-if="loading" class="empty-state">
        <strong>Søger efter sæt...</strong>
      </section>

      <section v-else-if="!results.length && query.trim()" class="empty-state">
        <strong>Ingen sæt fundet.</strong>
        <p>Prøv et andet ord, fx City, Technic, Friends eller et præcist sætnummer.</p>
      </section>

      <section v-else-if="!results.length" class="panel">
        <div class="empty-state">
          <strong>Søg efter LEGO sæt.</strong>
          <p>Du kan søge på sætnummer, kategori eller navn, fx "Lego City", "brandbil" eller "42009".</p>
        </div>
      </section>

      <section v-else class="card-grid">
        <SearchResultCard
          v-for="setItem in results"
          :key="setItem.rebrickableSetNumber || setItem.setNumber"
          :set-item="setItem"
          :already-added="collectionSetNumbers.includes(setItem.rebrickableSetNumber || setItem.setNumber)"
          :add-label="canAddToProfile ? 'Tilføj til ' + activeProfileName : 'Vælg en personprofil for at tilføje'"
          :add-disabled="!canAddToProfile"
          @open="$emit('open-set', $event)"
          @add="$emit('add-set', $event)"
        />
      </section>
    </div>
  `
};

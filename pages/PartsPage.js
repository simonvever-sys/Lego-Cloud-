import { PartCard } from "../components/PartCard.js";
import { SearchBar } from "../components/SearchBar.js";

export const PartsPage = {
  components: { PartCard, SearchBar },
  props: {
    parts: { type: Array, required: true },
    query: { type: String, required: true },
    loading: { type: Boolean, default: false },
    error: { type: String, default: "" },
    inventoryParts: { type: Array, required: true },
    inventoryLoading: { type: Boolean, default: false },
    inventoryError: { type: String, default: "" },
    inventoryProgress: { type: Object, required: true },
    relatedPartSets: { type: Object, required: true },
    relatedPartSetsLoading: { type: Object, required: true }
  },
  emits: ["update:query", "show-related-sets", "search", "load-inventory"],
  template: `
    <div class="view-stack">
      <section class="panel">
        <div class="toolbar" style="justify-content: space-between; align-items: center;">
          <div>
            <div class="card-kicker">Samlet Klodseoversigt</div>
            <strong v-if="inventoryParts.length">{{ inventoryParts.length.toLocaleString('da-DK') }} forskellige klodser</strong>
            <strong v-else>Ingen klodser indlæst endnu</strong>
            <p v-if="inventoryLoading" style="margin: 6px 0 0;">
              Henter klodser {{ inventoryProgress.done }}/{{ inventoryProgress.total }}
            </p>
          </div>
          <button class="secondary-btn" @click="$emit('load-inventory')">
            {{ inventoryLoading ? 'Opdaterer...' : 'Opdater klodseliste' }}
          </button>
        </div>
        <p v-if="inventoryError" class="inline-info" style="margin-top: 10px;">{{ inventoryError }}</p>
      </section>

      <section v-if="inventoryParts.length" class="card-grid">
        <article v-for="part in inventoryParts" :key="part.id" class="part-card">
          <img :src="part.image" :alt="part.name" />
          <div class="part-card-body">
            <div class="card-kicker">{{ part.partNum }}</div>
            <h3>{{ part.name }}</h3>
            <p style="display: flex; align-items: center; gap: 8px;">
              <span class="color-swatch" :style="{ backgroundColor: part.colorRgb || '#d9d3c7' }"></span>
              {{ part.color }}
            </p>
            <div class="badge-row" style="margin-top: 10px;">
              <span class="badge">Antal: {{ Number(part.quantity || 0).toLocaleString('da-DK') }}</span>
              <span class="badge">I {{ part.setCount }} sæt</span>
            </div>
          </div>
        </article>
      </section>

      <section class="panel">
        <SearchBar
          :model-value="query"
          placeholder="Fx 3001"
          button-label="Søg"
          @update:model-value="$emit('update:query', $event)"
          @submit="$emit('search')"
        />
      </section>

      <section v-if="error" class="empty-state">
        <strong>Kunne ikke hente klodser fra LEGO databasen.</strong>
      </section>

      <section v-else-if="loading" class="empty-state">
        <strong>Henter klodser...</strong>
      </section>

      <section v-else-if="parts.length" class="card-grid">
        <PartCard
          v-for="part in parts"
          :key="part.partId"
          :part="part"
          :loading-sets="Boolean(relatedPartSetsLoading[part.partId])"
          :related-sets="relatedPartSets[part.partId] || []"
          @show-related-sets="$emit('show-related-sets', {
            partNum: part.partId,
            name: part.name,
            image: part.image
          })"
        />
      </section>

      <section v-else class="empty-state">
        <strong>Søg efter en klods.</strong>
      </section>
    </div>
  `
};

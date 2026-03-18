export const SetPartCard = {
  props: {
    part: { type: Object, required: true },
    loadingSets: { type: Boolean, default: false },
    relatedSets: { type: Array, default: () => [] }
  },
  methods: {
    useFallbackImage(event) {
      event.target.src = "/images/part-placeholder.png";
    }
  },
  emits: ["mark-missing", "show-related-sets"],
  template: `
    <article class="part-card touch-card">
      <img :src="part.image || '/images/part-placeholder.png'" :alt="part.name" @error="useFallbackImage" />
      <div class="part-card-body">
        <div class="card-kicker">{{ part.partNum }}</div>
        <h3>{{ part.name }}</h3>
        <div class="part-color">
          <span class="color-swatch" :style="{ backgroundColor: part.colorRgb || '#d9d3c7' }"></span>
          <p>Farve: {{ part.color }}</p>
        </div>
        <p>Antal i sættet: {{ part.quantity }}</p>
        <div class="part-actions">
          <button class="primary-btn full-width-btn" @click="$emit('mark-missing', part)">
            Marker som mangler
          </button>
          <button class="secondary-btn full-width-btn" @click="$emit('show-related-sets', part)">
            Se sæt med denne klods
          </button>
        </div>
        <div v-if="loadingSets" class="inline-info">Henter sæt med denne klods...</div>
        <div v-else-if="relatedSets.length" class="badge-row" style="margin-top: 12px;">
          <span class="badge" v-for="setItem in relatedSets" :key="setItem.setNumber">
            {{ setItem.setNumber }} · {{ setItem.name }}
          </span>
        </div>
      </div>
    </article>
  `
};

export const PartCard = {
  props: {
    part: { type: Object, required: true },
    relatedSets: { type: Array, default: () => [] },
    loadingSets: { type: Boolean, default: false }
  },
  methods: {
    useFallbackImage(event) {
      event.target.src = "/images/part-placeholder.png";
    }
  },
  emits: ["show-related-sets"],
  template: `
    <article class="part-card touch-card">
      <img :src="part.image || '/images/part-placeholder.png'" :alt="part.name" @error="useFallbackImage" />
      <div class="part-card-body">
        <div class="card-kicker">{{ part.partId }}</div>
        <h3>{{ part.name }}</h3>
        <p>Tilgængelige farver</p>
        <div class="badge-row" style="margin-top: 12px;">
          <span class="badge" v-for="color in part.availableColors" :key="color.id">
            <span class="color-swatch" :style="{ backgroundColor: color.rgb }"></span>
            {{ color.name }}
          </span>
        </div>
        <div class="part-actions" style="margin-top: 12px;">
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

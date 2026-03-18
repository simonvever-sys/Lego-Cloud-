export const SearchResultCard = {
  props: {
    setItem: { type: Object, required: true },
    alreadyAdded: { type: Boolean, default: false },
    addLabel: { type: String, default: "Tilføj til samling" },
    addDisabled: { type: Boolean, default: false }
  },
  data() {
    return {
      storageLocation: this.setItem.storageLocation || ""
    };
  },
  emits: ["open", "add"],
  template: `
    <article class="set-card search-result-card">
      <img v-if="setItem.image" :src="setItem.image" :alt="setItem.name" />
      <div class="set-card-body">
        <div class="card-kicker">{{ setItem.setNumber }}</div>
        <h3>{{ setItem.name }}</h3>
        <p>{{ [
          setItem.year || '',
          setItem.pieces ? setItem.pieces.toLocaleString('da-DK') + ' klodser' : ''
        ].filter(Boolean).join(' · ') || 'Manuel tilføjelse'
        }}</p>
        <div v-if="setItem.theme" class="badge-row" style="margin-top: 10px;">
          <span class="badge">{{ setItem.theme }}</span>
        </div>
        <div v-if="setItem.isManualFallback" class="search-result-card__notice">
          {{ setItem.fallbackReason }}
        </div>
        <div class="search-result-card__location">
          <label>
            Lager / pose
            <input v-model="storageLocation" type="text" placeholder="Fx Sæk 2 · Pose 14" />
          </label>
        </div>
        <div class="part-actions">
          <button
            class="primary-btn full-width-btn"
            :disabled="addDisabled"
            @click="$emit('add', { ...setItem, storageLocation })"
          >
            {{ alreadyAdded ? 'Åbn i samlingen' : addLabel }}
          </button>
          <button class="secondary-btn full-width-btn" @click="$emit('open', setItem)">Åbn</button>
        </div>
      </div>
    </article>
  `
};

export const PickupListPage = {
  props: {
    items: { type: Array, default: () => [] },
    profileName: { type: String, default: "" }
  },
  emits: ["toggle-item", "remove-item", "open-set", "clear-checked"],
  computed: {
    pendingCount() {
      return this.items.filter((item) => !item.checked).length;
    },
    checkedCount() {
      return this.items.filter((item) => item.checked).length;
    },
    scopeLabel() {
      return this.profileName || "Familie";
    }
  },
  template: `
    <section class="panel">
      <div class="view-stack">
        <div class="settings-card">
          <div class="card-kicker">Klar til afhentning</div>
          <h2>Afhentningsliste</h2>
          <p>{{ scopeLabel }} · {{ pendingCount }} mangler · {{ checkedCount }} hentet</p>
        </div>

        <button
          class="secondary-btn full-width-btn"
          :disabled="checkedCount === 0"
          @click="$emit('clear-checked')"
        >
          Ryd hentede fra liste
        </button>

        <div v-if="items.length" class="pickup-table">
          <div class="pickup-table__header">
            <span>Pose nr.</span>
            <span>Pose/kasse</span>
            <span>Sæt nr.</span>
            <span>LEGO sæt</span>
            <span class="pickup-table__check">Handling</span>
          </div>

          <article
            v-for="item in items"
            :key="item.id"
            class="pickup-row"
            :class="{ 'pickup-row--checked': item.checked }"
          >
            <span class="pickup-row__status">
              {{ String(item.storageLocation || '').match(/\\d+/)?.[0] || '-' }}
            </span>
            <span class="pickup-row__storage">{{ item.storageLocation || 'Ikke angivet' }}</span>
            <strong class="pickup-row__set">{{ item.setNumber }}</strong>
            <button class="pickup-row__name" @click="$emit('open-set', item)">{{ item.name }}</button>
            <div class="pickup-row__actions">
              <button
                class="status-chip pickup-row__toggle"
                :class="item.checked ? 'status-green' : 'status-orange'"
                :aria-label="item.checked ? 'Marker som ikke hentet' : 'Marker som hentet'"
                @click="$emit('toggle-item', item.id)"
              >
                {{ item.checked ? '✓' : '○' }}
              </button>
            </div>
          </article>
        </div>

        <div v-else class="empty-state">
          <strong>Ingen sæt på afhentningslisten</strong>
          <p>Åbn et sæt og tryk på "Til afhentning" for at tilføje det her.</p>
        </div>
      </div>
    </section>
  `
};

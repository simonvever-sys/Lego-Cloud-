export const SetCard = {
  props: {
    setItem: { type: Object, required: true }
  },
  emits: ["open"],
  computed: {
    statusTone() {
      if (!this.setItem.hasManual) {
        return "status-red";
      }
      if (this.setItem.sellingStatus === "Sold") {
        return "status-gray";
      }
      if (this.setItem.sellingStatus === "For sale") {
        return "status-blue";
      }
      if (this.setItem.missingPieces > 0) {
        return "status-orange";
      }
      return "status-green";
    },
    statusLabel() {
      if (!this.setItem.hasManual) {
        return "Mangler manual";
      }
      if (this.setItem.sellingStatus === "Sold") {
        return "Solgt";
      }
      if (this.setItem.sellingStatus === "For sale") {
        return "Til salg";
      }
      if (this.setItem.missingPieces > 0) {
        return "Mangler klodser";
      }
      return "Har sættet";
    }
  },
  methods: {
    useFallbackImage(event) {
      event.target.src = "/images/lego-placeholder.png";
    }
  },
  template: `
    <article class="set-card">
      <img :src="setItem.image || '/images/lego-placeholder.png'" :alt="setItem.name" @error="useFallbackImage" />
      <div class="set-card-body">
        <div class="card-kicker">{{ setItem.setNumber }}</div>
        <h3>{{ setItem.name }}</h3>
        <p>{{ [setItem.theme, setItem.year, setItem.pieces ? setItem.pieces.toLocaleString('da-DK') + ' klodser' : '']
          .filter(Boolean)
          .join(' · ') || 'Oplysninger mangler'
        }}</p>
        <div class="badge-row" style="margin: 14px 0;">
          <span class="badge" :class="statusTone">{{ statusLabel }}</span>
          <span class="badge" v-if="(setItem.quantityOwned || 1) > 1">Antal: {{ setItem.quantityOwned }}</span>
          <span class="badge" v-if="setItem.ownerName">{{ setItem.ownerName }}</span>
          <span class="badge" v-if="setItem.storageLocation">{{ setItem.storageLocation }}</span>
          <span class="badge" v-if="setItem.wanted">Ønskeliste</span>
          <span class="badge" v-if="setItem.hasBox">Har kasse</span>
          <span class="badge" v-if="setItem.hasManual">Har manual</span>
        </div>
        <button class="secondary-btn full-width-btn" @click="$emit('open', setItem)">Åbn</button>
      </div>
    </article>
  `
};

export const HomePage = {
  props: {
    stats: { type: Object, required: true },
    salesCount: { type: Number, required: true },
    profile: { type: Object, required: true },
    familyProfiles: { type: Array, default: () => [] },
    previewSets: { type: Array, default: () => [] }
  },
  emits: ["open-collection", "open-set", "open-parts", "open-themes"],
  template: `
    <div class="view-stack">
      <section class="panel home-hero">
        <div class="home-hero__copy">
          <div class="card-kicker">Aktiv profil</div>
          <h2>{{ profile.name }}</h2>
          <p>{{ profile.description }}</p>
        </div>
        <div class="home-hero__badge">{{ profile.emoji }}</div>
      </section>

      <section class="panel">
        <div class="hero-metrics">
          <div class="metric">
            <strong>{{ stats.cards[0].value }}</strong>
            <span>sæt</span>
          </div>
          <button class="metric metric-action" @click="$emit('open-parts')">
            <strong>{{ stats.cards[1].value }}</strong>
            <span>klodser</span>
          </button>
          <button class="metric metric-action" @click="$emit('open-themes')">
            <strong>{{ stats.cards[2].value }}</strong>
            <span>temaer</span>
          </button>
          <div class="metric">
            <strong>{{ salesCount }}</strong>
            <span>salgsposter</span>
          </div>
        </div>
      </section>

      <section v-if="profile.id === 'family'" class="panel">
        <div class="profile-summary-grid">
          <article v-for="member in familyProfiles" :key="member.id" class="profile-summary-card">
            <div class="profile-summary-card__head">
              <span>{{ member.emoji }}</span>
              <strong>{{ member.name }}</strong>
            </div>
            <p>{{ member.count.toLocaleString('da-DK') }} sæt</p>
            <p>{{ member.pieces.toLocaleString('da-DK') }} klodser</p>
          </article>
        </div>
      </section>

      <section class="panel">
        <div v-if="previewSets.length" class="home-preview-grid">
          <button
            v-for="setItem in previewSets"
            :key="setItem.collectionKey || (setItem.ownerProfile + ':' + (setItem.rebrickableSetNumber || setItem.setNumber))"
            class="home-preview-card"
            @click="$emit('open-set', setItem)"
          >
            <img :src="setItem.image" :alt="setItem.name" />
            <strong>{{ setItem.setNumber }}</strong>
            <span>{{ setItem.name }}</span>
          </button>
        </div>
        <div v-else class="empty-state" style="margin: 0;">
          <strong>Ingen sæt endnu</strong>
          <p>Tilføj et sæt og kom i gang med samlingen.</p>
        </div>
        <button class="secondary-btn home-preview-more" @click="$emit('open-collection')">
          Se mere i samlingen
        </button>
      </section>
    </div>
  `
};

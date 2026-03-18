export const ProfileSelectPage = {
  props: {
    profiles: { type: Array, required: true },
    summaries: { type: Object, required: true }
  },
  emits: ["select-profile"],
  methods: {
    profileCount(profileId) {
      return this.summaries[profileId]?.count || 0;
    },
    profilePieces(profileId) {
      return this.summaries[profileId]?.pieces || 0;
    }
  },
  template: `
    <section class="profile-stage">
      <div class="profile-hero">
        <h1>LEGO Cloud</h1>
        <h2>Vælg en profil</h2>
        <div class="profile-hero__orbits">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <div class="profile-grid">
        <button
          v-for="profile in profiles"
          :key="profile.id"
          class="profile-card"
          :style="{ '--profile-accent': profile.accent, '--profile-accent-soft': profile.softAccent }"
          @click="$emit('select-profile', profile.id)"
        >
          <div class="profile-card__top">
            <div class="profile-card__avatar">{{ profile.emoji }}</div>
            <div class="profile-card__count">
              <span>{{ profileCount(profile.id).toLocaleString('da-DK') }} sæt</span>
              <span>•</span>
              <span>{{ profilePieces(profile.id).toLocaleString('da-DK') }} klodser</span>
            </div>
          </div>
          <div class="profile-card__body">
            <strong>{{ profile.name }}</strong>
            <p>{{ profile.description }}</p>
          </div>
          <div class="profile-card__cta">
            <span>Åbn profil</span>
            <strong>→</strong>
          </div>
        </button>
      </div>
    </section>
  `
};

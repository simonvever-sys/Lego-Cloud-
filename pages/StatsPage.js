export const StatsPage = {
  props: {
    stats: { type: Object, required: true }
  },
  template: `
    <div class="view-stack">
      <section class="stat-grid">
        <article class="stat-card" v-for="card in stats.cards" :key="card.label">
          <div class="stat-card-body">
            <div class="card-kicker">{{ card.label }}</div>
            <strong>{{ card.value }}</strong>
          </div>
        </article>
      </section>

      <section class="panel">
        <div class="theme-grid">
          <article v-for="theme in stats.themes" :key="theme.name" class="theme-card">
            <div class="card-kicker">{{ theme.name }}</div>
            <strong>{{ theme.count }}</strong>
            <p>{{ theme.pieces.toLocaleString('da-DK') }} klodser</p>
          </article>
        </div>
      </section>
    </div>
  `
};

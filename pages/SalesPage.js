export const SalesPage = {
  props: {
    sales: { type: Array, required: true }
  },
  template: `
    <div class="view-stack">
      <section v-if="sales.length" class="panel">
        <div class="list-grid">
          <article v-for="sale in sales" :key="sale.setNumber + sale.date" class="sales-card">
            <div class="sales-card-head">{{ sale.setNumber }} · {{ sale.name }}</div>
            <div class="sales-card-body">
              <p>Status: {{ sale.status === 'Sold' ? 'Solgt' : 'Til salg' }}</p>
              <p>Pris: {{ sale.price.toLocaleString('da-DK') }} kr.</p>
              <p>Dato: {{ sale.date }}</p>
              <p v-if="sale.platforms && sale.platforms.length">Steder: {{ sale.platforms.join(', ') }}</p>
              <p v-if="sale.soldTo">Solgt til: {{ sale.soldTo }}</p>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="empty-state">
        <strong>Ingen salg endnu.</strong>
      </section>
    </div>
  `
};

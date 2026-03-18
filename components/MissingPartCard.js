export const MissingPartCard = {
  props: {
    item: { type: Object, required: true }
  },
  emits: ["increment", "decrement"],
  template: `
    <article class="part-card touch-card">
      <img :src="item.part_image || item.image" :alt="item.part_name || item.part_num" />
      <div class="part-card-body">
        <div class="card-kicker">{{ item.part_num }}</div>
        <h3>{{ item.part_name || 'Ukendt klods' }}</h3>
        <p>Farve: {{ item.color }}</p>
        <div class="missing-qty">
          <span class="missing-qty__label">Mangler</span>
          <strong>{{ item.quantity_missing }}</strong>
        </div>
        <p>Sæt: {{ item.set_number }}</p>
        <div class="part-actions">
          <button class="primary-btn full-width-btn" @click="$emit('increment', item)">
            Mangler 1 mere
          </button>
          <button class="secondary-btn full-width-btn" @click="$emit('decrement', item)">
            Jeg fandt 1
          </button>
        </div>
      </div>
    </article>
  `
};

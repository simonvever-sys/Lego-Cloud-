import { MissingPartCard } from "../components/MissingPartCard.js";

export const MissingPartsPage = {
  components: { MissingPartCard },
  props: {
    missingParts: { type: Array, required: true }
  },
  emits: ["increment-missing", "decrement-missing"],
  template: `
    <div class="view-stack">
      <section v-if="missingParts.length" class="card-grid">
        <MissingPartCard
          v-for="item in missingParts"
          :key="item.set_number + item.part_num + item.color + (item.owner_profile || '')"
          :item="item"
          @increment="$emit('increment-missing', $event)"
          @decrement="$emit('decrement-missing', $event)"
        />
      </section>

      <section v-else class="empty-state">
        <strong>Ingen manglende klodser endnu.</strong>
        <p>Marker dele som mangler fra sætsiden for at opbygge listen.</p>
      </section>
    </div>
  `
};

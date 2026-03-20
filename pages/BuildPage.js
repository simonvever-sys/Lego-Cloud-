export const BuildPage = {
  props: {
    setItem: { type: Object, required: true },
    setParts: { type: Array, default: () => [] },
    partsLoading: { type: Boolean, default: false },
    partsError: { type: String, default: "" },
    partsRequested: { type: Boolean, default: false }
  },
  emits: ["back-to-detail", "request-parts", "update-checklist", "open-manual"],
  computed: {
    checklistState() {
      const raw = this.setItem?.buildChecklist;
      return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    },
    partRows() {
      const grouped = new Map();

      this.setParts.forEach((part) => {
        const partNum = String(part?.partNum || "").trim();
        const color = String(part?.color || "").trim();
        const key = this.createPartKey(partNum, color);
        const quantity = Math.max(0, Number(part?.quantity) || 0);

        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            partNum,
            name: String(part?.name || "Ukendt klods").trim() || "Ukendt klods",
            color,
            colorRgb: part?.colorRgb || "#d9d3c7",
            image: part?.image || "/images/part-placeholder.png",
            quantity: 0
          });
        }

        const current = grouped.get(key);
        current.quantity += quantity;
      });

      return [...grouped.values()]
        .map((row) => ({
          ...row,
          checked: Boolean(this.checklistState[row.key])
        }))
        .sort((left, right) => {
          if (left.checked !== right.checked) {
            return left.checked ? 1 : -1;
          }

          const quantityDiff = Number(right.quantity || 0) - Number(left.quantity || 0);
          if (quantityDiff !== 0) {
            return quantityDiff;
          }

          return String(left.name || "").localeCompare(String(right.name || ""), "da");
        });
    },
    checkedCount() {
      return this.partRows.filter((row) => row.checked).length;
    },
    remainingCount() {
      return Math.max(0, this.partRows.length - this.checkedCount);
    }
  },
  methods: {
    createPartKey(partNum, color) {
      const safePart = String(partNum || "").toLowerCase().replace(/\s+/g, "-") || "unknown";
      const safeColor = String(color || "").toLowerCase().replace(/\s+/g, "-") || "unknown";
      return `part-${safePart}--color-${safeColor}`;
    },
    togglePart(key) {
      const nextChecklist = {
        ...this.checklistState,
        [key]: !this.checklistState[key]
      };

      this.$emit("update-checklist", nextChecklist);
    },
    markAll(value) {
      const nextChecklist = this.partRows.reduce((accumulator, row) => {
        accumulator[row.key] = Boolean(value);
        return accumulator;
      }, {});

      this.$emit("update-checklist", nextChecklist);
    },
    onPartImageError(event) {
      event.target.src = "/images/part-placeholder.png";
    }
  },
  template: `
    <section class="panel">
      <div class="view-stack">
        <div class="settings-card">
          <div class="card-kicker">Byg pr. klods</div>
          <h2>{{ setItem.name }}</h2>
          <p>{{ setItem.setNumber }} · {{ checkedCount }}/{{ partRows.length }} klodser klar · {{ remainingCount }} mangler</p>
        </div>

        <div class="build-toolbar">
          <button class="secondary-btn" @click="$emit('back-to-detail')">← Tilbage til sæt</button>
          <button class="secondary-btn" @click="$emit('open-manual', setItem.setNumber)">📘 Åbn manual</button>
          <button class="secondary-btn" @click="markAll(true)" :disabled="!partRows.length">Markér alle</button>
          <button class="secondary-btn" @click="markAll(false)" :disabled="!partRows.length">Fjern markering</button>
        </div>

        <div v-if="!partsRequested && !partsLoading && !setParts.length && !partsError" class="empty-state">
          <strong>Byggesiden mangler klodsliste</strong>
          <p>Hent klodserne først, så du kan krydse hver enkelt klods af.</p>
          <button class="primary-btn" @click="$emit('request-parts', setItem)">🧩 Hent klodsliste</button>
        </div>

        <div v-else-if="partsLoading && !setParts.length" class="empty-state">
          <strong>Henter klodser...</strong>
          <p>Listen bliver klar om lidt.</p>
        </div>

        <div v-else-if="partsError" class="empty-state">
          <strong>Kunne ikke hente klodser</strong>
          <p>{{ partsError }}</p>
          <button class="secondary-btn" @click="$emit('request-parts', setItem)">Prøv igen</button>
        </div>

        <div v-else-if="partRows.length" class="build-table">
          <div class="build-table__header">
            <span>Billede</span>
            <span>Klods</span>
            <span>Farve</span>
            <span>Antal</span>
            <span class="build-table__check">Tjek</span>
          </div>

          <article
            v-for="row in partRows"
            :key="row.key"
            class="build-part-row"
            :class="{ 'build-part-row--checked': row.checked }"
          >
            <img
              class="build-part-row__image"
              :src="row.image || '/images/part-placeholder.png'"
              :alt="row.name"
              loading="lazy"
              @error="onPartImageError"
            />
            <div class="build-part-row__name">
              <strong>{{ row.name }}</strong>
              <p>{{ row.partNum || 'Ukendt nr.' }}</p>
            </div>
            <div class="build-part-row__color">
              <span class="color-swatch" :style="{ backgroundColor: row.colorRgb || '#d9d3c7' }"></span>
              <span>{{ row.color || 'Ukendt farve' }}</span>
            </div>
            <strong class="build-part-row__qty">{{ Number(row.quantity || 0).toLocaleString('da-DK') }}</strong>
            <div class="build-part-row__actions">
              <button
                class="status-chip build-part-row__toggle"
                :class="row.checked ? 'status-green' : 'status-orange'"
                :aria-label="row.checked ? 'Marker som ikke fundet' : 'Marker som fundet'"
                @click="togglePart(row.key)"
              >
                {{ row.checked ? '✓' : '○' }}
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  `
};

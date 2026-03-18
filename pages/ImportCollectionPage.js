export const ImportCollectionPage = {
  props: {
    state: { type: Object, required: true }
  },
  emits: ["select-file", "start-import"],
  methods: {
    onFileChange(event) {
      const [file] = event.target.files || [];
      if (file) {
        this.$emit("select-file", file);
      }
      event.target.value = "";
    }
  },
  template: `
    <div class="view-stack">
      <section class="panel">
        <div class="settings-card">
          <div class="card-kicker">Importer samling</div>
          <h2>Excel / CSV</h2>
          <p>Upload en fil med ét LEGO-sæt pr. række. Claus bliver sat som ejer på de importerede sæt.</p>
        </div>

        <label class="secondary-btn full-width-btn upload-btn" style="margin-top: 16px;">
          Upload Excel / CSV
          <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onFileChange" />
        </label>

        <div v-if="state.fileName" class="inline-info">Valgt fil: {{ state.fileName }}</div>

        <button
          class="primary-btn full-width-btn"
          style="margin-top: 12px;"
          :disabled="!state.fileName || state.running"
          @click="$emit('start-import')"
        >
          {{ state.running ? 'Importerer...' : 'Importer sæt' }}
        </button>
      </section>

      <section v-if="state.running || state.total" class="panel">
        <div class="import-progress">
          <div class="import-progress__bar">
            <span :style="{ width: state.total ? ((state.completed / state.total) * 100) + '%' : '0%' }"></span>
          </div>
          <strong>Importerer sæt...</strong>
          <p>{{ state.completed }} / {{ state.total }} sæt</p>
          <p v-if="state.currentSetNumber">Behandler: {{ state.currentSetNumber }}</p>
        </div>
      </section>

      <section v-if="state.finished" class="panel">
        <div class="empty-state">
          <strong>Import færdig</strong>
          <p>{{ state.imported.length }} sæt blev tilføjet eller opdateret.</p>
          <p>{{ state.errors.length }} sæt kunne ikke findes eller blev afvist.</p>
        </div>
      </section>

      <section v-if="state.errors.length" class="panel">
        <div class="empty-state">
          <strong>Disse sæt kunne ikke findes</strong>
          <div class="badge-row" style="margin-top: 12px;">
            <span class="badge" v-for="error in state.errors.slice(0, 50)" :key="error.setNumber + (error.reason || '')">
              {{ error.setNumber }}
            </span>
          </div>
          <p v-if="state.errors.length > 50" style="margin-top: 12px;">Viser de første 50 fejl.</p>
        </div>
      </section>
    </div>
  `
};

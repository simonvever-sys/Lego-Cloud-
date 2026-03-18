export const SettingsPage = {
  props: {
    version: { type: String, required: true }
  },
  emits: ["reset-system", "export-collection", "import-collection", "import-manuals", "open-bulk-import"],
  methods: {
    onFileChange(event) {
      const [file] = event.target.files || [];
      if (file) {
        this.$emit("import-collection", file);
      }
      event.target.value = "";
    },
    onManualFilesChange(event) {
      const files = [...(event.target.files || [])];
      if (files.length) {
        this.$emit("import-manuals", files);
      }
      event.target.value = "";
    }
  },
  template: `
    <section class="panel">
      <div class="view-stack">
        <div class="settings-card">
          <div class="card-kicker">System</div>
          <h2>LEGO Cloud</h2>
          <p>Version {{ version }}</p>
        </div>

        <button class="primary-btn full-width-btn" @click="$emit('reset-system')">Nulstil system</button>
        <button class="secondary-btn full-width-btn" @click="$emit('export-collection')">Eksporter samling</button>
        <button class="secondary-btn full-width-btn" @click="$emit('open-bulk-import')">Importer Excel / CSV</button>

        <label class="secondary-btn full-width-btn upload-btn">
          Importer backup (JSON)
          <input type="file" accept="application/json" @change="onFileChange" />
        </label>

        <label class="secondary-btn full-width-btn upload-btn">
          Importer manualer
          <input type="file" accept="application/pdf" multiple @change="onManualFilesChange" />
        </label>

        <div class="empty-state">
          <strong>Cloud-sync</strong>
          <p style="margin-top: 8px;">Sæt <code>window.LEGO_APP_CONFIG.supabase.url</code> og <code>anonKey</code> i <code>index.html</code>, så status bliver delt live mellem dine enheder.</p>
        </div>

        <div class="empty-state">
          <strong>Manualer</strong>
          <p style="margin-top: 8px;">Du kan nu uploade mange PDF'er ad gangen med filnavn som enten <code>42009.pdf</code>, <code>42009 - Kranvogn.pdf</code> eller selve sætnavnet. Systemet matcher automatisk og gemmer i cloud pr. sætnummer.</p>
        </div>
      </div>
    </section>
  `
};

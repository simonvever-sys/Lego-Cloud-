import {
  getCloudManualUrl,
  getManualPdfUrl,
  getManualUrl,
  isPdfUrl,
  normalizeSetNumber
} from "../lib/manuals.js";

export const ManualViewer = {
  props: {
    open: { type: Boolean, default: false },
    setNumber: { type: String, default: "" },
    setName: { type: String, default: "" },
    manualUrl: { type: String, default: "" }
  },
  emits: ["close"],
  computed: {
    normalizedSetNumber() {
      return normalizeSetNumber(this.setNumber);
    },
    cloudManualUrl() {
      return getCloudManualUrl(this.normalizedSetNumber);
    },
    legoPdfUrl() {
      return getManualPdfUrl(this.normalizedSetNumber);
    },
    legoInstructionsUrl() {
      return this.manualUrl || getManualUrl(this.normalizedSetNumber);
    },
    preferredPdfUrl() {
      return this.cloudManualUrl || (isPdfUrl(this.manualUrl) ? this.manualUrl : this.legoPdfUrl);
    },
    canEmbedPdf() {
      return Boolean(this.preferredPdfUrl);
    }
  },
  template: `
    <div v-if="open" class="modal-backdrop" @click.self="$emit('close')">
      <div class="modal-card manual-modal">
        <div class="manual-toolbar">
          <button class="secondary-btn" @click="$emit('close')">Luk</button>
          <div class="manual-toolbar__group">
            <a
              v-if="preferredPdfUrl"
              class="secondary-btn modal-link-btn"
              :href="preferredPdfUrl"
              target="_blank"
              rel="noreferrer"
            >
              Åbn PDF
            </a>
            <a
              v-if="legoInstructionsUrl"
              class="secondary-btn modal-link-btn"
              :href="legoInstructionsUrl"
              target="_blank"
              rel="noreferrer"
            >
              LEGO manualside
            </a>
          </div>
          <div class="manual-page-indicator">{{ setName || normalizedSetNumber }}</div>
        </div>

        <iframe
          v-if="canEmbedPdf"
          class="manual-viewer"
          :src="preferredPdfUrl"
          :title="'Manual ' + (setName || normalizedSetNumber)"
        ></iframe>

        <div v-else class="empty-state">
          <strong>Manual kunne ikke åbnes direkte.</strong>
          <p style="margin: 8px 0 16px;">Brug LEGO-linket eller upload en PDF til cloud som <code>{{ normalizedSetNumber }}.pdf</code>.</p>
          <a
            v-if="legoInstructionsUrl"
            class="primary-btn modal-link-btn"
            :href="legoInstructionsUrl"
            target="_blank"
            rel="noreferrer"
          >
            Åbn på LEGO.com
          </a>
        </div>
      </div>
    </div>
  `
};

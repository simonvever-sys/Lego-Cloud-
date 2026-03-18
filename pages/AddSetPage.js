export const AddSetPage = {
  template: `
    <div class="view-stack">
      <section class="panel">
        <div class="form-grid">
          <input placeholder="Sætnummer" />
          <input placeholder="Navn" />
          <input placeholder="Tema" />
          <input placeholder="År" />
          <input placeholder="Antal klodser" />
          <select>
            <option>Ikke bygget</option>
            <option>I gang</option>
            <option>Bygget</option>
          </select>
          <select>
            <option>Ikke til salg</option>
            <option>Til salg</option>
            <option>Solgt</option>
          </select>
          <input placeholder="Pris ved salg" />
          <div class="full-span">
            <textarea placeholder="Noter, manglende klodser, scanner-resultat eller manuel kommentar"></textarea>
          </div>
        </div>

        <div class="badge-row" style="margin-top: 16px;">
          <button class="primary-btn">Tilføj</button>
          <button class="secondary-btn">Annuller</button>
        </div>
      </section>

      <section class="panel">
        <div class="empty-state">
          <strong>Næste integration</strong>
          <p>Tilføj kamera-scan med BarcodeDetector eller en QR/barcode-pakke, og skriv resultatet direkte til Supabase collection-tabellen.</p>
        </div>
      </section>
    </div>
  `
};

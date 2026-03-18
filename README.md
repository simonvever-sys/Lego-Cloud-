# LEGO Samlingssystem

Simpel Vue-baseret prototype af en LEGO webapp med:

- touch-venlig hovedmenu
- kortbaseret samlingsvisning
- saetdetaljer med manual-links
- klodsesogning
- salgshistorik
- statistik og samlingskort
- plads til scanner og automatisk datahentning

## Kørsel

Projektet er lavet uden build-step.

1. Aabn [index.html](/Users/simonvever/Desktop/Lego%20cloud/index.html) i en browser, eller serv mappen statisk.
2. Saet `window.LEGO_APP_CONFIG.supabase.url` og `window.LEGO_APP_CONFIG.supabase.anonKey` i [index.html](/Users/simonvever/Desktop/Lego%20cloud/index.html).
3. Aktivér Supabase Realtime for tabellerne `collection` og `missing_parts`, hvis ændringer skal dukke op med det samme på flere enheder.
4. Opret en public Supabase Storage bucket med navnet `manuals`, hvis du vil dele egne PDF-manualer mellem enheder.
5. Deploy mappen direkte til Vercel som et statisk site.

## Struktur

- [index.html](/Users/simonvever/Desktop/Lego%20cloud/index.html): app-shell
- [app.js](/Users/simonvever/Desktop/Lego%20cloud/app.js): navigation og samlet state
- [style.css](/Users/simonvever/Desktop/Lego%20cloud/style.css): responsivt UI
- [pages/CollectionPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/CollectionPage.js): samling og filtre
- [pages/SetDetailPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/SetDetailPage.js): saetdetaljer
- [pages/PartsPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/PartsPage.js): klodsesogning
- [pages/SalesPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/SalesPage.js): salgsvisning
- [pages/StatsPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/StatsPage.js): statistik
- [pages/AddSetPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/AddSetPage.js): manuel indtastning og scanner-placeholder
- [api/rebrickable.js](/Users/simonvever/Desktop/Lego%20cloud/api/rebrickable.js): API-wrapper placeholder
- [api/supabase.js](/Users/simonvever/Desktop/Lego%20cloud/api/supabase.js): Supabase-konfiguration og schema-blueprint

## Naeste skridt

- Erstat mock-data i [data/mockData.js](/Users/simonvever/Desktop/Lego%20cloud/data/mockData.js) med Supabase-data.
- Tilfoej rigtig Rebrickable API-key i [api/rebrickable.js](/Users/simonvever/Desktop/Lego%20cloud/api/rebrickable.js).
- Tilfoej scanner via `BarcodeDetector` eller ekstern library i [pages/AddSetPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/AddSetPage.js).
- Tilfoej Supabase auth, hvis flere brugere skal have egne samlinger.

## Supabase noter

- `collection` tabellen skal mindst have kolonnerne `set_number`, `owner_profile`, `name`, `year`, `theme`, `num_parts`, `set_img_url`, `manual_url`, `owned`, `has_box`, `has_manual`, `missing_pieces`, `selling_status`, `build_status`, `seal_status` og `notes`.
- `missing_parts` boer ogsaa have kolonnen `owner_profile`, saa manglende dele kan knyttes til den rigtige profil.
- Brug helst en unik constraint paa `(set_number, owner_profile)` i `collection`, saa samme saet kan findes hos flere personer uden konflikt.
- Opret ogsa en public Storage bucket `manuals`; upload PDF'er som `42009.pdf`, saa appen kan vise dem paa alle enheder.

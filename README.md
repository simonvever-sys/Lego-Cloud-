# LEGO Samlingssystem

Vue-baseret LEGO webapp med:

- touch-venlig hovedmenu
- kortbaseret samlingsvisning
- saetdetaljer med manual-links
- klodsesogning
- salgshistorik
- statistik og samlingskort
- byggevisning med afkrydsning pr. klods

## Kørsel

Projektet er lavet uden build-step.

1. Aabn [index.html](/Users/simonvever/Desktop/Lego%20cloud/index.html) i en browser, eller serv mappen statisk.
2. Saet `window.LEGO_APP_CONFIG.supabase.url` og `window.LEGO_APP_CONFIG.supabase.anonKey` i [index.html](/Users/simonvever/Desktop/Lego%20cloud/index.html).
3. Aktivér Supabase Realtime for tabellerne `collection` og `missing_parts`, hvis ændringer skal dukke op med det samme på flere enheder.
4. Opret en public Supabase Storage bucket med navnet `manuals`, hvis du vil dele egne PDF-manualer mellem enheder.
5. Appen kan deployes direkte som statisk site (fx GitHub Pages eller Vercel).

## Vercel deploy (anbefalet)

Projektet er en ren statisk app uden build-step.

1. Gå til Vercel Dashboard og vælg `Add New...` -> `Project`.
2. Forbind din GitHub konto og vælg repoet `simonvever-sys/Lego-Cloud-`.
3. Build settings:
   - Framework Preset: `Other`
   - Build Command: tom
   - Output Directory: tom (root)
4. Klik `Deploy`.
5. Vercel giver en live URL på formen `https://<project-name>.vercel.app`.

Efter første deploy:
- Hver gang du laver `git push` til branchen, laver Vercel automatisk ny deploy.
- I Vercel kan du se status under `Deployments`.

`vercel.json` er tilføjet for at sikre statisk routing uden server.

## Struktur

- [index.html](/Users/simonvever/Desktop/Lego%20cloud/index.html): app-shell
- [app.js](/Users/simonvever/Desktop/Lego%20cloud/app.js): navigation og samlet state
- [style.css](/Users/simonvever/Desktop/Lego%20cloud/style.css): responsivt UI
- [pages/CollectionPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/CollectionPage.js): samling og filtre
- [pages/SetDetailPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/SetDetailPage.js): saetdetaljer
- [pages/PartsPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/PartsPage.js): klodsesogning
- [pages/SalesPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/SalesPage.js): salgsvisning
- [pages/StatsPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/StatsPage.js): statistik
- [pages/BuildPage.js](/Users/simonvever/Desktop/Lego%20cloud/pages/BuildPage.js): byg-side med klodscheckliste
- [api/rebrickable.js](/Users/simonvever/Desktop/Lego%20cloud/api/rebrickable.js): Rebrickable API-wrapper
- [api/supabase.js](/Users/simonvever/Desktop/Lego%20cloud/api/supabase.js): Supabase-konfiguration og schema-blueprint

## Naeste skridt

- Tilfoej rigtig Rebrickable API-key i [api/rebrickable.js](/Users/simonvever/Desktop/Lego%20cloud/api/rebrickable.js) eller brug Supabase-proxy.
- Tilfoej Supabase auth, hvis flere brugere skal have egne samlinger.
- Overvej E2E-tests af kritiske flows (saetdetalje, byg, afhentning, import).

## Supabase noter

- `collection` tabellen skal mindst have kolonnerne `set_number`, `owner_profile`, `name`, `year`, `theme`, `num_parts`, `set_img_url`, `manual_url`, `owned`, `has_box`, `has_manual`, `missing_pieces`, `selling_status`, `build_status`, `seal_status` og `notes`.
- `missing_parts` boer ogsaa have kolonnen `owner_profile`, saa manglende dele kan knyttes til den rigtige profil.
- Brug helst en unik constraint paa `(set_number, owner_profile)` i `collection`, saa samme saet kan findes hos flere personer uden konflikt.
- Opret ogsa en public Storage bucket `manuals`; upload PDF'er som `42009.pdf`, saa appen kan vise dem paa alle enheder.

# Gestion QSE Polytechs

Application de pilotage QSE organisée en trois pôles : Environnement, Sécurité et Qualité.

## Fonctionnalités

- Déchets, analyse environnementale et objectifs RSE.
- Accidents du travail, situations dangereuses, DUERP, dotations EPI et plans de prévention.
- Gestion documentaire par liens, registre réglementaire manuel et constats d’amélioration.
- Audits, plan d’actions transversal, actions liées aux fiches d’origine et échéancier commun.
- Statuts et contrôles adaptés à chaque module, conservation des versions et protection contre les modifications concurrentes.
- Exports CSV et démonstration séparée en lecture seule.
- Comptes individuels : lecteur (consultation/export), contributeur (fiches), administrateur (fiches et utilisateurs). Sessions protégées et changement obligatoire du mot de passe initial.
- Module EVRP dédié : 9 unités de travail, 41 fonctions, 680 situations du classeur 2026 et 10 actions PAPRIPACT, avec cotation F × G × IM × ID, révisions et mode opératoire imprimable. Les plages du classeur sont reprises : vert < 8, jaune 8 à moins de 20, orange 20 à 40, rouge > 40 ; les cotations absentes restent neutres.

## Périmètre

Le suivi des AT est interne et ne transmet pas de déclaration officielle. La veille réglementaire est manuelle. Les documents sont référencés par liens ; leurs fichiers ne sont pas stockés par cette version. Les validations ne sont pas des signatures électroniques. La cotation gravité × fréquence est indicative et doit être adaptée à la méthode interne. L’accès au site reste limité par la liste de visiteurs autorisés sur la plateforme d’hébergement. Les notifications internes liées aux tickets sont disponibles ; les rappels planifiés et l’envoi par courriel ne sont pas implémentés.

Les comptes administrateurs initiaux sont créés lors du premier accès à l’application. Leurs mots de passe initiaux doivent être remplacés avant toute consultation des fiches. Ne stockez jamais de mots de passe dans le dépôt ni dans des fiches QSE. Un nouvel utilisateur doit aussi être autorisé à visiter le site par la plateforme d’hébergement.

## Stock des EPI

Le service QSSE propose un seul accès EPI vers `/epi-stock`, avec deux vues : catalogue et stock, puis dotations. Le catalogue interne regroupe les deux onglets du classeur transmis : 106 codes de la nouvelle codification du 19 mai 2026 et 72 codes supplémentaires présents seulement dans le tableau du 9 mars 2026, signalés « À confirmer ». Les codes communs reprennent la nouvelle codification ; les doublons de cet onglet sont regroupés par code. Un administrateur peut confirmer ou désactiver chaque référence ancienne après vérification. Le fichier ne contient pas de quantités : le stock reste « non inventorié » jusqu’au premier comptage. Les références manquantes sont ajoutées automatiquement à la première ouverture du stock, sans toucher aux soldes déjà enregistrés. Les données préparées sont dans `private/epi-catalog.json`, exclues du miroir GitHub public.

Les contributeurs enregistrent les inventaires, entrées et sorties avec un historique daté. Une sortie exige un bénéficiaire ou service et ne peut rendre le solde négatif. Le seuil d’alerte et l’emplacement sont configurables par référence. La liste affiche 12 références par page et offre les filtres famille, recherche et situation du stock. Le CSV exporte les soldes filtrés. Les dotations existantes et nouvelles sont consultables et modifiables dans la deuxième vue. Une dotation passe de « À remettre » à « En service » seulement si sa référence est active et inventoriée avec un solde suffisant ; la transition débite automatiquement le magasin et consigne un mouvement. Les modifications ultérieures ne redébitent pas le stock et le retrait ne remet pas un EPI usagé en magasin.

## Évaluation des risques professionnels

Le service QSSE regroupe les accès directs au DUERP, au PAPRIPACT et aux registres QSE. Le DUERP ouvre `/duerp`. Les données du classeur transmis sont préparées dans le source **privé** du Site, hors du dépôt GitHub public. À la première ouverture par un administrateur, l’import se lance par blocs sans écraser les fiches déjà modifiées. Il peut être repris depuis la page si nécessaire. Un autre déploiement du code démarre sans les données du classeur. Le contenu confidentiel `private/duerp-source.json` ne doit pas être poussé dans un dépôt public.

L’onglet **PAPRIPACT · toutes unités** reprend les actions importées sans remplir les champs vides à leur place. Il présente une année de programme, le pilote, les conditions d’exécution, les ressources, le coût estimé, un indicateur de résultat, le calendrier et la vérification de l’efficacité. Les mesures proposées dans le DUERP sans action correspondante peuvent être reprises en une action liée à un risque ; les doublons textuels sont regroupés par unité et les correspondances suggérées restent à confirmer. La couleur du risque aide l’arbitrage, mais ne constitue pas une priorité décidée par l’entreprise. Une action clôturée exige la date de fin et une vérification renseignée.

Le registre conserve la valeur issue du classeur et calcule séparément F × G × IM × ID. 89 lignes du fichier demandent une vérification, principalement des cotes de fréquence absentes et des résultats Excel en erreur. Une valeur déduite d’un libellé reste signalée et doit être confirmée par l’équipe QSE avant validation. Les risques de la production restent rattachés à UT1 : le fichier ne permet pas d’attribuer chaque risque à UT1a–UT1f. Les effectifs textuels et partagés ne sont pas additionnés.

Les modifications des évaluations et des actions sont historisées. Un administrateur peut figer une copie datée de travail qui contient les risques, les actions et leur état de validation, puis la télécharger. Cette copie ne vaut pas validation par l’entreprise. Organisez la conservation durable des versions complètes ; le suivi applicatif actuel ne constitue pas à lui seul un système d’archivage réglementaire de 40 ans. Le mode opératoire est disponible dans le module et renvoie aux références INRS et Code du travail.

## Développement et vérifications

Application React / TypeScript avec Vinext, API Cloudflare Workers et base D1. Les données réelles sont distinctes du code source et ne sont pas incluses dans ce dépôt. Les migrations `drizzle/` doivent être conservées dans leur ordre. Ne pas réécrire une migration déjà appliquée.

- Installation : `pnpm install --frozen-lockfile`
- Tests des règles métier : `node tests/workflows.mjs`
- Vérification TypeScript : `node node_modules/typescript/bin/tsc --noEmit`
- Compilation : `pnpm build`

Le dépôt GitHub conserve le code ; un push seul ne configure pas une nouvelle base de données ni un hébergement. Pour un hébergement indépendant, configurer les bindings Cloudflare et la protection d’accès avant d’exposer des données. Les instructions du socle sont conservées ci-dessous.

---

# vinext-starter

A clean full-stack starter running on [vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git is required only for publishing

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For browser QA on managed Linux, use `sites-preview start`. The project's dev script runs Vite and accepts the supervisor's `--host 0.0.0.0 --port 4173 --strictPort` arguments. The internal browser uses `http://terminal.local:4173/`; it is not a user-facing URL. The supervisor owns the preview lifecycle. The ignored local profile survives the supervisor's cleared process environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` starts intentionally empty
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)

### Équipes, rangs et tableaux de bord

Le bandeau gauche organise Direction (rang 1) et les services RH, QSSE,
Production et R&D (rang 2). Les administrateurs peuvent ajouter ou modifier
les équipes, leur rang et leur rattachement. Un service de rang 2 doit être
rattaché à une équipe de rang 1 ; une équipe possédant des services ne peut
pas être rétrogradée. Le rang ne modifie jamais les droits d’accès.

Dans `/unites`, **Ouvrir l’équipe** affiche tous ses tableaux. **Nouveau tableau**
crée une configuration indépendante : titre, équipe et périmètre DUERP
(aucun, une unité ou tout le site). **Personnaliser** permet d'ajouter, retirer,
déplacer et agrandir les blocs, renseigner les notes et indicateurs manuels,
renommer le tableau ou le déplacer dans une autre équipe. **Enregistrer le tableau**
conserve les modifications ; **Annuler** revient à la version précédente.
Les lecteurs consultent ; contributeurs et administrateurs créent et modifient
les tableaux. Les modifications concurrentes sont protégées par révision.

Migration 0007 : les tableaux par unité existants sont copiés dans QSSE,
avec contenu, révision et périmètre conservés. Les liens `/unites?unit=UT1`
restent valides. Aucun rattachement d’unité à un service métier n’est déduit.
Les nouveaux tableaux d'équipe commencent avec des notes et un indicateur manuel ;
l’utilisateur choisit explicitement un périmètre pour les blocs automatiques.

Les blocs DUERP utilisent les cotations et couleurs de l'évaluation, avec les
anomalies signalées séparément. Les actions ouvertes couvrent toutes les années ;
le PAPRIPACT est filtré par année. Une échéance du jour n'est pas en retard (date
Europe/Paris). Une action clôturée n'entre plus dans les retards. Les indicateurs
personnalisés restent des saisies manuelles datées, sans comparaison automatique
à l'objectif. Les fiches QSE générales ne sont pas agrégées par unité tant qu'elles
ne disposent pas d'un rattachement explicite à l'unité.

API : `GET /api/dashboards` (arborescence), `GET /api/dashboards?id=…`
(contenu et données du périmètre), `POST /api/dashboards` avec les actions
`team`, `create` ou `save`. Tables `teams` et `team_dashboards`.

### Éditeur de tableaux de bord

**Personnaliser** ouvre l'éditeur ; **Aperçu** montre le résultat avant sauvegarde.
Chaque tableau dispose d'une grille de 1 à 4 colonnes, d'une couleur de fond et
d'un espacement réglable. Chaque bloc possède une largeur, une hauteur minimale,
un fond, un accent, un alignement, une taille de texte et un titre masquable.
Les couleurs de criticité DUERP conservent leur signification métier.

Déplacement par poignée (souris) ou flèches (clavier/mobile), duplication de bloc,
retrait avec rétablissement du dernier bloc retiré. **Dupliquer le tableau** crée
une copie indépendante. Sur mobile, les blocs passent sur une colonne.

Aux blocs DUERP/PAPRIPACT s'ajoutent textes, indicateurs manuels, titres de section,
liens HTTP(S), listes de contrôle, tableaux libres et graphiques en barres
à valeurs positives ou négatives. Les tableaux se saisissent cellule par cellule,
avec en-têtes en première ligne ; les graphiques utilisent une paire libellé/valeur
par ligne. Les cases des listes se modifient dans l'éditeur puis s'enregistrent.
Les liens et documents sont ajoutés par URL ; les fichiers ne sont pas téléversés.

Les contributeurs et administrateurs personnalisent les tableaux partagés ; les
lecteurs consultent. Les anciens tableaux restent compatibles sans migration.
Limites : 60 blocs, 50 éléments de liste, 50 lignes de données et 8 colonnes par
tableau libre. Le serveur valide les paramètres et les URLs à chaque sauvegarde.

### Espace Dashboard / Tickets / Routines / Communication

L'accueil ouvre désormais les tableaux sur un fond blanc avec les quatre onglets
principaux en haut. Les modules QSE précédents sont conservés à `/qse` et le DUERP
reste à `/duerp`. Un nouveau tableau commence vide ; les tableaux existants sont
conservés avec leurs contenus et réglages.

**Tickets** : titre, catégorie, description, attribution à plusieurs équipes,
pilote, échéance, responsables et plan d'actions avec cases à cocher, pilotes et
délais individuels. La clôture exige un pilote et toutes les actions réalisées.
La fiche et les actions s'enregistrent ensemble. Les commentaires apparaissent
à droite, avec auteur et horodatage ; ils se sauvegardent indépendamment.
Les notifications sont internes au site (cloche) et personnelles aux comptes
sélectionnés : pilote du ticket, pilotes d'actions et responsables. Les commentaires
peuvent les notifier, et un bouton permet une relance manuelle. Aucun e-mail,
SMS ni push externe n'est envoyé. Le compteur se rafraîchit à l'ouverture et chaque
minute pendant l'utilisation.

Les pièces jointes sont stockées dans le bucket privé `BUCKET`, leurs métadonnées
dans D1. Accès authentifié pour ajout et téléchargement. Formats : JPEG, PNG, GIF,
WebP, HEIC/HEIF, PDF, DOC/DOCX et XLS/XLSX ; 15 Mo par fichier, 20 fichiers par ticket.
Les images compatibles avec le navigateur ont un aperçu ; HEIC et documents se
téléchargent. Pas d'analyse antivirus intégrée. Les documents sont servis comme
pièces jointes avec `nosniff`, les images seuls pouvant être affichées en ligne.

**Routines** : grille d'audit et calendrier avec occurrence ponctuelle, quotidienne,
hebdomadaire ou mensuelle, intervalle et fin facultative. Les heures sont affichées
en heure France. Une récurrence mensuelle conserve le jour d'origine, ramené au
dernier jour lorsqu'il n'existe pas (31 janvier → 28 février → 31 mars).
Chaque occurrence a son propre compte rendu et état d'avancement, sans cocher les
suivantes. Un compte rendu terminé doit renseigner tous les points. Les écarts
peuvent ouvrir un ticket prérempli et lié à l'audit. Une routine ayant un compte
rendu conserve son calendrier et sa grille ; suspendre l'ancienne et en créer
une autre pour les changer. Les comptes rendus suspendus restent consultables.
Les occurrences sont calculées à la lecture du calendrier, sans tâche serveur ni
rappel automatique en arrière-plan.

**Communication** : fil de messages avec service émetteur et équipes destinataires,
filtrable selon ces deux critères. Le ciblage organise le fil ; il ne constitue
pas une restriction de confidentialité entre équipes. Les rôles existants restent
applicables (lecteur : consultation ; contributeur/admin : saisie).

Migration 0008 : tables hub dédiées, sans modification des données QSE ou EVRP.
API `/api/hub` et `/api/ticket-files`. Les fiches et comptes rendus sont protégés
contre l'écrasement par révisions concurrentes. Tests métier : `node tests/hub.mjs`.

## Navigation et ergonomie

Le contexte `team` est conservé entre tableaux de bord, tickets, routines et communications. Les liens des cartes ouvrent la fiche concernée ; un nouveau ticket ou une routine peut reprendre le service sélectionné. La navigation mobile se replie et les listes de tickets et de travail sont paginées. L’espace EPI partage la navigation des autres modules et guide le premier inventaire.

Les modifications QSE/EVRP et leurs historiques sont enregistrés dans un même lot transactionnel ; un conflit de révision ne produit pas de nouvelle ligne d’historique. Une action PAPRIPACT exige un pilote et une échéance dès qu’elle quitte « À définir ». Les formulaires DUERP protègent les saisies non enregistrées. `node tests/transactions.mjs` vérifie les handlers sur une base SQLite temporaire, y compris les conflits et les remises EPI.

# Gestion des déchets

Le module `/dechets` remplace l’accès au registre générique des déchets. Les anciens liens QSSE et les fiches existantes ouvrent le nouveau registre ; les autres modules restent inchangés.

- Vue de suivi : masses réelles, recyclage matière, dangerosité déclarée, enlèvements prévus, palettes, graphiques par mois, famille et traitement final. Les graphiques ouvrent un détail chiffré et proposent plusieurs représentations.
- Registre paginé, recherche sans accents, filtres d’année, famille, dangerosité, statut, dates et périmètre ; export CSV de la sélection avec protection contre les formules.
- Fiches modifiables par les administrateurs et contributeurs autorisés QSSE, consultation pour les lecteurs autorisés. Historique et contrôle des modifications concurrentes ; source d’origine conservée.
- Le bilan additionne uniquement les quantités réelles en tonnes ou kilogrammes, pour les lignes enlevées avec une date valide. Les estimations, prévisions, unités et données incertaines restent séparées. Le recyclage matière est distinct de la valorisation énergétique.
- Les quantités numériques des lignes palettes sont interprétées en unités malgré l’en-tête du fichier. La valeur brute reste consultable et l’unité peut être corrigée. Une masse source exceptionnellement élevée est conservée avec une unité à confirmer, hors bilan tant qu’elle n’est pas vérifiée.
- Le périmètre Polytechs exclut seulement les lignes explicitement marquées « à retirer des stat » ; le filtre peut afficher toutes les lignes. Les marqueurs « déchets clients » ne suppriment pas automatiquement une ligne du bilan.

Les données du classeur sont une source privée côté serveur (`private/waste-source.json`). Elles ne doivent être ni placées dans `public/`, ni ajoutées au miroir GitHub public. Les nouvelles fiches et corrections sont stockées en D1 (`waste_records`), avec les états précédents dans `waste_history`. Les lignes historiques ne sont pas dupliquées lors d’une republication. L’API renvoie la source brute uniquement pour une fiche demandée et après authentification et contrôle de l’accès QSSE.

`scripts/import-waste-source.py <classeur.xlsx> <sortie.json>` permet de reproduire l’extraction avec `openpyxl` (lecture seule). Ne pas remplacer une source existante sans gérer les identifiants de lignes et les corrections déjà enregistrées. Les références documentaires du classeur ne constituent pas des fichiers joints : les documents restent accessibles via les liens renseignés sur les fiches.

Validation : `node tests/waste.mjs` couvre la séparation des unités, les dates invalides, les estimations, les droits, la source privée, l’historique et les conflits de modification.

## GED et circuit de validation

`/ged` centralise le catalogue documentaire, les documents joints, les versions et les décisions. L’accès QSSE « Gestion documentaire » et les anciens liens du registre pointent vers cette page.

La source privée `private/ged-source.json` reprend 795 entrées de la LDA, 524 entrées de l’onglet des documents périmés/obsolètes et 129 lignes d’historique. Les identifiants incluent l’onglet et la ligne : les doublons ne sont pas fusionnés et les statuts incohérents restent signalés. Les statistiques de l’ancien onglet de synthèse ne servent pas d’indicateurs actuels. Le catalogue n’est pas assimilé à des fichiers déjà importés ni à des versions approuvées dans la GED. Ne jamais ajouter cette source au miroir GitHub public ou aux ressources publiques du site.

Le circuit suit `Brouillon → Relecture QSSE → Approbation N+1 → Approuvé`. Un retour motivé passe la version « À corriger » : la correction annule les visas de la version courante, puis nécessite de nouveau la relecture et l’approbation. Les décisions précédentes restent dans l’historique. L’auteur ne peut être ni son propre relecteur ni son propre approbateur. Un même responsable peut relire en tant que QSSE puis approuver en tant que N+1 ; chaque décision est enregistrée séparément avec son acteur et sa date.

Les administrateurs configurent le N+1 de chaque auteur et les relecteurs habilités QSSE dans les paramètres du circuit. Le N+1 n’est pas inféré automatiquement et les cycles hiérarchiques sont refusés. Flavien et Karine, ainsi que les contributeurs déjà membres QSSE, sont proposés comme relecteurs QSSE par défaut ; une configuration explicite remplace ce défaut. Aucune affectation hiérarchique n’est inventée. Les affectations sont vérifiées à la soumission, puis conservées pour cette version. Même un administrateur ne peut pas enregistrer un visa à la place du relecteur ou de l’approbateur désigné.

Les brouillons restent modifiables par l’auteur ou un administrateur. Les fichiers doivent être joints avant l’envoi en relecture ; un lien externe reste complémentaire. Les fichiers, métadonnées et affectations sont figés pendant la relecture et l’approbation. Les fichiers acceptés sont PDF, DOC/DOCX, XLS/XLSX, JPG et PNG, limités à 15 Mo chacun et 20 par version. Chaque fichier conserve son nom, son auteur d’import, sa date et son empreinte SHA-256. Les versions approuvées sont immuables. Une seule version ouverte est autorisée par document, avec un nouvel indice requis après la première version approuvée.

L’approbation déplace atomiquement le pointeur de version applicable ; la version précédente reste applicable pendant toute la préparation et les anciens fichiers restent consultables comme historiques. Les lectures respectent les services accessibles ; les brouillons et leurs fichiers sont réservés aux participants du circuit et aux administrateurs. Les notifications sont internes au site, sans envoi de courriel.

Stockage D1 : `ged_documents`, `ged_versions`, `ged_profiles`, `ged_events`, `ged_files`. Fichiers R2 : `ged/<version>/<fichier>`. Les opérations protègent les révisions concurrentes, enregistrent les décisions et actualisent la version applicable dans le même lot transactionnel. Les ajouts de fichiers utilisent un contrôle de révision après écriture R2 et retirent le fichier si la transaction ne l’a pas rattaché.

Validation : `node tests/ged.mjs` couvre un cycle complet avec correction, la séparation des rôles, la hiérarchie N+1, les fichiers privés et figés, les conflits de révision, l’historique et le maintien de la version applicable. `scripts/import-ged-source.py <classeur.xlsx> <sortie.json>` reproduit l’extraction en lecture seule.


## Plan d’actions consolidé et archivage

`/plan-actions` reprend les 628 lignes du plan P22 indice D fourni. Le snapshot
`private/quality-actions-source.json` reste exclusivement côté serveur, hors miroir
GitHub public. `scripts/import-quality-actions.py <source.xlsx> <snapshot.json>`
permet de reconstruire la source privée sans modifier le classeur. Les originaux,
cotations historiques, remarques et dates de consolidation restent consultables.
Les modifications sont conservées dans D1 avec révision optimiste et historique.

La priorité est calculée avec G × E (P1 ≥16, P2 ≥8, P3 ≥4). L’échéance proposée
n’est pas une décision COPIL. Les ressources suivent le maximum des lectures heures
et euros. La réalisation et l’efficacité sont distinctes : seule une vérification
QSSE avec critère, preuve et cotation avant/après établit le résultat. Changer
l’action, le résultat, la cotation ou le statut annule la vérification précédente.
Une action non efficace peut donner lieu à une nouvelle action liée à son origine.
Les comptes des pilotes doivent être associés explicitement : les noms Excel ne
créent ni comptes ni affectations automatiques. Les services sources restent intacts ;
l’équipe du site peut être ajustée (Finances est initialement rattaché à Direction,
Assurance Qualité à QSSE, Planification & Logistique à Planification).

Un ticket lié est créé à la demande avec un identifiant déterministe et un lien
réciproque. Ses affectations et échanges se gèrent dans le ticket ; son archivage
ne supprime ni ne clôture l’action source. Mon travail évite de compter une seconde
fois le dossier principal, mais conserve les sous-actions ajoutées au ticket.
La fiche GED peut être sélectionnée via recherche et ouverte depuis le plan.

Les tickets clôturés peuvent être archivés et restaurés par un contributeur
autorisé sur les équipes du ticket. Les archives conservent les commentaires et
fichiers et restent lisibles avec les mêmes droits. Elles sont figées jusqu’à
restauration. Archivage et restauration sont tracés comme événements dans les
commentaires, avec révision optimiste. Aucun archivage ni effacement automatique.

Vérification : `node tests/quality-actions.mjs`, `node tests/ged.mjs`,
`pnpm exec tsc --noEmit --incremental false`.


### Ergonomie du suivi

Le plan s’ouvre sur les actions à réaliser. Les compteurs sont limités au service
sélectionné ; les actions annulées sont exclues du compteur à coter. Le tri par
urgence place d’abord les retards, puis les priorités et échéances. Une répartition
colorée permet de filtrer une classe. La fiche expose cinq étapes et conserve les
champs non affichés : action, cotation, réalisation, efficacité et historique.
Les pilotes et documents GED se choisissent avec une recherche sans distinction
d’accents. Les prérequis du contrôle sont visibles avant le visa QSSE.

Les tickets proposent des vues rapides à traiter, en retard, à vérifier et mes
tickets. Les archives affichent leur date d’archivage, et la vue Archives est
conservée dans l’URL. Les réponses de liste obsolètes sont ignorées lorsqu’on
change de vue. Les contrôles de modification suivent les droits des équipes
d’origine ; l’API reste l’autorité. La clôture est guidée par le pilote et les
sous-actions restantes.

### Maintenance / GMAO

`/maintenance` est l’espace métier du service Maintenance, avec vue d’ensemble,
interventions, équipements, préventif, planning et pièces détachées. La navigation
conserve les tableaux personnalisables du service et y affiche les graphiques GMAO.
Le parc et les stocks démarrent vides : aucun équipement, quantité ou coût fictif.

Une demande peut être déposée par un contributeur pour son service, avec ou sans
équipement. Elle crée un ticket lié pour les commentaires et fichiers. Un ticket
existant ouvert peut aussi être converti par la maintenance, sans recopier les
échanges. Le titre, l’affectation et l’état se pilotent ensuite dans la GMAO ; les
sous-actions et échanges restent dans le ticket. Mon travail affiche l’intervention
une seule fois et conserve les sous-actions du ticket.

Parcours : qualification → planification → intervention → contrôle du résultat →
clôture. La maintenance attribue un technicien habilité, les dates et conditions de
sécurité. La soumission au contrôle nécessite un compte rendu, un résultat, les
heures réalisées et tous les points de contrôle terminés. La maintenance ou le
demandeur peut confirmer la clôture. Un motif est requis pour annuler, clôturer ou
rouvrir. Les tickets archivés doivent être restaurés avant reprise. Les changements
et mouvements sont historisés ; les comptes rendus clôturés restent figés.

Les plans préventifs fixent l’équipement, la périodicité hebdomadaire ou mensuelle,
le technicien et les contrôles. Dans Planning, choisir une période de 62 jours au
maximum puis « Générer le préventif ». La génération est explicite : il n’y a pas de
processus automatique en arrière-plan. Une occurrence ne crée qu’une intervention,
avec ses contrôles copiés et figés. Une fin de mois reste ancrée au jour du premier
contrôle. Après génération, suspendre le plan et en créer un autre pour changer
l’équipement ou le calendrier. Les instructions nouvelles s’appliquent aux futures
interventions uniquement. Une génération est limitée à 200 occurrences par appel.

Le stock initial est constaté à la création d’une référence. Entrées, sorties vers
une intervention ouverte et corrections d’inventaire sont tracées. Une sortie ne
peut rendre le stock négatif ; les modifications de référence ne changent pas les
quantités. Les quantités sont conservées avec six décimales. Le coût unitaire du
mouvement est conservé au moment de la sortie ; un coût absent reste inconnu.
La liste signale les quantités inférieures ou égales au seuil.

Les droits suivent les services : lecture du service propriétaire ou Maintenance,
gestion par les contributeurs Maintenance et administrateurs. Le demandeur conserve
la lecture de sa demande, même si ses droits de service évoluent. Les écritures
vérifient les révisions et regroupent la GMAO, le ticket et l’historique en transaction.
Les notifications sont internes au site, lors de l’affectation et du contrôle/clôture.

Vérification : `node tests/gmao.mjs`, `node tests/quality-actions.mjs`,
`pnpm exec tsc --noEmit --incremental false`.


## Système de Management Intégré (SMI)

La page `/smi` est accessible depuis la navigation principale. Elle présente les
chapitres 4 à 10 sous forme de colonnes défilantes sur ordinateur et tablette,
et de sections verticales sur téléphone (seuil de 700 px). Les filtres et la
recherche sont locaux et immédiats ; la GED est relue au retour sur la page et
chaque minute, hors saisie en cours.

### Référentiels et interprétation

Le jeu initial contient 72 entrées de suivi distinctes par norme, regroupées par
thèmes : ISO 9001:2026, ISO 14001:2026 et ISO 45001:2018 + Amd 1:2024. Les intitulés
et points d’attention sont des paraphrases de pilotage. Ce n’est pas une
reproduction exhaustive des paragraphes normatifs : Polytechs doit compléter
les regroupements au niveau de détail souhaité à partir de ses exemplaires ISO.
Les éditions 2026 utilisent 10.1 pour l’amélioration continue et 10.2 pour les
non-conformités/actions correctives ; ISO 45001 conserve aussi 10.3.
Sources officielles : <https://www.iso.org/fr/standard/9001>,
<https://www.iso.org/fr/standard/14001>,
<https://www.iso.org/fr/standard/88428.html>.

Les exemples désignent des preuves possibles, jamais des titres de documents
prétendument imposés par une norme. Q/E/S proviennent des référentiels en base ;
C est dérivé de plusieurs normes applicables. Un administrateur peut ajouter,
modifier ou suspendre les référentiels et exigences. Une même clé de thème
regroupe des clauses distinctes sans confondre leurs codes par norme.

### GED unique et droits

`smi_standards`, `smi_requirements`, `smi_document_links`, `smi_evidence_links` et
`smi_events` portent uniquement la cartographie, ses relations et sa traçabilité.
Les documents, fichiers, versions et acteurs restent ceux de la GED existante.
La création depuis SMI enregistre le brouillon GED et toutes ses relations dans
une transaction unique. Aucun fichier ni document n’est copié pour chaque norme.
Le circuit auteur → relecteur QSSE → approbateur N+1 reste obligatoire pour
publier une version. La prochaine révision fait partie de la fiche GED ; son
suivi et l’archivage sont historisés dans la GED.

Les propositions calculées sur les titres existants ne sont pas des preuves
confirmées : elles doivent être validées par le service pilote ou QSSE. Un lien
retiré reste marqué comme tel pour empêcher sa recréation automatique ; on peut
le rétablir avec le contrôle de révision. Les lecteurs ne peuvent modifier aucun
élément. Les documents et exports respectent les accès par service et les
participants au circuit GED. Les liens d’audit, écarts et actions sont gérés par
QSSE, à partir des éléments existants que l’utilisateur peut consulter. Un ticket
peut être retenu comme écart ou action selon sa nature ; une routine programmée
n’est pas présentée comme un audit déjà réalisé.

### Couverture documentaire

Pour une exigence, chaque preuve liée et confirmée vaut 1 si elle possède une
version GED approuvée avec fichier, sans brouillon ouvert ni révision dépassée ;
0,5 si elle est en révision ; 0 si elle est à créer ou archivée. Un rattachement
non confirmé vaut 0. La couverture est la moyenne de ces valeurs, arrondie à
l’entier inférieur ; aucune preuve donne 0. Les chapitres et référentiels font la
moyenne des exigences correspondantes. Les filtres documentaires ne retirent
pas les preuves défavorables du dénominateur. Les résultats sont limités au
périmètre documentaire accessible à l’utilisateur. « Couvertes » ne signifie
pas conformité certifiée ni efficacité vérifiée en audit.

### Export et évolution

`GET /api/smi/export` produit un vrai classeur XLSX, avec la matrice filtrée et
une feuille expliquant les règles et référentiels. Les textes sont des cellules
littérales (aucune formule injectée). `exportMatrix` dans `lib/smi.ts` sépare les
données de la génération XLSX pour accueillir ultérieurement un export PDF.

### Migration et vérifications

La migration additive `drizzle/0017_last_jocasta.sql` crée cinq tables et les
référentiels initiaux, sans réécriture des données métiers existantes.
`scripts/rollback-smi.sql` est un retour arrière manuel, exclu des migrations
automatiques : sauvegarder les tables SMI, revenir à une version applicative
compatible, puis supprimer uniquement ces tables. Les documents créés depuis
SMI restent dans la GED. Pour réinstaller après ce retour arrière, restaurer la
sauvegarde ou réappliquer explicitement la migration selon le journal de
migration de l’environnement, sans réinitialiser la base.

Vérifications : `node tests/smi.mjs`, `node tests/ged.mjs` et
`node node_modules/typescript/bin/tsc --noEmit --incremental false`, puis le build
Sites. Les tests SMI exercent les routes réelles sur SQLite avec les règles
réelles d’accès par service et vérifient aussi le classeur via `openpyxl`.
Le rendu navigateur et les interactions tactiles doivent encore être contrôlés
sur les appareils cibles : le contrôle navigateur n’était pas disponible dans
l’environnement de réalisation.
# Profil utilisateur et préférences de langue

La photo à droite des notifications ouvre une fenêtre compacte avec le nom, l’identifiant, le changement/suppression de photo et la langue du site. Les comptes lecteurs peuvent modifier leur propre profil. Les langues disponibles sont français (valeur initiale), anglais, allemand, italien et espagnol. Le choix est enregistré dans D1 et rechargé à la connexion ; il n’est pas partagé entre les utilisateurs.

`user_profiles` (migration additive 0019) référence les comptes existants. Les photos sont stockées dans R2 et servies par une route authentifiée sans cache partagé. Le client cadre et réduit les images à 512 × 512 pixels avant envoi. Le serveur vérifie le format, l’origine, l’utilisateur et une limite de 2 Mo sur le flux. Remplacer ou supprimer une photo conserve la préférence de langue.

Le catalogue `lib/interface-locale.ts` traduit les libellés communs, la navigation, le profil et les contrôles principaux. Il doit encore être complété pour tous les textes métier détaillés et les messages des modules. Aucun contenu n’est envoyé à un service de traduction. Les saisies et documents restent stockés dans leur langue d’origine. `data-no-translate` protège les textes qui doivent conserver leur affichage d’origine. La langue HTML suit le choix du compte. Les nouvelles traductions doivent être ajoutées dans les cinq langues.

Vérification : `node tests/profile.mjs` teste les préférences des cinq langues, leur isolation par compte, la lecture privée des photos, les limites d’import, le remplacement et la suppression. `pnpm test:security` couvre l’authentification et les droits existants. Le retrait de cette fonctionnalité demande d’abord de revenir au code précédent ; la table `user_profiles` peut ensuite être conservée pour éviter toute perte de préférences, ou supprimée explicitement après sauvegarde. Les autres tables ne sont pas modifiées.


### Confidentialité et droits des services

Les services sans configuration d’accès explicite sont restreints par défaut. Le service `rh` est toujours restreint : seuls les membres désignés et les administrateurs y accèdent, même si son ancienne configuration le déclarait ouvert. Une équipe explicitement ouverte reste accessible aux comptes connectés, sauf RH.

Les contenus RH rattachés à plusieurs services nécessitent l’habilitation RH. Ce contrôle s’applique aux tickets, pièces jointes, commentaires, routines, communications, statistiques, agrégats, notifications, dashboards, GED et SMI/export. Les contenus GED RH nécessitent aussi cette habilitation pour les anciens auteurs, relecteurs et approbateurs : une affectation documentaire ancienne ne contourne pas un retrait de droits. La modification RH exige la contribution RH et le rôle global approprié. Les tickets/routines non classés sont réservés aux administrateurs.

L’administration des droits reste réservée aux administrateurs et ses modifications sont tracées dans `security_events`. Les retraits de membres sont appliqués à la requête suivante, sans attendre la fin de session. Aucun document ni compte n’est supprimé ; aucune migration n’est nécessaire. Un retour au commit précédent rétablit les anciennes règles sans modifier les données.

Les administrateurs conservent tous les droits : ce rôle doit être attribué uniquement aux personnes habilitées. Classer les dossiers RH dans le service RH / processus GED S3 (ou périmètre I) est nécessaire ; l’application ne devine pas la sensibilité d’un texte placé dans un service public. Les droits SharePoint/Power BI des contenus intégrés restent gérés par ces services externes. Les tests locaux ne constituent pas une attestation de sécurité absolue ni un test d’intrusion en production.

Vérifications : `tests/security.mjs` (droits administrateur, dashboards, retrait immédiat, agrégats), `tests/gmao.mjs` (tickets RH multiservices, fichiers, notifications, statistiques), `tests/smi.mjs` (catalogue GED, accès direct, anciens participants, fichiers et matrice SMI), ainsi que la suite complète.

### Rôles locaux des équipes

Les niveaux stockés dans `team_members.level` sont : `viewer` (Consultation), `user` (Utilisateur : saisie des indicateurs, actions réalisées, commentaires/pièces jointes, comptes rendus d’audit), `contributor` (Coordinateur : gestion des contenus et dashboards), `team_admin` (Administrateur d’équipe : coordination, nom et membres). Les anciens contributeurs conservent leurs droits sous le libellé Coordinateur. Aucune migration ni modification automatique des membres existants.

Un rôle local ne confère aucun droit global, aucune gestion d’une autre équipe et aucun droit d’ouvrir une équipe à tous. Les comptes globaux lecteurs restent en lecture seule. Les modules spécialisés (GED, SMI, DUERP, GMAO) conservent leurs habilitations supplémentaires ; le rôle Utilisateur n’autorise pas la modification de leurs paramètres ou documents. Les changements de rôle sont appliqués côté serveur à chaque requête et journalisés. Les administrateurs locaux ne peuvent pas modifier leur propre rôle.

Les équipes déjà explicitement ouvertes conservent leur comportement historique pour les non-membres. Un rôle local explicite restreint cette contribution (Consultation / Utilisateur). Pour réserver l’accès aux membres, un administrateur général doit restreindre l’équipe ; RH reste toujours restreint.


## Comptes rendus automatiques des routines / audits

Depuis une occurrence de `/routines`, « Démarrer l’audit » enregistre le début
côté serveur. Les champs lieu/atelier et personnes auditées complètent la date,
le service et les intervenants. La grille peut regrouper ses points par thème
(ex. règles d’or). Le calendrier et la grille des routines déjà utilisées restent
figés ; « Dupliquer » permet de préparer une nouvelle version sans altérer les
comptes rendus existants.

Le score est `conformes / (conformes + non conformes)`, arrondi à l’entier le plus
proche. Les N/A et les points à faire sont exclus de ce ratio ; les points à faire
restent visibles ; seuls les points obligatoires non renseignés empêchent de terminer l’audit. Aucun point applicable donne
« — » / « N/A », jamais 100 %. Le ratio et les volumes sont détaillés par thème.
La fin et l’intervenant sont enregistrés côté serveur au passage à « terminé ».
La durée affichée est le temps écoulé entre le démarrage enregistré et la fin,
pas un chronométrage du travail actif. Un ancien audit sans heure de début ou un
audit enregistré directement terminé affiche « Non mesurée ».

Les photos sont rattachées à un point ou à la synthèse générale, avec légende,
auteur et date. Le navigateur réduit l’image ; le serveur la décode, contrôle les
limites, réoriente puis réencode en JPEG sans métadonnées. Limites : 2 Mo à l’envoi,
20 mégapixels à la lecture, 30 photos et 20 Mo cumulés par occurrence. Les objets
sont stockés sur le disque persistant sous `objects/audits/`. Ajouter une photo
sauvegarde d’abord les réponses en cours ; les écritures utilisent la révision du
compte rendu. Un audit terminé doit être rouvert/enregistré avant modification de
ses photos. Retirer une photo du brouillon ne détruit pas l’objet utilisé par les
versions antérieures.

« Télécharger le PDF » génère réellement un PDF A4 à partir de la version
**enregistrée**, sans saisie manuelle du rapport : logo Polytechs, score global,
thèmes, checklist, observations, photos légendées, intervenants, dates, durée,
synthèse, révision et pagination. Un brouillon est indiqué explicitement. Les
tickets d’origine liés et accessibles sont inclus avec leur état au moment de
la génération. Le PDF n’est pas envoyé par mail et n’est pas dupliqué dans la GED.
Aucune IA ni service de conversion externe n’intervient.

Les routes `/api/routine-files` et `/api/routines/report` contrôlent la session,
le rôle et les droits réels du service à chaque requête, y compris la frontière
RH pour les audits et tickets multiservices. Un lecteur habilité peut exporter,
mais ne peut pas ajouter de photo. Les réponses sont privées et non mises en
cache partagé. Les données et versions antérieures sont conservées ; la nouvelle
table additive `hub_run_history` est créée par `0021_audit_reports.sql` au démarrage.
Le script de restauration d’export accepte les anciennes sauvegardes ne contenant
pas encore cette table sur une cible vide. Le retour arrière manuel est documenté
dans `scripts/rollback-audit-reports.sql` ; revenir d’abord à l’application
précédente et sauvegarder les données avant toute suppression de table.

Vérifications : `node tests/audit-reports.mjs` (nécessite Poppler pour contrôler
le contenu des PDF), suite métier complète, TypeScript et build Next.js.
Les documents fictifs de vérification sont générés sous `tmp/audit-reports/`,
exclus du dépôt public. Le modèle Fabriq fourni et ses données ne sont pas publiés.

Après compilation, `node scripts/verify-audit-report-build.mjs` vérifie la connexion,
la création d’une routine, l’enregistrement et le téléchargement PDF par HTTP réel
sur une base SQLite temporaire. Aucun compte ni audit de production n’est utilisé.


## Constructeur visuel d’audits

« Créer un audit » ouvre un constructeur en quatre étapes : cadrer le périmètre,
construire la grille, programmer les occurrences et vérifier avant enregistrement.
La navigation par thèmes remplace la longue liste de champs. Les cartes de
questions se replient ; les flèches permettent de réordonner thèmes et questions
sans dépendre d’un glisser-déposer. On peut renommer, dupliquer, déplacer une
question vers un thème, retirer des questions et rétablir le dernier retrait.
L’ajout en série accepte une question par ligne et annonce les limites avant tout
ajout. La grille reste limitée à 100 questions.

Trois modèles d’exemple sont proposés : terrain QSSE, 5S et fournisseur. Ils
restent à adapter et ne sont jamais présentés comme des grilles approuvées par
Polytechs. Appliquer un modèle à une grille renseignée demande confirmation.
Les services et le pilote se choisissent par recherche dynamique ; les droits
applicatifs existants restent vérifiés côté serveur.

Chaque question peut être un contrôle de conformité, un texte, un nombre ou
une date, avec une aide et un caractère obligatoire/facultatif. Les champs de
contexte ne contribuent jamais au score, même si leur texte contient « Conforme ».
La valeur numérique zéro est une réponse valide. Pour un contrôle non conforme,
on peut exiger une observation, une photo ou les deux. Ces preuves et les
réponses obligatoires sont contrôlées **sur le serveur** avant la clôture ; les
brouillons peuvent rester incomplets. Les réponses sont normalisées d’après la
grille, et non d’après un type fourni par le navigateur. Le PDF et l’écran de
réalisation reprennent ces nouveaux types et les critères d’observation.

L’aperçu interactif permet d’essayer les réponses et le calcul du score sans
les enregistrer. Le calendrier affiche les quatre prochaines occurrences, y
compris les fins de mois. La vérification repère les champs manquants et signale
les doublons probables, les dates passées et les grilles longues. Ces conseils
ne remplacent pas une validation de la grille par le service.

Une routine possédant un compte rendu est explicitement verrouillée dans le
constructeur pour sa grille et son calendrier ; les métadonnées autorisées et
son activation restent modifiables. « Dupliquer » conserve les anciens audits et
crée une grille indépendante. Les données historiques restent compatibles : les
anciens points sont des contrôles obligatoires par défaut. Aucune nouvelle table
ni migration de base n’est nécessaire pour ce constructeur.

Vérification : `node tests/audit-builder.mjs`, `node tests/audit-reports.mjs`,
suite métier complète, build Next.js et vérification HTTP du serveur compilé.
Les interactions du constructeur ont été exercées dans un aperçu isolé avec des
données fictives (modèle, ajout, déplacement, essai du score et verrouillage).

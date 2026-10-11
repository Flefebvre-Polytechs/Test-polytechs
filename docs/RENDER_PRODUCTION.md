# Polytechs sur Render

La branche `render-production` contient un serveur Next.js Node, une base SQLite et les pièces jointes sur un disque persistant Render. Le dépôt public ne contient ni export D1 ni sources documentaires privées. Ne fusionnez pas cette branche dans le déploiement Cloudflare Sites : son adaptateur de stockage est propre à Render.

## Création

Ouvrir le Blueprint de `Normaxis/Test-polytechs`, branche `render-production`, depuis le tableau de bord Render. Vérifier le service `polytechs` en région Frankfurt, plan Starter, disque `polytechs-data` monté sur `/var/data/polytechs` (1 Go initial). Les disques Render nécessitent un service payant et une seule instance.

Renseigner `RENDER_INITIAL_ADMIN_USERNAME` et un mot de passe temporaire de 16 caractères minimum dans les secrets du Blueprint. Le premier démarrage crée ce compte seulement si la table `users` est vide. L'URL `RENDER_EXTERNAL_URL` est fournie automatiquement par Render et sert au contrôle d'origine des requêtes. Pour un futur domaine personnalisé, définir `POLYTECHS_PUBLIC_ORIGIN` à son origine HTTPS exacte.

## Reprise des données

La sauvegarde privée `polytechs-d1-transfer.json` contient les tables métier et comptes, hors sessions et limites éphémères. La sauvegarde privée `polytechs-private-sources.tar.gz` contient les cinq sources historiques JSON. Ne jamais placer ces fichiers dans GitHub, dans `public/` ou dans les logs.

Après le premier démarrage, transférer les deux sauvegardes vers un dossier privé du disque Render, par exemple `/var/data/polytechs/transfer`. Depuis un shell Render dans le répertoire du projet :

```sh
POLYTECHS_DATA_DIR=/var/data/polytechs RENDER_INITIAL_ADMIN_USERNAME=<identifiant-temporaire> node scripts/render-import.mjs /var/data/polytechs/transfer/polytechs-d1-transfer.json
mkdir -p /var/data/polytechs/private
tar -xzf /var/data/polytechs/transfer/polytechs-private-sources.tar.gz -C /var/data/polytechs
```

Contrôler les quantités affichées (1 059 lignes métier au moment de la capture) et les clés étrangères, puis supprimer les deux archives de `transfer` seulement après vérification des sauvegardes Render. Redémarrer le service pour charger les sources privées. Les anciens cookies/sessions ne sont pas transférés : chaque utilisateur se reconnecte avec son compte existant.

Une photo de profil était stockée dans R2 et n'est pas incluse dans la sauvegarde des tables. La récupérer séparément ou demander à son titulaire de la téléverser à nouveau après bascule. Ne pas considérer la migration complète avant cette vérification.

## Contrôles avant ouverture

1. Vérifier `/api/auth` (réponse 200), puis se connecter avec un compte existant.
2. Vérifier les 680 risques DUERP, 9 unités, 23 tableaux de bord, 2 tickets et les droits RH/QSSE.
3. Vérifier que les sources privées GED, déchets, EPI et actions qualité sont visibles.
4. Essayer un ajout puis un téléchargement de pièce jointe, et un redémarrage sans perte.
5. Refaire une dernière synchronisation D1 si des utilisateurs ont écrit sur l'ancien site depuis la capture, avant de leur communiquer la nouvelle URL.

Conserver le Site actuel en service jusqu'à la validation de ces points. Le stockage SQLite sur disque impose une seule instance et empêche les déploiements sans interruption ; prévoir des sauvegardes régulières de la base et des fichiers.

# Actualisation du suivi des enlèvements de déchets

Le fichier Excel `Imp2.1305b_Suivi enlèvements déchets(1).xlsx` a été converti avec `scripts/import-waste-source.py` en une source JSON privée. Il contient 1 763 lignes d’enlèvement, l’ensemble des colonnes source, les en-têtes, les deux entrées de référence ADR et les quatre types de traitement. La comparaison avec la source antérieure du dépôt local donne 30 lignes ajoutées, 46 fiches source modifiées, aucune ligne supprimée. L’identifiant stable `excel-dechets-<numéro de ligne>` est conservé.

## Import sur Render

1. Après déploiement du code, ouvrir **Gestion des déchets → Importer le registre** avec un compte administrateur global.
2. Sélectionner le fichier JSON privé préparé à partir du classeur. Il ne faut pas déposer ce fichier sur GitHub ni dans `public/`.
3. Vérifier l’aperçu : lignes précédentes, nouvelles lignes, modifications et nombre de corrections conservées.
4. Confirmer l’import. La source précédente est sauvegardée sous `POLYTECHS_DATA_DIR/private/waste-source.backup-*.json`. La nouvelle source est écrite sur ce même disque puis visible sans redémarrage.

L’API refuse une source mal formée, des identifiants en double, la disparition d’une ligne existante, une modification concurrente, une requête non autorisée ou un import en l’absence de disque persistant. Les corrections enregistrées dans `waste_records` et leur historique SQLite ne sont pas écrasés : elles restent prioritaires sur la source Excel.

Une quantité estimée négative historique reste visible dans la source et figure parmi les points à vérifier ; elle n’est pas transformée en quantité réelle. Les indicateurs continuent d’exclure les quantités manquantes, les enlèvements prévus et les unités non massiques.

Le dépôt GitHub contient le code et le convertisseur, **pas la source privée**. Le déploiement de code seul ne met pas à jour le registre de production : l’import administrateur est nécessaire.

# Suppression des fiches QSE

Les administrateurs globaux peuvent retirer une fiche depuis le registre ou depuis sa fiche. La fenêtre affiche le titre et la version enregistrée et exige exactement `SUPPRIMER`. Le serveur contrôle lui aussi le rôle, l’origine, ce mot et la révision.

La suppression retire l’entrée de `records` : les registres, indicateurs et échéanciers ne la remontent plus. Le dernier état enregistré est conservé dans `record_deletions`, avec l’identifiant de l’administrateur et l’horodatage. Les versions de `record_history` restent conservées. Aucun accès public à ces traces n’est ajouté. Le journal de sécurité contient uniquement l’identifiant de la fiche.

Une fiche avec des actions liées ne peut pas être supprimée. Les dotations EPI déjà remises et les anciennes fiches documentaires/déchets doivent être gérées par leurs modules dédiés. Aucune cascade de suppression ni correction automatique du stock n’est effectuée.

L’écriture de la trace, le retrait du registre et l’événement de sécurité sont transactionnels. Une modification concurrente annule le retrait. La création d’une action vérifie également que son origine existe toujours au moment de l’insertion.

## Migration et retour arrière

`0022_record_deletions.sql` ajoute uniquement une table vide, sans modifier les données existantes. Le démarrage Render applique cette migration avant le lancement du serveur. Un retour à la version précédente du code peut conserver cette table ; elle est ignorée par l’ancienne version. Ne pas supprimer la table après utilisation : elle contient les derniers états retirés. Une restauration éventuelle requiert une intervention administrative sur une sauvegarde, après vérification des liens et de l’historique ; aucun bouton de restauration n’est livré dans cette évolution.

## Vérification

`node tests/record-deletion.mjs` teste les droits réels, l’origine HTTP, la confirmation exacte, les révisions, les liens, les EPI, les traces, la disparition des listes et les conflits concurrents, sur une base SQLite temporaire appliquant toutes les migrations.

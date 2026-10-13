# Première intégration et gestion des membres

Dans « Membres et paramètres », ouvrir « Inviter un nouveau membre », saisir son adresse professionnelle et choisir son rôle dans l'équipe. Le compte est créé lors de l'activation, pas lors de la préparation de l'invitation.

Le lien dure sept jours, ne peut être utilisé qu'une fois et peut être révoqué. Le token est haché dans la base. Il figure dans le fragment de l'URL, sans être envoyé dans l'URL des requêtes HTTP ni dans les en-têtes Referer. L'inspection et l'activation passent par un POST limité à 16 Ko, avec contrôle d'origine. La page d'invitation demande de ne pas transmettre de Referer et n'est pas indexable.

Le bouton « Préparer l'e-mail » ouvre la messagerie de l'administrateur. Aucun envoi automatique n'est configuré. Le lien peut aussi être copié. Ne pas annoncer « e-mail envoyé » avant que l'expéditeur ait réellement envoyé le message.

Après activation, utiliser la recherche par nom et les rôles existants : les relations des équipes utilisent l'ID du compte et ne demandent plus l'adresse. Une personne possédant un compte ancien peut se connecter et rouvrir son invitation pour l'associer à ce compte, sans doublon. Son rôle global et ses appartenances existantes restent inchangés. Un lecteur ne peut pas accepter une invitation donnant des droits d'écriture sans modification de son rôle global par un administrateur général.

Les invitations sont limitées aux équipes que l'émetteur peut administrer. Une révocation de ses droits invalide ses invitations en attente. L'activation recontrôle ces droits dans la même transaction que la consommation du lien, la création du compte, l'affectation à l'équipe et la journalisation.

## Migration additive 0020

La migration ajoute `users.email` nullable et `team_invitations`. Elle ne change aucun compte, mot de passe, rôle ou document existant. Les métadonnées Drizzle sont mises à jour. Le démarrage Render applique la migration une seule fois.

Pour un retour arrière manuel, arrêter le service et conserver une sauvegarde cohérente avant d'exécuter les commandes suivantes sur la base. Elles suppriment uniquement les invitations et les adresses ajoutées ; les comptes activés et les appartenances restent présents.

```sql
DROP TABLE team_invitations;
DROP INDEX users_email_unique;
ALTER TABLE users DROP COLUMN email;
DELETE FROM render_schema_migrations WHERE name='0020_team_invitations.sql';
```

Revenir aussi au code précédant cette migration avant de redémarrer. Ne pas appliquer ces commandes en fonctionnement normal.

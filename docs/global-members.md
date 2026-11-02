# Administration globale des membres

## Accès

Une entrée **Administration → Membres et accès** est visible dans le bandeau gauche pour les administrateurs globaux. URL : `/membres`.

L’ancienne rubrique QSSE « Utilisateurs et droits » affiche le même composant : une seule gestion des comptes est maintenue. Les administrateurs d’équipe conservent leur gestion locale ; ils ne peuvent pas consulter l’annuaire global ni modifier les comptes globaux.

## Fonctionnalités

- Annuaire de tous les comptes, y compris les personnes sans affectation.
- Recherche en temps réel (nom, e-mail, service, rôle), insensible aux accents.
- Filtres rôle global, service et comptes à vérifier ; pagination à 15 personnes.
- Indicateurs : total, administrateurs globaux, personnes sans affectation et adresses manquantes.
- Création d’un compte avec adresse, mot de passe initial et rôle. Le compte doit changer son mot de passe initial ; les services sont affectés ensuite depuis sa fiche.
- Fiche globale : modifier le nom, le rôle, l’adresse et les affectations de cette personne à plusieurs services. L’historique et les ID stables sont conservés. L’adresse e-mail sert d’identifiant public, sans pseudo à renseigner.
- Les changements de rôle et de droits par service demandent confirmation. Les modifications périmées sont refusées (nom, rôle global, affectation de service).
- Le changement d’adresse garde la confirmation par mot de passe administrateur et la révocation des sessions/codes.
- Fermeture volontaire de toutes les sessions d’un compte après confirmation, sans suppression du compte ni de ses données.
- Sur téléphone, l’annuaire devient une liste de cartes ; la fiche conserve un défilement interne et une croix accessible.

## Logique d’accès

Un administrateur global conserve l’accès à tous les services. Un rôle global Lecteur ne peut pas dépasser la consultation, même si une ancienne affectation explicite indique un niveau supérieur. Les accès hérités d’un service ouvert sont signalés : retirer l’affectation ne bloque pas cet accès. Les RH restent toujours restreintes.

Il n’est pas possible de retirer ses propres droits d’administrateur global. Le dernier administrateur est protégé. Les API `/api/users` continuent à refuser les utilisateurs ordinaires et les administrateurs d’équipe. Les autorisations de service réutilisent `/api/team-access`.

Nouvelles actions `/api/users` (administrateur global uniquement, contrôle Origin) :

- `name` : `id`, `displayName`, `expectedName`.
- `revoke-sessions` : `id`.
- `role` accepte désormais `expectedRole` pour refuser une modification concurrente.

La fermeture de session et la modification du nom sont journalisées dans `security_events`. Aucune migration ni suppression de données métier n’est nécessaire.

## Vérifications

`node tests/global-members.mjs` valide l’annuaire complet, le refus des lecteurs et administrateurs d’équipe, les changements concurrents, les protections administrateur, la révocation des sessions, les affectations multi-services, la confidentialité RH et les événements d’audit.

Les tests d’authentification e-mail et de sécurité existants restent applicables. La vérification visuelle utilise des données fictives isolées ; aucun compte de production n’est modifié lors de ces tests.

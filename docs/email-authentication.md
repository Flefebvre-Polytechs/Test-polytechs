# Connexion avec vérification e-mail et récupération du mot de passe

## Fonctionnement

- Sans activation, les comptes et connexions existants sont conservés. Aucun compte ni adresse n’est inventé.
- Avec `POLYTECHS_EMAIL_MFA_REQUIRED=true`, un mot de passe correct déclenche un code aléatoire à 6 chiffres, valable 10 minutes, 5 essais maximum. Aucune session n’est créée avant validation. Les anciennes sessions sans vérification e-mail ne donnent plus accès aux API.
- Un compte sans adresse est refusé lorsque cette protection est obligatoire. L’administrateur doit donc renseigner les adresses avant activation.
- « Mot de passe oublié ? » accepte l’adresse e-mail ; réponse identique pour un compte inconnu, connu ou limité. L’envoi est effectué après la réponse avec `after()` de Next.js, sans attendre Microsoft 365 côté navigateur et sans exposer l’existence du compte par la durée du transport.
- Le lien de récupération expire après 30 minutes. Son secret de 256 bits est dans le fragment de l’URL, retiré de la barre d’adresse au chargement. Aucun lien n’est construit à partir d’un Host fourni par le client.
- Réinitialiser exige un nouveau mot de passe d’au moins 12 caractères, différent de l’adresse e-mail. La réinitialisation ne connecte pas automatiquement : nouvelle connexion puis code e-mail si activé.
- Codes et jetons sont stockés sous forme d’empreintes. Le vérificateur du code inclut le secret aléatoire de la demande, absent de la base. Ils sont liés à l’adresse et au hash du mot de passe au moment de l’émission.
- La consommation est atomique avec l’ouverture de session ou le remplacement du mot de passe. Deux utilisations concurrentes d’un lien ne peuvent pas toutes les deux réussir.
- Réinitialisation et changement de mot de passe révoquent sessions, identités et demandes en attente. Changement de rôle ou d’adresse révoque également les demandes en attente.
- Les limitations de demandes sont persistantes : connexion 5 / 15 min par adresse ; émission des codes 3 / 10 min par compte ; récupération 3 / heure par adresse et par compte ; vérification 5 essais par demande.
- Adresse de récupération modifiable seulement par un administrateur général qui confirme son mot de passe ; aucune modification libre par un utilisateur. Un changement de sa propre adresse le déconnecte.

## Configuration Microsoft 365 (administrateur du tenant)

Aucun service supplémentaire n’est souscrit par le code. Les autorisations de messagerie restent à fournir par Polytechs.

1. Créer une inscription d’application dans Microsoft Entra ID.
2. Autoriser l’envoi Microsoft Graph `Mail.Send` en mode application avec consentement administrateur. Restreindre l’application à la boîte expéditrice autorisée via les contrôles Exchange appropriés (Application RBAC / politique d’accès selon la configuration du tenant).
3. Définir une boîte expéditrice existante et autorisée. Aucun mot de passe personnel de messagerie n’est nécessaire ; utiliser le secret d’application, conservé uniquement dans Render.
4. Dans Environment du **nouveau** service Test-polytechs, ajouter :

| Variable | Valeur |
| --- | --- |
| `POLYTECHS_MAIL_TENANT_ID` | ID du tenant Microsoft 365 |
| `POLYTECHS_MAIL_CLIENT_ID` | ID de l’application autorisée |
| `POLYTECHS_MAIL_CLIENT_SECRET` | Valeur du secret d’application ; jamais dans Git ni le chat |
| `POLYTECHS_MAIL_FROM` | Adresse de la boîte autorisée à envoyer |
| `POLYTECHS_PUBLIC_ORIGIN` | `https://polytechsconnect.fr`, une fois DNS et HTTPS opérationnels |
| `POLYTECHS_EMAIL_MFA_REQUIRED` | D’abord `false`, puis `true` après les étapes ci-dessous |

La configuration de l’origine sert aussi à la protection CSRF : les utilisateurs doivent accéder au domaine canonique configuré. Si le domaine n’est pas prêt, utiliser provisoirement `https://test-polytechs.onrender.com`. Le transport utilise HTTPS vers login.microsoftonline.com et graph.microsoft.com, avec délais maximum et sans journaliser secrets ou messages.

## Activation sans blocage des comptes

1. Déployer la migration additive 0023 via `npm run start:render`.
2. Dans « Utilisateurs et droits », renseigner et vérifier les adresses de **tous** les comptes, en particulier Flavien et Karine. Les nouveaux comptes créés manuellement exigent désormais une adresse. Les invitations réutilisent l’adresse déjà associée.
3. Configurer Microsoft 365 et le domaine public. Tester réellement la réception via « Mot de passe oublié ? » sur son propre compte et ouvrir le lien reçu. Un `202` Microsoft signifie accepté, pas garantie de livraison ; contrôler spams et traces Exchange si besoin.
4. Lorsque réception et récupération sont validées, définir `POLYTECHS_EMAIL_MFA_REQUIRED=true`, enregistrer et redéployer.
5. Tester la connexion : pas d’accès avant le code ; puis vérifier lecture/écriture selon les droits du compte.
6. Après la première connexion du nouvel administrateur Render, supprimer les variables `RENDER_INITIAL_ADMIN_PASSWORD` et `RENDER_INITIAL_ADMIN_EMAIL` (et l’ancienne variable `RENDER_INITIAL_ADMIN_USERNAME` si présente) si elles ne sont plus nécessaires au bootstrap.

Si Microsoft 365 est indisponible avec MFA obligatoire, la connexion échoue sans ouvrir de session. Ne jamais mettre un code fixe ou divulguer un jeton pour contourner ce blocage. Corriger la messagerie avec l’administrateur Microsoft 365.

## Vérifications exécutables

`node tests/email-auth.mjs` : vraies migrations et SQLite, transport Microsoft simulé uniquement pour ne pas envoyer de messages. Valide droits, origine, absence de session avant code, expiration, limites, usage unique concurrent, compte modifié pendant validation, refus en cas d’échec de transport et révocation des sessions.

`node tests/security.mjs` : contrôles existants d’accès, RH/QSSE, profils, invitations et autres modules.

`pnpm exec tsc --noEmit` et `POLYTECHS_DATA_DIR=/tmp/polytechs-email-build pnpm exec next build --webpack` : vérifications de compilation. Le chemin temporaire est utilisé seulement pour compiler localement, jamais comme stockage d’un déploiement.

L’envoi et la réception réels ne peuvent être validés sans les autorisations Microsoft 365. Le déploiement de code seul n’active pas la protection obligatoire.

## Migration et retour arrière

0023 ajoute `sessions.email_verified`, la table `auth_challenges` et son index. Aucune donnée métier ni aucun utilisateur n’est supprimé. Le retour à l’ancien code est possible sans supprimer les colonnes/tables ajoutées ; toutefois cela rétablit sa politique de connexion antérieure. Ne pas annoncer une protection MFA après un tel retour arrière.

## Références

- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow
- https://nextjs.org/docs/app/api-reference/functions/after
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

La vérification par e-mail dépend de la sécurité de la boîte de réception. Elle ne fournit pas la résistance au phishing d’une clé de sécurité ou d’une passkey.

## Identité de connexion

L’adresse e-mail est l’identifiant public. Les nouveaux comptes et les invitations ne demandent aucun pseudo. Un identifiant technique opaque est conservé en base pour compatibilité avec les données existantes ; il n’est ni saisi ni affiché aux utilisateurs. La connexion normalise espaces et casse de l’adresse. Une recherche ambiguë (plusieurs comptes historiques avec la même adresse normalisée) est refusée.

Pour chaque ancien compte, renseigner l’adresse dans Membres et accès avant de diffuser les nouvelles consignes de connexion. Les sessions et ID existants sont conservés. Un ancien compte **sans aucune adresse** peut encore utiliser provisoirement son identifiant historique ; dès qu’une adresse est affectée, seule cette adresse permet la connexion. Aucun e-mail n’est inventé ni deviné. La récupération utilise uniquement l’adresse e-mail.

Sur une nouvelle installation Render, définir `RENDER_INITIAL_ADMIN_EMAIL` et `RENDER_INITIAL_ADMIN_PASSWORD` pour créer le premier administrateur. Les variables de bootstrap ne modifient jamais un compte déjà existant.

## Expédition depuis le compte Gmail Polytechs Connect

Le transport Gmail SMTP est disponible sans inscription d'application Microsoft.
Il utilise `smtp.gmail.com:465`, TLS avec vérification du certificat, et un mot de
passe d'application Google. L'expéditeur et l'enveloppe sont le compte authentifié.
Les identifiants, codes et réponses SMTP sensibles ne sont jamais journalisés par
le transport. Une acceptation SMTP ne prouve pas la réception dans la boîte cible.

Pour `polytechsconnect@gmail.com` :

1. Activer la validation en deux étapes du **compte Google** dans
   https://myaccount.google.com/security .
2. Créer un mot de passe d'application nommé « Polytechs Connect » sur
   https://myaccount.google.com/apppasswords . Ne jamais utiliser le mot de passe
   habituel, ni mettre le mot de passe d'application dans Git, un message ou une capture.
3. Dans Environment du service Render Test-polytechs, définir :

| Variable | Valeur |
| --- | --- |
| `POLYTECHS_MAIL_PROVIDER` | `gmail` |
| `POLYTECHS_GMAIL_USER` | `polytechsconnect@gmail.com` |
| `POLYTECHS_GMAIL_APP_PASSWORD` | Mot de passe d'application, saisi directement dans Render |
| `POLYTECHS_PUBLIC_ORIGIN` | `https://polytechsconnect.fr` |

Le mode Microsoft reste le défaut en l'absence de `POLYTECHS_MAIL_PROVIDER`.
Aucune configuration ni activation Gmail n'est déduite de la seule présence d'une adresse.
Conserver les variables Microsoft existantes jusqu'à validation du changement.

Avant de rendre les codes obligatoires, renseigner les adresses de tous les comptes
et tester réellement la réception et la récupération sur le compte administrateur.
Ensuite seulement passer `POLYTECHS_EMAIL_MFA_REQUIRED=true`, déployer et vérifier
une connexion avec code. Les destinataires restent les adresses des utilisateurs ;
ils n'ont pas besoin d'un compte Gmail. La validation en deux étapes du compte Google
expéditeur et celle de Polytechs Connect sont deux réglages distincts.

`node tests/gmail-mail.mjs` vérifie le transport avec SMTP simulé ; aucun message réel
n'est envoyé. Le service doit autoriser les connexions SMTP sortantes sur le port 465.
Google peut révoquer le mot de passe d'application après changement du mot de passe du compte.

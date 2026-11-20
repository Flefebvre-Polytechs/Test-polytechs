export const guideGroups = [
  { id: 'tickets', label: 'Tickets et actions' },
  { id: 'documents', label: 'Documents et audits' },
  { id: 'terrain', label: 'Terrain et QSSE' },
  { id: 'profile', label: 'Mon compte' },
] as const;

type Group = typeof guideGroups[number]['id'];
export type GuideAccess = 'create' | 'qsse' | 'epi';
export type Guide = {
  id: string;
  group: Group;
  title: string;
  summary: string;
  keywords?: string;
  steps: readonly string[];
  link?: { label: string; href: string; access?: GuideAccess };
};

export const guideAccessNotes: Record<GuideAccess, string> = {
  create: 'Ce raccourci est disponible avec un droit de modification dans un service.',
  qsse: 'L’accès à ce module nécessite des droits sur le service QSSE.',
  epi: 'L’accès au catalogue EPI nécessite des droits QSSE ou le rôle Gestionnaire EPI.',
};

export const guides: readonly Guide[] = [
  {
    id: 'open-ticket',
    group: 'tickets',
    title: 'Ouvrir un ticket',
    summary: 'Signalez un problème et désignez la personne qui en assurera le suivi.',
    keywords: 'créer creation nouveau signalement anomalie écart incident photo',
    steps: [
      'Dans Tickets, choisissez « Ouvrir un ticket ». Donnez-lui un titre précis et décrivez le constat, le lieu et les faits utiles.',
      'Sélectionnez la catégorie et les services concernés. Ajoutez des sujets et des lieux si ces étiquettes facilitent la recherche.',
      'Désignez un pilote et une échéance si vous les connaissez. Ajoutez des actions avec leurs propres responsables et délais si le traitement est déjà défini.',
      'Cliquez sur « Enregistrer le ticket ». Ouvrez ensuite « Pièces jointes » pour ajouter une photo ou un document.',
    ],
    link: { label: 'Ouvrir le formulaire de ticket', href: '/tickets?new=1', access: 'create' },
  },
  {
    id: 'my-tickets',
    group: 'tickets',
    title: 'Retrouver mes tickets',
    summary: 'Retrouvez les tickets où vous êtes pilote, responsable à notifier ou pilote d’une action.',
    keywords: 'suivre suivi rechercher filtre statut retard vérifier',
    steps: [
      'Ouvrez « Mes tickets » dans la barre latérale. Utilisez la recherche ou les filtres de catégorie, de service et de statut.',
      'Sélectionnez un ticket pour consulter son descriptif, ses actions, son activité et ses pièces jointes.',
      'Dans « Activité », publiez un commentaire si vous avez un droit de contribution. La case « Notifier les pilotes et les responsables » permet de les prévenir.',
    ],
    link: { label: 'Ouvrir Mes tickets', href: '/tickets?view=mine' },
  },
  {
    id: 'assign-action',
    group: 'tickets',
    title: 'Attribuer une action dans un ticket',
    summary: 'Définissez le travail à faire, le responsable et la date attendue.',
    keywords: 'ajouter créer tâche piloter affecter assigner responsable',
    steps: [
      'Ouvrez le ticket et repérez la section « Actions ». Pour une analyse 8D, ouvrez l’étape D6.',
      'Cliquez sur « Ajouter une action ». Renseignez le libellé, choisissez son pilote et indiquez le délai si vous le connaissez.',
      'Enregistrez le ticket. Le pilote reçoit automatiquement une notification lors de l’attribution ou de la réattribution.',
    ],
    link: { label: 'Ouvrir les tickets', href: '/tickets' },
  },
  {
    id: 'my-actions',
    group: 'tickets',
    title: 'Traiter une action attribuée',
    summary: 'Retrouvez votre action, vérifiez son délai et signalez sa réalisation.',
    keywords: 'mes actions tâche pilote clôturer terminer cocher faire en retard',
    steps: [
      'Ouvrez « Mes actions » dans la barre latérale. Choisissez « Ouvertes » ou « En retard » dans le filtre État.',
      'Ouvrez l’action pour accéder à son dossier d’origine. Pour une action de ticket, la cloche permet aussi de rejoindre directement la ligne concernée.',
      'Après réalisation, cochez l’action dans le ticket et enregistrez, si votre accès le permet. Pour un autre type d’action, mettez-la à jour dans son module d’origine.',
    ],
    link: { label: 'Ouvrir Mes actions', href: '/work' },
  },
  {
    id: 'ticket-analysis',
    group: 'tickets',
    title: 'Analyser un problème avec le 5 Pourquoi ou le 8D',
    summary: 'Identifiez les causes racines et associez-leur des actions correctives.',
    keywords: '5P 5 pourquoi arbre cause 8D analyse résoudre Ishikawa QQOQCCP',
    steps: [
      'Ouvrez le ticket à modifier. Utilisez le menu « … » pour choisir une méthode d’analyse, comme « 5P · 5 Pourquoi » ou « 8D ».',
      'Dans le 5 Pourquoi, ajoutez les causes au fur et à mesure de l’analyse. Dans un 8D, l’arbre se trouve dans l’étape D4.',
      'Dans le menu « … » d’une cause, créez une action ou liez une action existante. Renseignez son pilote et son délai.',
      'Enregistrez le ticket pour conserver l’analyse et envoyer les nouvelles notifications d’attribution.',
    ],
    link: { label: 'Ouvrir les tickets', href: '/tickets' },
  },
  {
    id: 'notifications',
    group: 'tickets',
    title: 'Lire ou reporter une notification',
    summary: 'Prenez connaissance d’une attribution ou retrouvez-la à votre prochaine connexion.',
    keywords: 'cloche alerte prévenir informer attribution rappel',
    steps: [
      'À la connexion, lisez l’information affichée et vérifiez l’action, le ticket et l’échéance s’ils sont indiqués.',
      'Choisissez « J’ai pris connaissance » pour confirmer la lecture, ou « Rappeler plus tard » pour retrouver cette alerte à la connexion suivante.',
      'Depuis la cloche en haut de l’écran, ouvrez une notification d’attribution pour rejoindre directement l’action.',
    ],
  },
  {
    id: 'find-document',
    group: 'documents',
    title: 'Retrouver un document dans la GED',
    summary: 'Cherchez un document par titre ou référence et ouvrez sa version disponible.',
    keywords: 'consulter lire télécharger procédure instruction version pdf',
    steps: [
      'Ouvrez « Gestion documentaire » depuis votre service. Vérifiez le service sélectionné dans la GED.',
      'Recherchez le document par titre ou référence. Ouvrez sa fiche pour consulter le statut et les versions auxquelles vous avez accès.',
      'Ouvrez le fichier joint à la version qui vous intéresse. Vérifiez sa révision avant de l’utiliser.',
    ],
    link: { label: 'Ouvrir la GED', href: '/ged' },
  },
  {
    id: 'upload-document',
    group: 'documents',
    title: 'Déposer un document dans la GED',
    summary: 'Préparez une version, joignez le fichier et transmettez-la en relecture.',
    keywords: 'créer ajouter rédiger charger upload publier validation approbation brouillon QSSE',
    steps: [
      'Choisissez le service qui portera le document. Le bouton « Déposer un document » est proposé si vous disposez du droit de dépôt.',
      'Renseignez le titre, la référence et le type du document. Sélectionnez le relecteur QSSE et l’approbateur selon le circuit de la fiche.',
      'Enregistrez le brouillon, puis joignez le fichier à la version. Vérifiez les destinataires et soumettez la version en relecture.',
    ],
    link: { label: 'Ouvrir la GED', href: '/ged' },
  },
  {
    id: 'run-audit',
    group: 'documents',
    title: 'Réaliser un audit',
    summary: 'Utilisez une grille sur le terrain et ouvrez un ticket si vous relevez un écart.',
    keywords: 'routine contrôle grille ponctuel conforme non conforme rapport preuve photo',
    steps: [
      'Ouvrez « Routines ». Retrouvez l’audit prévu ou choisissez « Réaliser maintenant » sur une grille du catalogue si vous disposez du droit de contribution.',
      'Renseignez les réponses de chaque point de contrôle et ajoutez vos observations. Si un point est non conforme, enregistrez le compte rendu avant de créer le ticket lié.',
      'Complétez le ticket depuis le point d’audit. Après son enregistrement, reprenez la grille pour terminer et enregistrer le compte rendu.',
    ],
    link: { label: 'Accéder aux routines', href: '/routines' },
  },
  {
    id: 'schedule-audit',
    group: 'documents',
    title: 'Programmer un audit',
    summary: 'Choisissez une grille et inscrivez une session à la date prévue.',
    keywords: 'planifier calendrier agenda programmer modèle échéance',
    steps: [
      'Ouvrez « Routines » et retrouvez la grille voulue dans le catalogue d’audits.',
      'Cliquez sur « Programmer ». Renseignez la date et l’heure, puis choisissez « Programmer l’audit ».',
      'Retrouvez la session dans les audits programmés. Le jour choisi, ouvrez-la pour renseigner le compte rendu.',
    ],
    link: { label: 'Accéder aux routines', href: '/routines', access: 'create' },
  },
  {
    id: 'epi-stock',
    group: 'terrain',
    title: 'Mettre à jour un stock EPI',
    summary: 'Enregistrez une entrée, une sortie ou un inventaire depuis une référence ou son QR code.',
    keywords: 'équipement protection individuelle scanner qrcode magasin fiche technique pdf dotation',
    steps: [
      'Scannez le QR code sur l’étiquette de l’EPI ou recherchez sa référence dans le catalogue Gestion EPI.',
      'Vérifiez la photo, la désignation et le code avant de saisir un mouvement. La fiche technique peut être consultée si elle a été jointe.',
      'Choisissez « Entrée », « Sortie » ou « Inventaire », renseignez la quantité et enregistrez avec un compte autorisé. En inventaire, saisissez le total réellement compté.',
    ],
    link: { label: 'Ouvrir le catalogue EPI', href: '/epi-stock', access: 'epi' },
  },
  {
    id: 'vgp',
    group: 'terrain',
    title: 'Suivre un contrôle VGP',
    summary: 'Retrouvez l’équipement concerné, son dernier passage et les écarts en cours.',
    keywords: 'vérification générale périodique matériel échéance rapport anomalie',
    steps: [
      'Ouvrez VGP, sélectionnez la famille de matériel, puis recherchez l’équipement par son nom ou sa référence.',
      'Ouvrez sa fiche pour vérifier la prochaine échéance, l’historique des passages et les pièces jointes.',
      'Si vous enregistrez un passage, renseignez sa date et son résultat. En cas d’écart, créez un ticket lié à l’équipement depuis sa fiche.',
    ],
    link: { label: 'Ouvrir le registre VGP', href: '/vgp', access: 'qsse' },
  },
  {
    id: 'waste',
    group: 'terrain',
    title: 'Enregistrer un enlèvement de déchets',
    summary: 'Planifiez une collecte, renseignez la quantité et conservez la référence du justificatif.',
    keywords: 'registre déchet BSD transporteur dupliquer valorisation recyclage',
    steps: [
      'Ouvrez « Gestion des déchets ». Cliquez sur « Nouvel enlèvement » ou dupliquez une ligne comparable depuis le registre.',
      'Renseignez la date, le déchet, la filière et les intervenants. Pour une prévision, utilisez la date et la quantité estimées.',
      'Après l’enlèvement, mettez à jour la date réelle, la quantité et les références du BSD ou du bon d’enlèvement, puis enregistrez.',
    ],
    link: { label: 'Ouvrir le registre des déchets', href: '/dechets', access: 'qsse' },
  },
  {
    id: 'pdp',
    group: 'terrain',
    title: 'Retrouver un plan de prévention',
    summary: 'Vérifiez le périmètre d’une intervention et les documents associés.',
    keywords: 'pdp annuel ponctuel entreprise extérieure autorisations prêt inspection commune',
    steps: [
      'Ouvrez « Plans de prévention ». Recherchez le dossier par entreprise ou opération et filtrez par type de plan si nécessaire.',
      'Ouvrez le plan pour retrouver les dates, le périmètre et, le cas échéant, le cadre annuel de rattachement.',
      'Parcourez les étapes du dossier pour retrouver l’inspection, les mesures définies et le statut des justificatifs.',
    ],
    link: { label: 'Ouvrir les plans de prévention', href: '/plans-prevention' },
  },
  {
    id: 'profile',
    group: 'profile',
    title: 'Changer ma photo ou la langue du site',
    summary: 'Personnalisez votre profil et conservez vos préférences d’une connexion à l’autre.',
    keywords: 'avatar image photo français anglais compte paramètres préférence',
    steps: [
      'Cliquez sur votre avatar ou vos initiales en haut à droite pour afficher « Mon profil ».',
      'Choisissez « Changer la photo » et sélectionnez une image JPEG, PNG ou WebP de 12 Mo maximum. Le cadrage est appliqué automatiquement.',
      'Dans « Langue du site », choisissez la langue de votre interface. La préférence est enregistrée sur votre compte.',
    ],
  },
];

export function matchingGuides(search: string, group: Group | 'all') {
  const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr');
  const terms = normalize(search.trim()).split(/\s+/).filter(Boolean);
  return guides.filter(guide => {
    if (group !== 'all' && guide.group !== group) return false;
    const text = normalize([guide.title, guide.summary, guide.keywords, ...guide.steps].join(' '));
    return terms.every(term => text.includes(term));
  });
}

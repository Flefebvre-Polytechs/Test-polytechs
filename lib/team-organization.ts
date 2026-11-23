export const teamGroups = [
  { id: 'management', name: 'Management', accent: '#74369a' },
  { id: 'operations', name: 'Réalisation', accent: '#0875bb' },
  { id: 'support', name: 'Support', accent: '#bd5018' },
  { id: 'other', name: 'Autres services', accent: '#bd5018' },
] as const;

export type TeamGroup = typeof teamGroups[number]['id'];

export const teamIconChoices = [
  { id: 'briefcase', name: 'Direction et commerce' },
  { id: 'shield', name: 'Sécurité' },
  { id: 'calendar', name: 'Planification' },
  { id: 'lightbulb', name: 'Innovation' },
  { id: 'users', name: 'Équipe' },
  { id: 'factory', name: 'Fabrication' },
  { id: 'flask', name: 'Laboratoire' },
  { id: 'truck', name: 'Transport' },
  { id: 'hard-hat', name: 'Travaux' },
  { id: 'cart', name: 'Achats' },
  { id: 'heart-handshake', name: 'Ressources humaines' },
  { id: 'network', name: 'Organisation' },
  { id: 'wrench', name: 'Maintenance' },
  { id: 'monitor', name: 'Informatique' },
  { id: 'leaf', name: 'Environnement' },
  { id: 'recycle', name: 'Recyclage' },
  { id: 'package', name: 'Colis' },
  { id: 'warehouse', name: 'Entrepôt' },
  { id: 'cog', name: 'Procédés' },
  { id: 'toolbox', name: 'Outillage' },
  { id: 'construction', name: 'Chantier' },
  { id: 'building', name: 'Bâtiment' },
  { id: 'clipboard', name: 'Contrôle' },
  { id: 'badge', name: 'Qualité' },
  { id: 'book', name: 'Documentation' },
  { id: 'chart', name: 'Indicateurs' },
  { id: 'heart-pulse', name: 'Santé' },
  { id: 'graduation', name: 'Formation' },
  { id: 'headphones', name: 'Assistance' },
  { id: 'euro', name: 'Budget' },
  { id: 'chip', name: 'Électronique' },
  { id: 'pin', name: 'Site' },
] as const;

export type TeamIcon = typeof teamIconChoices[number]['id'];

export function isTeamIcon(value: unknown): value is TeamIcon {
  return teamIconChoices.some(choice => choice.id === value);
}

export type Team = {
  id: string;
  name: string;
  rank: number;
  parent_id: string | null;
  revision: number;
  navigation_group: TeamGroup;
  navigation_order: number;
  icon: TeamIcon | '';
};

const teamNameOrder = new Intl.Collator('fr');

export function teamsInGroup(teams: readonly Team[], group: TeamGroup) {
  return teams.filter(team => team.navigation_group === group).sort((a, b) =>
    (a.navigation_order || Infinity) - (b.navigation_order || Infinity) ||
    a.rank - b.rank || teamNameOrder.compare(a.name, b.name) || teamNameOrder.compare(a.id, b.id),
  );
}

export function teamSettingsHref(id: string) {
  return '/equipes?modifier=' + encodeURIComponent(id);
}

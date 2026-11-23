export const teamGroups = [
  { id: 'management', name: 'Management', accent: '#74369a' },
  { id: 'operations', name: 'Réalisation', accent: '#0875bb' },
  { id: 'support', name: 'Support', accent: '#bd5018' },
  { id: 'other', name: 'Autres services', accent: '#bd5018' },
] as const;

export type TeamGroup = typeof teamGroups[number]['id'];
export type Team = {
  id: string;
  name: string;
  rank: number;
  parent_id: string | null;
  revision: number;
  navigation_group: TeamGroup;
  navigation_order: number;
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

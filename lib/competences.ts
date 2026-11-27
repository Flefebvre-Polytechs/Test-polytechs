export const competenceLevels = {
  I: {label:'Initiation', description:'Connaît les consignes et découvre la tâche.'},
  L: {label:'Accompagné', description:'Réalise la tâche avec accompagnement.'},
  U: {label:'Autonome', description:'Réalise la tâche seul dans les conditions évaluées.'},
} as const;

export type CompetenceLevel = keyof typeof competenceLevels;
export type CompetenceTeam = {id:string;name:string};
export type CompetenceLibrarySkill = {id:string;name:string;family:string;revision:number};
export type CompetenceSkill = CompetenceLibrarySkill & {target:number};
export type CompetencePerson = {id:string;name:string;userId:string|null;active:number;revision:number};
export type CompetenceAssessment = {
  skillId:string;
  personId:string;
  level:CompetenceLevel|'';
  revision:number;
  assessedAt:string;
  assessedBy:string|null;
};
export type CompetenceMatrix = {
  teams:CompetenceTeam[];
  teamId:string;
  library:CompetenceLibrarySkill[];
  canEditLibrary:boolean;
  skills:CompetenceSkill[];
  people:CompetencePerson[];
  assessments:CompetenceAssessment[];
};
export type CompetenceRelay = {
  skillId:string;
  skill:string;
  family:string;
  teams:string[];
  personId:string;
  name:string;
  userId:string|null;
  assessedAt:string;
};
export type CompetenceSearch = {relays:CompetenceRelay[];truncated:boolean};
export type CompetenceProfileSkill = {
  id:string;name:string;family:string;level:CompetenceLevel;assessedAt:string;inMatrix:boolean;
};

export function isCompetenceLevel(value:unknown):value is CompetenceLevel {
  return typeof value==='string'&&Object.hasOwn(competenceLevels,value);
}

const assessmentDate = new Intl.DateTimeFormat('fr-FR', {dateStyle:'medium',timeZone:'Europe/Paris'});

export function formatAssessmentDate(value:string) {
  return assessmentDate.format(new Date(value));
}

import {healthEventTypes} from './modules';
export {healthEventTypes};
export type HealthEventType=typeof healthEventTypes[number];
export const healthEventKind='Accidents du travail';
export const healthImportYear=2026;
export const healthImportLimit=500;
export const healthImportSheets=['Accidentologie','1ers soins','Accidento EE'] as const;

export type HealthImportRow={
 sheet:typeof healthImportSheets[number];row:number;date:string;time:string;person:string;place:string;
 eventType:HealthEventType;circumstances:string;analysis:string;service:string;injurySite:string;injuryNature:string;
 daysOff:string;workActivity:string;
};

export function normalizeHealthIdentity(value:string){
 return value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]/gu,'');
}

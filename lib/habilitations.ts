/** Shared RH habilitation rules. Never expose the private prerequisite fields from the public route. */
export type HabilitationKind='Autorisation de conduite'|'Habilitation électrique'|'CACES / formation'|'Autre';
export const habilitationKinds:HabilitationKind[]=['Autorisation de conduite','Habilitation électrique','CACES / formation','Autre'];
export const authorizationStatuses=['draft','active','suspended','revoked'] as const;
export type AuthorizationStatus=(typeof authorizationStatuses)[number];
export type HabilitationRecord={
 id:string;person_id:string;kind:HabilitationKind;title:string;category:string;equipment:string;zone:string;
 valid_from:string;valid_until:string;training_until:string;medical_until:string;
 status:AuthorizationStatus;prerequisites_checked:number;note:string;revision:number;updated_at:string;updated_by:string
};
export type HabilitationPerson={id:string;first_name:string;last_name:string;service:string;qr_token:string;active:number;revision:number;created_at:string;updated_at:string};
export type HabilitationFile={id:string;authorization_id:string;name:string;mime:string;size:number;author:string;created_at:string};
export type CurrentStatus='valid'|'expired'|'pending'|'suspended'|'revoked'|'draft';
const datePattern=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function isValidDate(value:string,optional=false){if(optional&&!value)return true;if(!datePattern.test(value))return false;const date=new Date(value+'T12:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value}
export function todayInFrance(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
export function currentStatus(a:Pick<HabilitationRecord,'status'|'valid_from'|'valid_until'|'training_until'|'medical_until'|'kind'|'prerequisites_checked'>,today=todayInFrance()):CurrentStatus{
 if(a.status==='revoked')return 'revoked';
 if(a.status==='suspended')return 'suspended';
 if(a.status!=='active'||a.kind==='Autorisation de conduite'&&!a.prerequisites_checked)return 'draft';
 if(a.valid_from>today)return 'pending';
 // A safety prerequisite expiring must also invalidate the employer's authorization.
 if([a.valid_until,a.training_until,a.medical_until].some(d=>d!==''&&d<today))return 'expired';
 return 'valid';
}
export const statusLabel:Record<CurrentStatus,string>={valid:'Valide',expired:'Expirée',pending:'À venir',suspended:'Suspendue',revoked:'Retirée',draft:'Non validée'};
export function nextDeadline(a:HabilitationRecord){return [a.valid_until,a.training_until,a.medical_until].filter(Boolean).sort()[0]||''}

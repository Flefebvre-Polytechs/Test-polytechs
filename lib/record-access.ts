import {hasFunctionRole} from './function-roles';
import {pdpRecipients} from './prevention-rules';
import type {Account} from './access';
import {database} from '@/db/raw';
import {accessibleTeams} from './team-access';
import {epiCanManage,epiCanRead} from './epi-access';
// Health-related records require explicit QSSE/RH membership, independent of
// the otherwise open-by-default service configuration. Derived actions inherit it.
export async function recordAccess(user:Account,records:any[],write=false){
 if(user.role==='admin')return (_r:any)=>true;
 if(write&&user.role!=='editor')return (_r:any)=>false;
 const epi=write?await epiCanManage(user):await epiCanRead(user);
 const pdpManager=await hasFunctionRole(user,'pdp_manager'),pdpApprover=!write&&(await hasFunctionRole(user,'hsee_approver')||await hasFunctionRole(user,'cse_representative'));
 const allowed=await accessibleTeams(user,write);
 const members=(await database().prepare("SELECT team_id,level FROM team_members WHERE user_id=? AND team_id IN ('qsse','rh')").bind(user.id).all()).results as any[];
 const health=user.role!=='reader'&&members.some(m=>m.level==='contributor'||!write&&m.level==='viewer');
 const map=new Map(records.map(r=>[r.id,r]));
 return (record:any)=>{if(record.kind==='Plans de prévention'&&(pdpManager||pdpApprover))return true;if(!write&&record.kind==='Plans de prévention'){let details=record.details;try{if(typeof details==='string')details=JSON.parse(details)}catch{details={}}if(pdpRecipients({...record,details:details||{}}).includes(user.id))return true;}if(record.kind==='EPI')return epi;let r=record;const visited=new Set<string>();while(r){if(r.kind==='Accidents du travail')return health;const id=r.source_id||r.sourceId;if(!id)break;if(visited.has(id)||!map.has(id))return false;visited.add(id);r=map.get(id)}return allowed.has('qsse')};
}

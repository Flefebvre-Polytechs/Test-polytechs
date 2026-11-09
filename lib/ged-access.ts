import {database} from '@/db/raw';
import type {Account} from './access';
import {documentTeams,documentOwnerTeam,participant,type GedDocument,type GedVersion} from './ged';
export async function gedAccess(user:Account){
 const [teams,members]=await Promise.all([database().prepare('SELECT id,name FROM teams ORDER BY rank,name').all(),database().prepare('SELECT team_id,level FROM team_members WHERE user_id=?').bind(user.id).all()]);
 const readable=new Set((members.results as any[]).filter(m=>['viewer','user','contributor','team_admin'].includes(m.level)).map(m=>String(m.team_id)));
 const writable=new Set((members.results as any[]).filter(m=>['contributor','team_admin'].includes(m.level)).map(m=>String(m.team_id)));
 const admin=user.role==='admin',global=admin||readable.has('qsse');
 const teamAdmins=new Set((members.results as any[]).filter(m=>m.level==='team_admin').map(m=>String(m.team_id)));
 const canDeleteTeam=(id:string)=>admin||user.role==='editor'&&teamAdmins.has(id);
 const canDeleteDocument=(doc:GedDocument)=>canDeleteTeam(documentOwnerTeam(doc))&&(!documentTeams(doc).includes('rh')||canDeleteTeam('rh'));
 const allServices=teams.results as {id:string;name:string}[];
 const services=allServices.filter(team=>admin||global&&team.id!=='rh'||readable.has(team.id));
 const rh=(doc:GedDocument)=>!documentTeams(doc).includes('rh')||admin||readable.has('rh');
 const canRead=(doc:GedDocument,versions:GedVersion[]=[])=>rh(doc)&&(admin||global||documentTeams(doc).some(id=>readable.has(id))||versions.some(v=>participant(v,user.id)));
 const canWriteTeam=(id:string)=>admin||user.role==='editor'&&writable.has(id);
 const canWrite=(doc:GedDocument)=>rh(doc)&&canWriteTeam(documentOwnerTeam(doc))&&(!documentTeams(doc).includes('rh')||canWriteTeam('rh'));
 const canReadVersion=(doc:GedDocument,version:GedVersion)=>rh(doc)&&(documentOwnerTeam(version.data)!=='rh'||admin||readable.has('rh'))&&(admin||participant(version,user.id)||version.status==='Approuvé'&&canRead(doc,[version]));
 return {canReadVersion,canDeleteDocument,deleteTeams:allServices.filter(t=>canDeleteTeam(t.id)).map(t=>t.id),global,services,allServices,defaultService:readable.has('qsse')||admin?'qsse':services[0]?.id||'',editableTeams:allServices.filter(t=>canWriteTeam(t.id)).map(t=>t.id),canRead,canWrite,canWriteTeam,canReadService:(id:string)=>services.some(t=>t.id===id),rh};
}
